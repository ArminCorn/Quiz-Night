// Zwischenstand nach einem Format.
//
// Vor dem Übernehmen: Gesamtstand von vorher + Formatpunkte als „+N“.
// Beim Übernehmen (Leertaste): die „+N“ wandern hoch, die Gesamtzahlen
// zählen hoch, danach erscheint, wer führt.
import { countUp, formatNumber, h, replay, setCount, setText } from '../core/dom.js';

const TEAMS = ['A', 'B'];
const COUNT_DELAY = 450;
const COUNT_DURATION = 1700;

export function createSummaryScene() {
  const swatch = h('span', { class: 'summary-swatch' });
  const kickerText = h('span');
  const kicker = h('div', { class: 'summary-kicker label' }, swatch, kickerText);
  const title = h('h1', { class: 'summary-title display' }, 'Zwischenstand');
  const bars = h('div', { class: 'testbars summary-bars', 'aria-hidden': 'true' }, Array.from({ length: 7 }, () => h('span')));
  const leader = h('div', { class: 'summary-leader label' });

  const cols = {};
  for (const team of TEAMS) {
    cols[team] = {
      name: h('div', { class: 'summary-name display' }),
      total: h('div', { class: 'summary-total display num' }),
      add: h('div', { class: 'summary-add label' }),
    };
  }
  const column = (team) => h('div', { class: 'summary-team' }, cols[team].name, cols[team].total, cols[team].add);

  const el = h(
    'div',
    { class: 'scene scene-summary' },
    h('div', { class: 'summary-head' }, kicker, title, bars),
    h('div', { class: 'summary-teams' }, column('A'), h('div', { class: 'summary-sep display' }, ':'), column('B')),
    leader,
  );

  let timers = [];
  let shownApplied = null;

  function clearTimers() {
    timers.forEach(clearTimeout);
    timers = [];
  }

  function leaderText(view) {
    const { A, B } = view.totalPoints;
    if (A === B) return 'Gleichstand';
    const team = A > B ? 'A' : 'B';
    const diff = Math.abs(A - B);
    return `${view.teams[team]} führt mit ${diff} ${diff === 1 ? 'Punkt' : 'Punkten'}`;
  }

  return {
    el,
    update(view, { animate }) {
      const s = view.summary;
      el.style.setProperty('--fc', s ? view.chapters.find((c) => c.id === s.formatId)?.color ?? 'var(--paper)' : 'var(--paper)');
      setText(kickerText, `nach ${s.formatName}`);

      for (const team of TEAMS) {
        setText(cols[team].name, view.teams[team]);
        setText(cols[team].add, `+${formatNumber(s.add[team])} ${s.formatName}`);
      }
      setText(leader, leaderText(view));

      if (s.applied === shownApplied) {
        // Nur Namen/Korrekturen geändert – Zahlen direkt setzen, falls keine Animation läuft
        if (!timers.length) {
          for (const team of TEAMS) setCount(cols[team].total, s.applied ? view.totalPoints[team] : s.before[team]);
        }
        return;
      }
      shownApplied = s.applied;
      clearTimers();

      if (!s.applied) {
        // Ausgangslage (auch nach Rückgängig)
        el.classList.remove('is-applied', 'is-applying');
        for (const team of TEAMS) {
          setCount(cols[team].total, s.before[team]);
          cols[team].add.classList.remove('is-flying');
        }
        return;
      }

      if (!animate) {
        el.classList.add('is-applied');
        el.classList.remove('is-applying');
        for (const team of TEAMS) setCount(cols[team].total, view.totalPoints[team]);
        return;
      }

      // Live übernehmen: Animation
      el.classList.add('is-applying');
      for (const team of TEAMS) {
        const col = cols[team];
        setCount(col.total, s.before[team]);
        replay(col.add, 'is-flying');
        timers.push(
          setTimeout(() => {
            countUp(col.total, s.before[team], view.totalPoints[team], COUNT_DURATION).then((done) => {
              if (done && s.add[team] !== 0) replay(col.total, 'is-landed');
            });
          }, COUNT_DELAY),
        );
      }
      timers.push(
        setTimeout(() => {
          timers = [];
          el.classList.remove('is-applying');
          el.classList.add('is-applied');
          replay(leader, 'is-appearing');
        }, COUNT_DELAY + COUNT_DURATION + 150),
      );
    },
    destroy() {
      clearTimers();
      for (const team of TEAMS) cols[team].total._countToken = null;
    },
  };
}
