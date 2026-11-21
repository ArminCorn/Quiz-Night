// Szenen der Beamer-Ansicht. Jede Szene: { el, update(view, info), destroy() }
// info = { animate, entering, prev }
//   animate  – Änderung kam live durch eine Aktion (nicht durch Neuladen/Rückgängig)
//   entering – Szene wurde gerade neu aufgebaut
//   prev     – vorherige Ansicht (oder null)
import { fitText, formatNumber, h, setText } from '../core/dom.js';
import { formatClient } from '../core/formats.js';
import { createLowerThird, createScorebug } from './parts.js';
import { createSummaryScene } from './summary.js';

export function sceneKey(view) {
  switch (view.phase) {
    case 'intro':
    case 'play':
      return `${view.phase}:${view.current?.id}`;
    case 'summary':
      return `summary:${view.summary?.formatId}`;
    default:
      return 'lobby';
  }
}

export function createScene(view, ctx) {
  switch (view.phase) {
    case 'intro':
      return createIntroScene(ctx);
    case 'play':
      return createPlayScene(view, ctx);
    case 'summary':
      return createSummaryScene(ctx);
    default:
      return createLobbyScene(ctx);
  }
}

const testbars = () =>
  h('div', { class: 'testbars', 'aria-hidden': 'true' }, Array.from({ length: 7 }, () => h('span')));

// ------------------------------------------------------------ Übersicht

function createLobbyScene(ctx) {
  const kicker = h('div', { class: 'lobby-kicker label' });
  const nameA = h('div', { class: 'lobby-team-name display' });
  const nameB = h('div', { class: 'lobby-team-name display' });
  const totalA = h('div', { class: 'lobby-total display num' });
  const totalB = h('div', { class: 'lobby-total display num' });
  const nextName = h('span', { class: 'lobby-next-name' });
  const nextSwatch = h('span', { class: 'lobby-next-swatch' });
  const next = h('div', { class: 'lobby-next label' }, nextSwatch, nextName);

  const el = h(
    'div',
    { class: 'scene scene-lobby' },
    h(
      'div',
      { class: 'lobby-head' },
      h('h1', { class: 'lobby-title display' }, ctx.config.title || 'Quiz Night'),
      testbars(),
      ctx.config.subtitle ? h('div', { class: 'lobby-sub label' }, ctx.config.subtitle) : null,
    ),
    h(
      'div',
      { class: 'lobby-score' },
      kicker,
      h(
        'div',
        { class: 'lobby-teams' },
        h('div', { class: 'lobby-team' }, nameA, totalA),
        h('div', { class: 'lobby-sep display' }, ':'),
        h('div', { class: 'lobby-team' }, nameB, totalB),
      ),
    ),
    next,
  );

  return {
    el,
    update(view) {
      const played = view.chapters.some((c) => c.done);
      setText(kicker, played ? 'Gesamtstand' : 'Die Teams');
      setText(nameA, view.teams.A);
      setText(nameB, view.teams.B);
      setText(totalA, formatNumber(view.totalPoints.A));
      setText(totalB, formatNumber(view.totalPoints.B));
      if (view.next) {
        setText(nextName, `Als Nächstes · ${view.next.name}`);
        nextSwatch.style.background = view.next.color;
        next.hidden = false;
      } else {
        next.hidden = !played;
        setText(nextName, 'Alle Formate gespielt');
        nextSwatch.style.background = 'var(--red)';
      }
    },
  };
}

// ------------------------------------------------------------ Intro

function createIntroScene() {
  const kicker = h('div', { class: 'intro-kicker label' });
  const name = h('h1', { class: 'intro-name display' });
  const bar = h('div', { class: 'intro-bar' });
  const el = h('div', { class: 'scene scene-intro' }, kicker, name, bar);

  return {
    el,
    update(view, { entering, animate }) {
      el.style.setProperty('--fc', view.current.color);
      setText(kicker, `Format ${view.current.number} von ${view.current.count}`);
      if (name.textContent !== view.current.name) {
        setText(name, view.current.name);
        const fit = () => fitText(name, { max: 210, min: 80, maxHeight: 420 });
        fit();
        document.fonts?.ready.then(fit);
      }
      if (entering) el.classList.toggle('is-animated', animate);
    },
  };
}

// ------------------------------------------------------------ Format läuft

function createPlayScene(view, ctx) {
  const client = formatClient(view.current.id);
  const content = h('div', { class: 'play-content' });
  const lowerThird = createLowerThird();
  const scorebug = createScorebug();
  const el = h('div', { class: 'scene scene-play' }, content, lowerThird.el, scorebug.el);
  el.style.setProperty('--fc', view.current.color);

  const inner = client?.mountScreen ? client.mountScreen(content, ctx) : null;
  if (!inner) content.append(h('div', { class: 'play-missing label' }, `${view.current.name}: keine Beamer-Ansicht`));

  return {
    el,
    update(v, info) {
      const sub = client?.lowerThird ? client.lowerThird(v.format, v) : null;
      lowerThird.update(v, sub, { entrance: info.entering && info.animate, animate: info.animate });
      scorebug.update(v, info);
      inner?.update(v.format, v, info);
    },
    destroy() {
      inner?.destroy?.();
    },
  };
}
