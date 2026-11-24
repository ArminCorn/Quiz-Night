// Tests für das Format „Länderraten“ mit der echten Registry.
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { ActionError, createEngine, createInitialState } from '../server/engine.js';
import { loadRegistry } from '../server/registry.js';

const formatsDir = join(fileURLToPath(new URL('..', import.meta.url)), 'formats');
const registry = await loadRegistry({ formatsDir, formatOrder: ['kategorien', 'quiz', 'laender'] });
const engine = createEngine(registry, { globalpunkte: { sieger: 10 } });

function start() {
  let s = createInitialState({ teams: { A: 'Rot', B: 'Blau' } });
  const run = (scope, name, payload) => {
    const r = engine.dispatch(s, { scope, name, payload });
    s = r.state;
    return r;
  };
  run('core', 'startFormat', { id: 'laender' });
  run('core', 'next'); // Intro → Spiel
  return { run, get: () => s, screen: () => engine.view(s, 'screen'), host: () => engine.view(s, 'host') };
}
const buzz = (run, team) => run('core', 'buzz', { team, source: 'key' });

test('Registry: Länderraten ist spielbar, Platzhalter werden übersprungen und gemeldet', () => {
  assert.equal(registry.get('laender').playable, true);
  const { get, host } = start();
  assert.equal(get().formatState.countries.length, 3);
  assert.equal(host().format.warnings.length, 7);
  assert.deepEqual(host().format.warnings[0].problems, ['Land fehlt', 'Tipp fehlt', 'ISO-Code fehlt', 'Kontinent muss einer von Europa, Asien, Afrika, Nordamerika, Südamerika, Ozeanien sein', 'Farben fehlen oder sind keine #RRGGBB-Werte', 'Flaggen-Datei fehlt', 'Umriss-Datei fehlt']);
  assert.equal(host().format.beispiel, true);
});

test('Treffer in Etappe 1: 100 Punkte, Auflösung, Sounds', () => {
  const { run, get, screen } = start();
  run('core', 'next'); // Etappe 1
  assert.deepEqual(get().buzzer.open, { A: true, B: true });
  let r = buzz(run, 'B');
  assert.deepEqual(r.effects, [{ sound: 'buzz' }, { buzz: 'B' }]);
  assert.equal(get().formatState.phase, 'answering');
  assert.equal(screen().format.answering, 'B');
  r = run('format', 'correct');
  assert.deepEqual(r.effects.map((e) => e.sound), ['correct', 'reveal']);
  assert.deepEqual(get().formatPoints, { A: 0, B: 100 });
  assert.deepEqual(screen().format.result, { team: 'B', stage: 1, points: 100 });
  assert.equal(screen().format.name, 'Japan');
  assert.ok(screen().format.flagge.startsWith('<svg'));
});

test('Falsch kostet nichts, sperrt das Team für die Etappe; Treffer in Etappe 4 = 40', () => {
  const { run, get } = start();
  run('core', 'next'); // Etappe 1
  buzz(run, 'A');
  const r = run('format', 'wrong');
  assert.deepEqual(r.effects, [{ sound: 'wrong' }]);
  assert.deepEqual(get().formatPoints, { A: 0, B: 0 });
  assert.deepEqual(get().buzzer.open, { A: false, B: true }, 'nur noch B darf');
  assert.equal(buzz(run, 'A').changed, false, 'A darf in dieser Etappe nicht nochmal');
  buzz(run, 'B');
  run('format', 'wrong');
  assert.deepEqual(get().buzzer.open, { A: false, B: false }, 'beide haben es versucht');
  run('core', 'next'); // Etappe 2: beide wieder frei
  assert.deepEqual(get().buzzer.open, { A: true, B: true });
  run('core', 'next'); // 3
  run('core', 'next'); // 4
  buzz(run, 'B');
  run('format', 'wrong');
  buzz(run, 'A');
  run('format', 'correct');
  assert.deepEqual(get().formatPoints, { A: 40, B: 0 });
  assert.deepEqual(get().formatState.result, { team: 'A', stage: 4, points: 40 });
});

test('Punkte je Etappe 100/75/55/40', () => {
  for (const [stage, points] of [[1, 100], [2, 75], [3, 55], [4, 40]]) {
    const { run, get } = start();
    for (let i = 0; i < stage; i++) run('core', 'next');
    buzz(run, 'A');
    run('format', 'correct');
    assert.equal(get().formatPoints.A, points, `Etappe ${stage}`);
  }
});

test('Kein Treffer: nach Etappe 4 löst die Leertaste mit 0 Punkten auf', () => {
  const { run, get, screen } = start();
  for (let i = 0; i < 4; i++) run('core', 'next');
  assert.equal(screen().format.name, null, 'Name vor der Auflösung nicht auf dem Beamer');
  assert.equal(screen().format.flagge, null, 'Flagge vor der Auflösung nicht auf dem Beamer');
  const r = run('core', 'next');
  assert.deepEqual(r.effects, [{ sound: 'reveal' }]);
  assert.equal(get().formatState.phase, 'resolved');
  assert.equal(get().formatState.result, null);
  assert.deepEqual(get().formatPoints, { A: 0, B: 0 });
  assert.equal(screen().format.name, 'Japan');
});

test('Beamer sieht Etappen erst nach dem Aufdecken', () => {
  const { run, screen, host } = start();
  assert.deepEqual(screen().format.stages, [null, null, null, null]);
  assert.ok(host().format.stages.every(Boolean), 'Gamemaster sieht alle Etappen');
  run('core', 'next');
  run('core', 'next');
  const st = screen().format.stages;
  assert.ok(st[0].farben && st[1].kontinent && st[2] === null && st[3] === null);
  assert.equal(screen().format.umriss, null);
  assert.equal(screen().format.iso, undefined);
});

test('Leertaste während einer Antwort ist gesperrt; Rückgängig nimmt den Buzz zurück', () => {
  const { run } = start();
  run('core', 'next');
  buzz(run, 'A');
  assert.throws(() => run('core', 'next'), ActionError);
});

test('Formatende: Formatsieger und Globalpunkte (Sieger und Gleichstand)', () => {
  // Sieger: A trifft zweimal, B einmal
  let t = start();
  for (const team of ['A', 'B', 'A']) {
    t.run('core', 'next');
    buzz(t.run, team);
    t.run('format', 'correct');
    t.run('core', 'next'); // weiter / Formatende nach dem letzten Land
  }
  assert.equal(t.get().phase, 'summary');
  assert.equal(t.get().summary.step, 'result');
  assert.deepEqual(t.get().summary.formatPoints, { A: 200, B: 100 });
  assert.equal(t.get().summary.winner, 'A');
  assert.deepEqual(t.get().summary.add, { A: 10, B: 0 });

  // Gleichstand: A und B je einmal in Etappe 1, drittes Land ohne Treffer
  t = start();
  for (const team of ['A', 'B', null]) {
    t.run('core', 'next');
    if (team) {
      buzz(t.run, team);
      t.run('format', 'correct');
    } else {
      t.run('format', 'resolve');
    }
    t.run('core', 'next');
  }
  assert.equal(t.get().summary.winner, null);
  assert.deepEqual(t.get().summary.add, { A: 10, B: 10 }, 'Gleichstand: beide bekommen die Globalpunkte');
});
