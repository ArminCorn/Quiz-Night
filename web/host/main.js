// Gamemaster-Ansicht (/host): Steuerung, Vorschau, Tastaturkürzel.
import '../styles/base.css';
import './host.css';
import { connect } from '../core/connection.js';
import { formatNumber, h, setText } from '../core/dom.js';
import { allFormatClients, formatClient, resolveLabel } from '../core/formats.js';
import { createGamepadReader } from '../core/buzzer.js';
import { createBuzzerPanel } from './buzzer-panel.js';

const TEAMS = ['A', 'B'];
const PHASE_NAMES = { lobby: 'Übersicht', intro: 'Intro', play: 'Format läuft', summary: 'Zwischenstand' };

let view = null;
let settings = null; // Geräte-Einstellungen (Buzzer-Zuordnung) vom Server
const conn = connect('host', { onState, onError: toast, onStatus, onSettings });
const send = (scope, name, payload) => conn.send(scope, name, payload);

// ---------------------------------------------------------------- Buzzer
const buzzerPanel = createBuzzerPanel({
  saveBuzzer: (patch) => conn.raw({ t: 'settings', buzzer: patch }),
  setTesting: (on) => conn.raw({ t: 'buzzerTest', on }),
  conflictsFor: keyConflict,
  toast,
  getTeams: () => view?.teams,
});
const gamepads = createGamepadReader({
  onTeam(team) {
    if (buzzerPanel.isOpen()) buzzerPanel.lamp(team);
    else buzz(team, 'gamepad');
  },
  onButton: (press) => buzzerPanel.onButton(press),
  onChange: (pads) => buzzerPanel.onPads(pads),
});

function buzz(team, source) {
  if (source === 'manual' && view && !view.buzzer?.open?.[team]) {
    return toast(`Buzzer für ${view.teams[team]} ist gerade nicht freigegeben.`);
  }
  send('core', 'buzz', { team, source });
}

/** Ist die Taste schon anders belegt? Gibt eine Beschreibung zurück oder null. */
function keyConflict(key) {
  if (key === ' ' || key === 'z') return 'Kern (Leertaste / Rückgängig)';
  for (const [id, client] of Object.entries(allFormatClients())) {
    const hit = (client.shortcuts ?? []).find((s) => s.key.toLowerCase() === key);
    if (hit) return `Format „${id}“`;
  }
  return null;
}

function buzzerKeyTeam(key) {
  const keys = settings?.buzzer?.keys;
  if (!keys) return null;
  return key === keys.A ? 'A' : key === keys.B ? 'B' : null;
}

// ================================================================ Gerüst

const app = document.getElementById('app');

const statusDot = h('span', { class: 'status-dot' });
const statusText = h('span', {}, 'verbinde …');
const phaseBadge = h('span', { class: 'phase-badge label' });

const header = h(
  'header',
  { class: 'host-header' },
  h('div', { class: 'brand' }, h('span', { class: 'brand-title display' }, 'Quiz Night'), h('span', { class: 'brand-sub label' }, 'Gamemaster')),
  phaseBadge,
  h(
    'div',
    { class: 'header-right' },
    h('span', { class: 'status' }, statusDot, statusText),
    h('button', { class: 'btn btn-ghost', onClick: () => buzzerPanel.open() }, 'Buzzer'),
    h('button', { class: 'btn btn-ghost', onClick: openScreenWindow }, 'Beamer-Fenster öffnen'),
    h('button', { class: 'btn btn-danger-ghost', onClick: newGame }, 'Neues Spiel'),
  ),
);

// Nächster Schritt
const nextLabel = h('div', { class: 'next-label' });
const nextDetail = h('div', { class: 'next-detail' });
const nextBtn = h('button', { class: 'btn btn-primary btn-big', onClick: () => send('core', 'next') }, 'Weiter', h('kbd', {}, 'Leertaste'));
const nextPanel = panel('Nächster Schritt', h('div', { class: 'next-row' }, h('div', { class: 'next-text' }, nextLabel, nextDetail), nextBtn), 'panel-next');

// Phasen-Bereich (wechselt je nach Phase)
const phaseTitle = h('h2', { class: 'panel-title label' });
const phaseBody = h('div', { class: 'phase-body' });
const phasePanel = h('section', { class: 'panel panel-phase' }, phaseTitle, phaseBody);
let phase = null; // { key, update, destroy }

// Punkte
const points = createPointsPanel();

// Rückgängig
const undoLabel = h('div', { class: 'undo-label' });
const undoBtn = h('button', { class: 'btn btn-big', onClick: undo }, 'Rückgängig', h('kbd', {}, 'Z'));
const undoPanel = panel('Rückgängig', h('div', { class: 'undo-row' }, undoBtn, undoLabel));

// Vorschau
const preview = h('iframe', { class: 'preview-frame', src: '/screen?preview=1', title: 'Beamer-Vorschau', tabindex: '-1' });
const previewPanel = panel('Beamer-Vorschau (live)', h('div', { class: 'preview-box' }, preview));

// Kürzel
const legendList = h('dl', { class: 'legend' });
const legendPanel = panel('Tastaturkürzel', legendList);

// Ablauf
const chapterList = h('ol', { class: 'chapter-list' });
const chapterPanel = panel('Ablauf des Abends', chapterList);

const toasts = h('div', { class: 'toasts', 'aria-live': 'polite' });

app.append(
  header,
  h(
    'main',
    { class: 'host-main' },
    h('div', { class: 'col col-left' }, nextPanel, phasePanel, points.el),
    h('div', { class: 'col col-right' }, previewPanel, undoPanel, legendPanel, chapterPanel),
  ),
  buzzerPanel.el,
  toasts,
);

function panel(title, body, extraClass = '') {
  return h('section', { class: `panel ${extraClass}` }, h('h2', { class: 'panel-title label' }, title), body);
}

// ================================================================ Zustand

function onStatus(online) {
  statusDot.classList.toggle('is-online', online);
  setText(statusText, online ? 'verbunden' : 'getrennt – verbinde neu …');
  document.body.classList.toggle('is-offline', !online);
}

function onSettings(msg) {
  settings = msg.settings;
  gamepads.setMapping(settings.buzzer.gamepad);
  buzzerPanel.updateSettings(settings);
  if (view) renderLegend(view);
}

function onState(msg) {
  view = msg.view;
  render();
}

function render() {
  const v = view;
  setText(phaseBadge, PHASE_NAMES[v.phase] ?? v.phase);
  phaseBadge.style.setProperty('--c', v.current?.color ?? 'var(--paper-faint)');

  // Nächster Schritt
  const step = nextStep(v);
  setText(nextLabel, step.label);
  setText(nextDetail, step.detail ?? '');
  nextDetail.hidden = !step.detail;
  nextBtn.disabled = Boolean(step.disabled);

  // Phase
  const key = v.phase === 'play' || v.phase === 'intro' ? `${v.phase}:${v.current?.id}` : v.phase;
  if (phase?.key !== key) {
    phase?.destroy?.();
    phaseBody.replaceChildren();
    phase = { key, ...createPhase(v) };
  }
  setText(phaseTitle, phase.title(v));
  phase.update(v);

  points.update(v);

  // Rückgängig
  undoBtn.disabled = !v.undo;
  setText(undoLabel, v.undo ? `Letzte Aktion: ${v.undo.label}` : 'Noch nichts zum Rückgängigmachen.');

  renderLegend(v);
  renderChapters(v);
}

// ================================================================ Nächster Schritt

function nextStep(v) {
  switch (v.phase) {
    case 'lobby':
      return v.next
        ? { label: `${v.next.name} starten`, detail: 'Der Beamer zeigt den Intro-Screen des Formats.' }
        : { label: 'Alle spielbaren Formate sind gespielt.', disabled: true };
    case 'intro':
      return { label: `Intro beenden – ${v.current.name} beginnt`, detail: 'Die Bauchbinde fährt ein, die Formatpunkte erscheinen.' };
    case 'play': {
      const client = formatClient(v.current?.id);
      return client?.nextStep?.(v.format, v) ?? { label: 'Nächster Schritt' };
    }
    case 'summary': {
      const s = v.summary;
      if (s.applied) return { label: 'Zur Übersicht', detail: 'Der Beamer zeigt den Gesamtstand und das nächste Format.' };
      return {
        label: 'Punkte in den Gesamtstand übernehmen',
        detail: `${v.teams.A} +${s.add.A}, ${v.teams.B} +${s.add.B} – die Zahlen zählen hoch.`,
      };
    }
    default:
      return { label: '–', disabled: true };
  }
}

// ================================================================ Phasen

function createPhase(v) {
  switch (v.phase) {
    case 'lobby':
      return createLobbyPhase(v);
    case 'intro':
      phaseBody.append(h('p', { class: 'hint' }, 'Der Beamer zeigt gerade den Intro-Screen. Mit der Leertaste beginnt das Format.'));
      return { title: (x) => `Intro · ${x.current.name}`, update() {} };
    case 'play':
      return createPlayPhase(v);
    case 'summary':
      return createSummaryPhase();
    default:
      return { title: () => '', update() {} };
  }
}

function createLobbyPhase(v) {
  const inputs = {};
  const fields = TEAMS.map((team) => {
    inputs[team] = h('input', { type: 'text', maxlength: '30', value: v.teams[team], autocomplete: 'off', spellcheck: 'false' });
    return h('label', { class: 'field' }, h('span', { class: 'label' }, `Team ${team}`), inputs[team]);
  });
  const form = h(
    'form',
    {
      class: 'team-form',
      onSubmit(e) {
        e.preventDefault();
        send('core', 'setTeams', { A: inputs.A.value, B: inputs.B.value });
        document.activeElement?.blur();
      },
    },
    fields,
    h('button', { class: 'btn', type: 'submit' }, 'Namen speichern'),
  );
  const hint = h('p', { class: 'hint' });
  phaseBody.append(form, hint);

  return {
    title: () => 'Übersicht · Teams',
    update(x) {
      for (const team of TEAMS) if (document.activeElement !== inputs[team]) inputs[team].value = x.teams[team];
      setText(
        hint,
        x.next
          ? `Leertaste startet ${x.next.name}. Ein anderes Format startest du rechts im Ablauf.`
          : 'Alle spielbaren Formate sind gespielt. Weitere Formate kommen als Module dazu.',
      );
    },
  };
}

function createPlayPhase(v) {
  const client = formatClient(v.current.id);
  const box = h('div', { class: 'format-host' });
  const endBtn = h(
    'button',
    {
      class: 'btn btn-danger-ghost',
      onClick() {
        if (confirm(`${view.current.name} jetzt beenden und zum Zwischenstand wechseln?`)) send('core', 'endFormat');
      },
    },
    'Format beenden',
  );
  phaseBody.append(box, h('div', { class: 'phase-actions' }, endBtn));

  const inner = client?.mountHost
    ? client.mountHost(box, {
        send: (name, payload) => send('format', name, payload),
        buzz: (team) => buzz(team, 'manual'),
        toast,
        formatId: v.current.id,
      })
    : null;
  if (!inner) box.append(h('p', { class: 'hint' }, 'Dieses Format hat keine Gamemaster-Steuerung.'));

  return {
    title: (x) => x.current.name,
    update: (x) => inner?.update(x.format, x),
    destroy: () => inner?.destroy?.(),
  };
}

function createSummaryPhase() {
  const rows = {};
  const table = h(
    'table',
    { class: 'summary-table' },
    h('thead', {}, h('tr', {}, h('th', {}, 'Team'), h('th', {}, 'Vorher'), h('th', {}, 'Format'), h('th', {}, 'Neu'))),
    h(
      'tbody',
      {},
      TEAMS.map((team) => {
        rows[team] = { name: h('td'), before: h('td', { class: 'num' }), add: h('td', { class: 'num' }), after: h('td', { class: 'num strong' }) };
        const r = rows[team];
        return h('tr', {}, r.name, r.before, r.add, r.after);
      }),
    ),
  );
  const status = h('p', { class: 'hint' });
  phaseBody.append(table, status);

  return {
    title: (x) => `Zwischenstand · nach ${x.summary.formatName}`,
    update(x) {
      const s = x.summary;
      for (const team of TEAMS) {
        const r = rows[team];
        setText(r.name, x.teams[team]);
        setText(r.before, formatNumber(s.before[team]));
        setText(r.add, `+${formatNumber(s.add[team])}`);
        setText(r.after, formatNumber(s.before[team] + s.add[team]));
      }
      setText(status, s.applied ? 'Übernommen. Der Beamer zeigt den neuen Gesamtstand.' : 'Noch nicht übernommen. Leertaste startet die Animation auf dem Beamer.');
    },
  };
}

// ================================================================ Punkte

function createPointsPanel() {
  const makeRows = (scope) =>
    TEAMS.map((team) => {
      const name = h('span', { class: 'pt-name' });
      const value = h('span', { class: 'pt-value num' });
      const minus = h('button', { class: 'btn btn-square', title: 'Minus 1', onClick: () => send('core', 'adjustPoints', { scope, team, delta: -1 }) }, '−');
      const plus = h('button', { class: 'btn btn-square', title: 'Plus 1', onClick: () => send('core', 'adjustPoints', { scope, team, delta: 1 }) }, '+');
      return { team, el: h('div', { class: 'pt-row' }, name, minus, value, plus), name, value, minus, plus };
    });

  const formatRows = makeRows('format');
  const totalRows = makeRows('total');
  const formatBlock = h('div', { class: 'pt-block' }, h('h3', { class: 'pt-title label' }, 'Formatpunkte'), formatRows.map((r) => r.el));
  const totalBlock = h('div', { class: 'pt-block' }, h('h3', { class: 'pt-title label' }, 'Gesamtpunkte (Korrektur)'), totalRows.map((r) => r.el));
  const el = panel('Punkte', h('div', { class: 'pt-grid' }, formatBlock, totalBlock));

  return {
    el,
    update(v) {
      const formatActive = v.phase === 'play' || v.phase === 'intro';
      formatBlock.classList.toggle('is-disabled', !formatActive);
      for (const r of formatRows) {
        setText(r.name, v.teams[r.team]);
        setText(r.value, formatActive ? formatNumber(v.formatPoints[r.team]) : '–');
        r.minus.disabled = r.plus.disabled = !formatActive;
      }
      for (const r of totalRows) {
        setText(r.name, v.teams[r.team]);
        setText(r.value, formatNumber(v.totalPoints[r.team]));
      }
    },
  };
}

// ================================================================ Kürzel

function activeShortcuts(v) {
  const list = [{ key: ' ', keyLabel: 'Leertaste', label: 'Nächster Schritt', run: () => send('core', 'next') }];
  if (v?.phase === 'play') {
    const client = formatClient(v.current?.id);
    for (const s of client?.shortcuts ?? []) {
      list.push({
        key: s.key.toLowerCase(),
        keyLabel: s.keyLabel ?? s.key.toUpperCase(),
        label: resolveLabel(s.label, v),
        run: s.buzz
          ? () => buzz(s.buzz, 'manual')
          : () => send(s.scope === 'core' ? 'core' : 'format', s.action, s.payload ?? {}),
      });
    }
    // Tastatur-Buzzer nur zeigen, wenn das Format Buzzer benutzt
    if (client?.buzzer && settings) {
      for (const team of TEAMS) {
        list.push({
          key: settings.buzzer.keys[team],
          keyLabel: settings.buzzer.keys[team].toUpperCase(),
          label: `Tastatur-Buzzer ${v.teams[team]}`,
          run: () => buzz(team, 'key'),
        });
      }
    }
  }
  list.push({ key: 'z', keyLabel: 'Z', label: 'Rückgängig', run: undo });
  return list;
}

function renderLegend(v) {
  const items = activeShortcuts(v).flatMap((s) => [h('dt', {}, h('kbd', {}, s.keyLabel)), h('dd', {}, s.label)]);
  legendList.replaceChildren(...items);
}

window.addEventListener('keydown', (e) => {
  if (!view) return;
  if (buzzerPanel.isOpen()) {
    // Im Testscreen: Esc schließt, Buzzer-Tasten lassen die Lampe leuchten, sonst nichts
    if (e.key === 'Escape') return buzzerPanel.close();
    if (e.target instanceof Element && e.target.closest('input')) return;
    const team = buzzerKeyTeam(e.key.toLowerCase());
    if (team && !e.repeat) buzzerPanel.lamp(team);
    if (e.key === ' ') e.preventDefault();
    return;
  }
  if (e.target instanceof Element && e.target.closest('input, textarea, select, [contenteditable]')) return;
  if (e.altKey) return;
  if (e.ctrlKey || e.metaKey) {
    if (e.key.toLowerCase() === 'z') {
      e.preventDefault();
      if (!e.repeat) undo();
    }
    return;
  }
  const key = e.key === ' ' || e.code === 'Space' ? ' ' : e.key.toLowerCase();
  const shortcut = activeShortcuts(view).find((s) => s.key === key);
  if (!shortcut) {
    // Tastatur-Buzzer wirken immer (ohne Freigabe ignoriert sie der Server still)
    const team = buzzerKeyTeam(key);
    if (team && !e.repeat) buzz(team, 'key');
    return;
  }
  e.preventDefault();
  if (e.repeat) return;
  shortcut.run();
});

// Leertaste darf nie zusätzlich einen fokussierten Knopf auslösen
window.addEventListener('keyup', (e) => {
  if (e.key === ' ' && !(e.target instanceof Element && e.target.closest('input, textarea'))) e.preventDefault();
});
document.addEventListener('click', (e) => {
  const button = e.target instanceof Element ? e.target.closest('button') : null;
  if (button) button.blur();
});

// ================================================================ Ablauf

function renderChapters(v) {
  const items = v.chapters.map((c, i) => {
    let status = 'offen';
    if (c.active) status = 'läuft';
    else if (c.done) status = 'gespielt';
    else if (!c.playable) status = 'noch nicht gebaut';

    let action = null;
    if (v.phase === 'lobby' && c.playable) {
      action = h(
        'button',
        {
          class: 'btn btn-small',
          onClick() {
            if (c.done && !confirm(`${c.name} wurde schon gespielt. Nochmal starten?`)) return;
            send('core', 'startFormat', { id: c.id });
          },
        },
        c.done ? 'Nochmal' : 'Starten',
      );
    }

    return h(
      'li',
      { class: `chapter-item${c.active ? ' is-active' : ''}${c.done ? ' is-done' : ''}${c.playable ? '' : ' is-soon'}` },
      h('span', { class: 'ch-num num' }, String(i + 1).padStart(2, '0')),
      h('span', { class: 'ch-swatch', style: { background: c.color } }),
      h('span', { class: 'ch-name' }, c.name),
      h('span', { class: 'ch-status' }, status),
      action,
    );
  });
  chapterList.replaceChildren(...items);
}

// ================================================================ Aktionen

function undo() {
  if (!view?.undo) return toast('Nichts zum Rückgängigmachen.');
  send('core', 'undo');
}

function newGame() {
  const ok = confirm(
    'Wirklich ein NEUES SPIEL starten?\n\nAlle Punkte und der Fortschritt werden zurückgesetzt. Die Teamnamen bleiben. Der alte Stand wird als Sicherung im Ordner data/ abgelegt.',
  );
  if (ok) send('core', 'newGame');
}

function openScreenWindow() {
  window.open('/screen', 'quiz-night-screen', 'popup,width=1280,height=720');
}

function toast(message) {
  const el = h('div', { class: 'toast' }, message);
  toasts.append(el);
  setTimeout(() => el.classList.add('is-leaving'), 3200);
  setTimeout(() => el.remove(), 3600);
}
