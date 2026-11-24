// Tests für die Kern-Engine mit einem minimalen Test-Format.
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { ActionError, createEngine, createInitialState, formatAward } from '../server/engine.js';
import { createStore } from '../server/store.js';

// Ein Mini-Format: "tap" vergibt einen Punkt, "next" zählt hoch und endet nach 2 Schritten.
const tapFormat = {
  init: (content) => ({ steps: 0, max: content?.max ?? 2 }),
  actions: {
    next(fs, payload, api) {
      if (fs.steps >= fs.max) return api.endFormat();
      fs.steps += 1;
      api.sound('reveal');
    },
    tap(fs, { team }, api) {
      api.addPoints(team, 1);
      api.label(`Punkt für ${api.teams[team]}`);
    },
  },
};

function fakeRegistry() {
  const order = [
    { id: 'tap', name: 'Tap', color: '#D8C12F', playable: true },
    { id: 'soon', name: 'Bald', color: '#3DB2BE', playable: false },
  ];
  return {
    order,
    get: (id) => order.find((f) => f.id === id) ?? null,
    module: (id) => (id === 'tap' ? tapFormat : null),
    loadContent: () => ({ max: 2 }),
  };
}

const config = { teams: { A: 'Rot', B: 'Blau' } };

test('kompletter Ablauf: Übersicht → Intro → Format → Zwischenstand → Übersicht', () => {
  const engine = createEngine(fakeRegistry());
  let s = createInitialState(config);
  const run = (scope, name, payload) => {
    const r = engine.dispatch(s, { scope, name, payload });
    s = r.state;
    return r;
  };

  let r = run('core', 'next');
  assert.equal(s.phase, 'intro');
  assert.equal(s.current, 'tap');
  assert.deepEqual(r.effects, [{ sound: 'formatIntro' }]);

  run('core', 'next');
  assert.equal(s.phase, 'play');

  run('format', 'tap', { team: 'A' });
  run('format', 'tap', { team: 'A' });
  run('format', 'tap', { team: 'B' });
  assert.deepEqual(s.formatPoints, { A: 2, B: 1 });
  assert.deepEqual(s.totalPoints, { A: 0, B: 0 });

  run('core', 'next'); // step 1
  run('core', 'next'); // step 2
  r = run('core', 'next'); // Format endet von selbst
  assert.equal(s.phase, 'summary');
  assert.deepEqual(s.summary, {
    formatId: 'tap',
    formatPoints: { A: 2, B: 1 },
    winner: 'A',
    before: { A: 0, B: 0 },
    add: { A: 10, B: 0 }, // Sieger bekommt die Globalpunkte (Standard 10)
    step: 'result',
    applied: false,
  });
  assert.deepEqual(s.done, ['tap']);

  run('core', 'next'); // Formatsieger-Screen → Zwischenstand
  assert.equal(s.summary.step, 'standings');
  assert.deepEqual(s.totalPoints, { A: 0, B: 0 });

  r = run('core', 'next'); // übernehmen
  assert.equal(s.summary.applied, true);
  assert.deepEqual(s.totalPoints, { A: 10, B: 0 });
  assert.deepEqual(r.effects, [{ sound: 'scoreUpdate' }]);

  run('core', 'next'); // zur Übersicht
  assert.equal(s.phase, 'lobby');
  assert.equal(s.current, null);

  // Kein spielbares Format mehr übrig
  assert.throws(() => run('core', 'next'), ActionError);
});

test('ungültige Aktionen werfen ActionError und ändern nichts', () => {
  const engine = createEngine(fakeRegistry());
  const s = createInitialState(config);
  assert.throws(() => engine.dispatch(s, { scope: 'format', name: 'tap', payload: { team: 'A' } }), ActionError);
  assert.throws(() => engine.dispatch(s, { scope: 'core', name: 'startFormat', payload: { id: 'soon' } }), ActionError);
  assert.throws(() => engine.dispatch(s, { scope: 'core', name: 'nope' }), ActionError);
  assert.throws(() => engine.dispatch(s, { scope: 'core', name: '__proto__' }), ActionError);
  assert.throws(() => engine.dispatch(s, { scope: 'core', name: 'adjustPoints', payload: { scope: 'format', team: 'A', delta: 1 } }), ActionError);
  assert.deepEqual(s, createInitialState(config));
});

test('Korrekturen und Teamnamen', () => {
  const engine = createEngine(fakeRegistry());
  let s = createInitialState(config);
  s = engine.dispatch(s, { scope: 'core', name: 'adjustPoints', payload: { scope: 'total', team: 'B', delta: 3 } }).state;
  assert.equal(s.totalPoints.B, 3);
  s = engine.dispatch(s, { scope: 'core', name: 'setTeams', payload: { A: '  Füchse ', B: 'Eulen' } }).state;
  assert.deepEqual(s.teams, { A: 'Füchse', B: 'Eulen' });
  assert.throws(() => engine.dispatch(s, { scope: 'core', name: 'setTeams', payload: { A: '   ' } }), ActionError);
});

test('Ansicht: Kapitel, aktuelles Format, nächstes Format', () => {
  const engine = createEngine(fakeRegistry());
  let s = createInitialState(config);
  let v = engine.view(s, 'screen');
  assert.equal(v.next.id, 'tap');
  assert.equal(v.chapters.length, 2);
  assert.equal(v.chapters[1].playable, false);
  s = engine.dispatch(s, { scope: 'core', name: 'next' }).state;
  v = engine.view(s, 'screen');
  assert.equal(v.current.id, 'tap');
  assert.equal(v.current.number, 1);
  assert.equal(v.chapters[0].active, true);
});

test('Store: speichert, stellt nach Neustart wieder her, Rückgängig auch nach Neustart', () => {
  const dir = mkdtempSync(join(tmpdir(), 'quiz-'));
  try {
    const engine = createEngine(fakeRegistry());
    let store = createStore({ dataDir: dir, engine, config });
    assert.equal(store.restored, false);
    store.dispatch({ scope: 'core', name: 'next' });
    store.dispatch({ scope: 'core', name: 'next' });
    store.dispatch({ scope: 'format', name: 'tap', payload: { team: 'B' } });
    assert.equal(store.undoInfo().label, 'Punkt für Blau');

    // "Neustart"
    store = createStore({ dataDir: dir, engine, config });
    assert.equal(store.restored, true);
    assert.equal(store.state.phase, 'play');
    assert.deepEqual(store.state.formatPoints, { A: 0, B: 1 });

    const r = store.dispatch({ scope: 'core', name: 'undo' });
    assert.equal(r.animate, false);
    assert.deepEqual(store.state.formatPoints, { A: 0, B: 0 });

    // Wirkungslose Aktion landet nicht im Verlauf
    const count = store.undoInfo().count;
    store.dispatch({ scope: 'core', name: 'setTeams', payload: { A: 'Rot' } });
    assert.equal(store.undoInfo().count, count);

    store.dispatch({ scope: 'core', name: 'setTeams', payload: { A: 'Grün' } });
    store.dispatch({ scope: 'core', name: 'newGame' });
    assert.equal(store.state.phase, 'lobby');
    assert.equal(store.state.teams.A, 'Grün', 'Teamnamen bleiben bei Neues Spiel');
    assert.equal(store.undoInfo(), null);
    assert.throws(() => store.dispatch({ scope: 'core', name: 'undo' }), ActionError);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('Store: defekte Datei führt zu neuem Spiel statt Absturz', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'quiz-'));
  try {
    const { writeFileSync, readdirSync } = await import('node:fs');
    writeFileSync(join(dir, 'state.json'), '{ kaputt');
    const store = createStore({ dataDir: dir, engine: createEngine(fakeRegistry()), config });
    assert.equal(store.state.phase, 'lobby');
    assert.ok(readdirSync(dir).some((f) => f.startsWith('state.defekt-')));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('Eingabe-Helfer für Eingabemasken: cleanText und cleanInt', () => {
  const engine = createEngine(fakeRegistry());
  // über api in einer Format-Aktion erreichbar
  const probe = {
    init: () => ({ items: [] }),
    actions: {
      add(fs, { name, votes }, api) {
        fs.items.push({ name: api.cleanText(name, { max: 10, label: 'Name' }), votes: api.cleanInt(votes, { min: 0, max: 20, label: 'Stimmen' }) });
      },
    },
  };
  const reg = fakeRegistry();
  reg.module = () => probe;
  const e = createEngine(reg);
  let s = createInitialState(config);
  s = e.dispatch(s, { scope: 'core', name: 'next' }).state;
  s = e.dispatch(s, { scope: 'core', name: 'next' }).state;
  s = e.dispatch(s, { scope: 'format', name: 'add', payload: { name: '  Anna   Maria ', votes: '3' } }).state;
  assert.deepEqual(s.formatState.items, [{ name: 'Anna Maria', votes: 3 }]);
  for (const payload of [
    { name: '', votes: 1 },
    { name: 'x'.repeat(11), votes: 1 },
    { name: 5, votes: 1 },
    { name: 'ok', votes: 'abc' },
    { name: 'ok', votes: 21 },
    { name: 'ok', votes: 1.5 },
  ]) {
    assert.throws(() => e.dispatch(s, { scope: 'format', name: 'add', payload }), ActionError, JSON.stringify(payload));
  }
  assert.ok(engine);
});

test('Globalpunkte: Sieger bekommt den Wert, Verlierer 0, Gleichstand beide, pro Format abweichend', () => {
  const cfg = { sieger: 7, formate: { laender: 12 } };
  assert.deepEqual(formatAward('kategorien', { A: 3, B: 2 }, cfg), { winner: 'A', add: { A: 7, B: 0 } });
  assert.deepEqual(formatAward('kategorien', { A: 0, B: 5 }, cfg), { winner: 'B', add: { A: 0, B: 7 } });
  assert.deepEqual(formatAward('kategorien', { A: 4, B: 4 }, cfg), { winner: null, add: { A: 7, B: 7 } });
  assert.deepEqual(formatAward('laender', { A: 155, B: 100 }, cfg), { winner: 'A', add: { A: 12, B: 0 } });
  assert.deepEqual(formatAward('x', { A: 1, B: 0 }, {}), { winner: 'A', add: { A: 10, B: 0 } }, 'Standard 10');

  // über die Engine mit Konfiguration
  const engine = createEngine(fakeRegistry(), { globalpunkte: { sieger: 5 } });
  let s = createInitialState(config);
  for (const [scope, name, payload] of [['core', 'next'], ['core', 'next'], ['format', 'tap', { team: 'B' }], ['format', 'tap', { team: 'A' }], ['core', 'endFormat']]) {
    s = engine.dispatch(s, { scope, name, payload }).state;
  }
  assert.equal(s.summary.winner, null);
  assert.deepEqual(s.summary.add, { A: 5, B: 5 });
});
