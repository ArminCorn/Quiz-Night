// Tests für das Buzzer-Modul im Kern und die gespeicherte Zuordnung.
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { createEngine, createInitialState } from '../server/engine.js';
import { createSettingsStore } from '../server/settings.js';
import { createStore } from '../server/store.js';

// Mini-Format: "open" gibt frei, onBuzz merkt sich, wer gebuzzert hat.
const probe = {
  init: () => ({ buzzed: [] }),
  actions: {
    open(fs, { teams }, api) {
      api.buzzer.open(teams);
    },
    lock(fs, payload, api) {
      api.buzzer.lock();
    },
  },
  onBuzz(fs, team, api) {
    fs.buzzed.push(team);
    api.addPoints(team, 1);
  },
};
const registry = {
  order: [{ id: 'probe', name: 'Probe', color: '#fff', playable: true }],
  get: (id) => (id === 'probe' ? registry.order[0] : null),
  module: () => probe,
  loadContent: () => null,
};
const config = { teams: { A: 'Rot', B: 'Blau' } };

function setup() {
  const engine = createEngine(registry);
  let s = createInitialState(config);
  const run = (scope, name, payload) => {
    const r = engine.dispatch(s, { scope, name, payload });
    s = r.state;
    return r;
  };
  run('core', 'next');
  run('core', 'next'); // → play
  return { engine, run, get: () => s };
}

test('Buzz ohne Freigabe wird still ignoriert', () => {
  const { run, get } = setup();
  const r = run('core', 'buzz', { team: 'A', source: 'key' });
  assert.equal(r.changed, false);
  assert.deepEqual(r.effects, []);
  assert.deepEqual(get().formatState.buzzed, []);
});

test('Erster gültiger Buzz sperrt alle weiteren und meldet ans Format', () => {
  const { run, get } = setup();
  run('format', 'open', { teams: ['A', 'B'] });
  const r = run('core', 'buzz', { team: 'B', source: 'gamepad' });
  assert.equal(r.changed, true);
  assert.deepEqual(r.effects, [{ sound: 'buzz' }, { buzz: 'B' }]);
  assert.equal(r.label, 'Buzz: Blau');
  assert.deepEqual(get().buzzer, { open: { A: false, B: false }, winner: 'B' });
  assert.deepEqual(get().formatState.buzzed, ['B']);
  // Zweiter Buzz (auch das andere Team) wird ignoriert
  assert.equal(run('core', 'buzz', { team: 'A' }).changed, false);
  assert.equal(run('core', 'buzz', { team: 'B' }).changed, false);
  assert.deepEqual(get().formatState.buzzed, ['B']);
});

test('Freigabe nur für ein Team', () => {
  const { run, get } = setup();
  run('format', 'open', { teams: ['A'] });
  assert.equal(run('core', 'buzz', { team: 'B' }).changed, false);
  assert.equal(run('core', 'buzz', { team: 'A' }).changed, true);
  assert.equal(get().buzzer.winner, 'A');
});

test('Sperren, Formatende und Übersicht schließen den Buzzer', () => {
  const { run, get } = setup();
  run('format', 'open', { teams: ['A', 'B'] });
  run('format', 'lock');
  assert.equal(run('core', 'buzz', { team: 'A' }).changed, false);
  run('format', 'open', { teams: ['A', 'B'] });
  run('core', 'endFormat');
  assert.deepEqual(get().buzzer, { open: { A: false, B: false }, winner: null });
});

test('Buzz in der Ansicht und rückgängig machbar', () => {
  const dir = mkdtempSync(join(tmpdir(), 'quiz-buzz-'));
  try {
    const engine = createEngine(registry);
    const store = createStore({ dataDir: dir, engine, config });
    store.dispatch({ scope: 'core', name: 'next' });
    store.dispatch({ scope: 'core', name: 'next' });
    store.dispatch({ scope: 'format', name: 'open', payload: { teams: ['A', 'B'] } });
    store.dispatch({ scope: 'core', name: 'buzz', payload: { team: 'A' } });
    assert.equal(engine.view(store.state, 'screen').buzzer.winner, 'A');
    assert.equal(store.state.formatPoints.A, 1);
    store.dispatch({ scope: 'core', name: 'undo' });
    assert.deepEqual(store.state.buzzer, { open: { A: true, B: true }, winner: null });
    assert.equal(store.state.formatPoints.A, 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('Einstellungen: Standard-Tasten, Zuordnung speichern, ungültige ablehnen', () => {
  const dir = mkdtempSync(join(tmpdir(), 'quiz-set-'));
  try {
    let st = createSettingsStore({ dataDir: dir, config: {} });
    assert.deepEqual(st.get().buzzer.keys, { A: 'a', B: 'l' });
    st.updateBuzzer({ gamepad: { A: { pad: 0, button: 2, name: 'Encoder' }, B: { pad: 0, button: 5 } } });
    st.updateBuzzer({ keys: { A: 'Q', B: 'p' } });
    st = createSettingsStore({ dataDir: dir, config: {} }); // neu laden
    assert.deepEqual(st.get().buzzer.gamepad.A, { pad: 0, button: 2, name: 'Encoder' });
    assert.deepEqual(st.get().buzzer.keys, { A: 'q', B: 'p' });
    assert.ok(JSON.parse(readFileSync(join(dir, 'settings.json'), 'utf8')).buzzer);
    assert.throws(() => st.updateBuzzer({ keys: { A: 'q', B: 'q' } }), /dieselbe Taste/);
    assert.throws(() => st.updateBuzzer({ keys: { A: ' ', B: 'p' } }));
    assert.throws(() => st.updateBuzzer({ keys: { A: 'z', B: 'p' } }));
    assert.throws(() => st.updateBuzzer({ gamepad: { A: { pad: 0, button: 5 }, B: { pad: 0, button: 5 } } }), /denselben/);
    assert.throws(() => st.updateBuzzer({ gamepad: { A: { pad: -1, button: 1 } } }));
    assert.deepEqual(st.get().buzzer.keys, { A: 'q', B: 'p' }, 'ungültige Änderung ändert nichts');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
