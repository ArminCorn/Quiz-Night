// Buzzer-Testscreen im Gamemaster-Fenster:
//  - zeigt live, welche Gamepad-Knöpfe gedrückt werden
//  - ordnet Knöpfe den Teams zu („Knopf zuordnen“ → Buzzer drücken)
//  - legt die Tasten für den Tastatur-Ersatz fest
//  - Testlampen pro Team
// Solange der Testscreen offen ist, zählen Buzzes nicht im Spiel.
import { h, setText } from '../core/dom.js';
import { describeMapping, gamepadSupported } from '../core/buzzer.js';

const TEAMS = ['A', 'B'];

export function createBuzzerPanel({ saveBuzzer, setTesting, conflictsFor, toast, getTeams }) {
  let settings = null;
  let pads = [];
  let learning = null; // 'A' | 'B' | null
  let openState = false;

  const status = h('p', { class: 'bp-status' });
  const padList = h('div', { class: 'bp-pads' });

  const cards = {};
  for (const team of TEAMS) {
    const name = h('div', { class: 'bp-team-name' });
    const lamp = h('div', { class: 'bp-lamp', 'aria-label': `Testlampe Team ${team}` });
    const mapping = h('div', { class: 'bp-mapping' });
    const learnBtn = h('button', { class: 'btn btn-small', type: 'button', onClick: () => toggleLearn(team) });
    const clearBtn = h(
      'button',
      { class: 'btn btn-small', type: 'button', onClick: () => saveBuzzer({ gamepad: { ...settings.buzzer.gamepad, [team]: null } }) },
      'Entfernen',
    );
    const keyInput = h('input', { class: 'form-input bp-key', type: 'text', maxlength: '1', autocomplete: 'off', spellcheck: 'false', 'aria-label': `Taste Team ${team}` });
    const keyForm = h(
      'form',
      {
        class: 'bp-keyform',
        onSubmit(e) {
          e.preventDefault();
          saveKey(team, keyInput.value);
          keyInput.blur();
        },
      },
      h('span', { class: 'label' }, 'Taste'),
      keyInput,
      h('button', { class: 'btn btn-small', type: 'submit' }, 'Speichern'),
    );
    const el = h(
      'div',
      { class: 'bp-card' },
      h('div', { class: 'bp-card-head' }, lamp, name),
      h('div', { class: 'bp-row' }, h('span', { class: 'label' }, 'Gamepad'), mapping, learnBtn, clearBtn),
      keyForm,
    );
    cards[team] = { el, name, lamp, mapping, learnBtn, clearBtn, keyInput };
  }

  const closeBtn = h('button', { class: 'btn', type: 'button', onClick: () => close() }, 'Fertig', h('kbd', {}, 'Esc'));
  const el = h(
    'div',
    { class: 'buzzer-panel', hidden: true, role: 'dialog', 'aria-label': 'Buzzer einrichten und testen' },
    h(
      'div',
      { class: 'bp-box' },
      h('div', { class: 'bp-head' }, h('h2', { class: 'display bp-title' }, 'Buzzer'), closeBtn),
      h('p', { class: 'hint bp-note' }, 'Testmodus: Solange dieses Fenster offen ist, zählen Buzzes nicht im Spiel. Jeden Buzzer einmal drücken – die Testlampe des Teams muss aufleuchten.'),
      h('section', { class: 'bp-section' }, h('h3', { class: 'label bp-sub' }, 'Teams'), h('div', { class: 'bp-cards' }, TEAMS.map((t) => cards[t].el))),
      h('section', { class: 'bp-section' }, h('h3', { class: 'label bp-sub' }, 'Gamepads (live)'), status, padList),
    ),
  );

  function toggleLearn(team) {
    learning = learning === team ? null : team;
    render();
  }

  function saveKey(team, value) {
    const key = String(value ?? '').trim().toLowerCase();
    if (key.length !== 1) return toast('Bitte genau ein Zeichen eingeben.');
    const conflict = conflictsFor(key);
    if (conflict) return toast(`„${key.toUpperCase()}“ ist schon belegt: ${conflict}.`);
    saveBuzzer({ keys: { ...settings.buzzer.keys, [team]: key } });
  }

  function lamp(team) {
    const l = cards[team].lamp;
    l.classList.remove('is-on');
    void l.offsetWidth;
    l.classList.add('is-on');
    clearTimeout(l._t);
    l._t = setTimeout(() => l.classList.remove('is-on'), 700);
  }

  function renderPads() {
    if (!gamepadSupported()) {
      setText(status, 'Dieser Browser bietet keine Gamepad-API an. Bitte Chrome oder Edge verwenden.');
      padList.replaceChildren();
      return;
    }
    setText(
      status,
      pads.length
        ? `${pads.length} Gamepad${pads.length > 1 ? 's' : ''} erkannt.`
        : 'Kein Gamepad erkannt. Encoder einstecken und einmal einen Buzzer drücken – erst dann meldet der Browser das Gerät.',
    );
    const map = settings?.buzzer.gamepad ?? {};
    padList.replaceChildren(
      ...pads.map((pad) =>
        h(
          'div',
          { class: 'bp-pad' },
          h('div', { class: 'bp-pad-name' }, `Gamepad ${pad.index + 1}: ${pad.id}`),
          h(
            'div',
            { class: 'bp-buttons' },
            pad.buttons.map((pressed, i) => {
              const team = TEAMS.find((t) => map[t] && map[t].pad === pad.index && map[t].button === i);
              return h(
                'span',
                { class: `bp-btn${pressed ? ' is-pressed' : ''}${team ? ` is-team is-team-${team}` : ''}`, title: `Knopf ${i + 1}` },
                team ? `${i + 1}·${team}` : String(i + 1),
              );
            }),
          ),
        ),
      ),
    );
  }

  function render() {
    if (!settings) return;
    const teams = getTeams();
    for (const team of TEAMS) {
      const c = cards[team];
      setText(c.name, teams?.[team] ?? `Team ${team}`);
      setText(c.mapping, describeMapping(settings.buzzer.gamepad[team]));
      c.mapping.classList.toggle('is-missing', !settings.buzzer.gamepad[team]);
      setText(c.learnBtn, learning === team ? 'Jetzt Buzzer drücken … (abbrechen)' : 'Knopf zuordnen');
      c.learnBtn.classList.toggle('btn-primary', learning === team);
      c.clearBtn.disabled = !settings.buzzer.gamepad[team];
      if (document.activeElement !== c.keyInput) c.keyInput.value = settings.buzzer.keys[team].toUpperCase();
    }
    renderPads();
  }

  function open() {
    if (openState) return;
    openState = true;
    el.hidden = false;
    setTesting(true);
    render();
  }

  function close() {
    if (!openState) return;
    openState = false;
    learning = null;
    el.hidden = true;
    setTesting(false);
  }

  return {
    el,
    open,
    close,
    isOpen: () => openState,
    updateSettings(next) {
      settings = next;
      render();
    },
    onPads(next) {
      pads = next;
      if (openState) renderPads();
    },
    onButton(press) {
      if (!openState || !learning) return;
      const team = learning;
      learning = null;
      const other = team === 'A' ? 'B' : 'A';
      const gamepad = { ...settings.buzzer.gamepad, [team]: { pad: press.pad, button: press.button, name: press.name } };
      const o = gamepad[other];
      if (o && o.pad === press.pad && o.button === press.button) gamepad[other] = null; // Knopf wechselt das Team
      saveBuzzer({ gamepad });
      render();
    },
    lamp,
  };
}
