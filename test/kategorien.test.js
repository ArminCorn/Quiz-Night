// Tests für das Format „Kategorien“ mit der echten Registry.
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { ActionError, createEngine, createInitialState } from '../server/engine.js';
import { loadRegistry } from '../server/registry.js';

const formatsDir = join(fileURLToPath(new URL('..', import.meta.url)), 'formats');
const registry = await loadRegistry({ formatsDir, formatOrder: ['kategorien'] });
const engine = createEngine(registry);

function startKategorien() {
  let s = createInitialState({ teams: { A: 'Rot', B: 'Blau' } });
  const run = (scope, name, payload) => {
    const r = engine.dispatch(s, { scope, name, payload });
    s = r.state;
    return r;
  };
  run('core', 'startFormat', { id: 'kategorien' });
  run('core', 'next'); // Intro → Spiel
  return { run, get: () => s };
}

test('Registry: Kategorien ist spielbar, die anderen Formate sind Platzhalter', () => {
  assert.equal(registry.order[0].id, 'kategorien');
  assert.equal(registry.get('kategorien').playable, true);
  assert.equal(registry.order.length, 6);
  assert.equal(registry.order.filter((f) => f.playable).length, 1);
});

test('Beispiel-Inhalte sind als Beispiel erkennbar', () => {
  const content = registry.loadContent('kategorien');
  assert.equal(content.categories.length, 5);
  for (const c of content.categories) assert.match(typeof c === 'string' ? c : c.title, /^Beispiel/);
});

test('Runde: aufdecken → Punkt → nächste Kategorie, Beamer sieht die nächste nicht', () => {
  const { run, get } = startKategorien();
  let r = run('core', 'next');
  assert.deepEqual(r.effects, [{ sound: 'reveal' }]);
  assert.equal(get().formatState.stage, 'show');

  const screen = engine.view(get(), 'screen').format;
  const host = engine.view(get(), 'host').format;
  assert.equal(screen.round, 1);
  assert.equal(screen.next, undefined, 'Beamer kennt die nächste Kategorie nicht');
  assert.ok(host.next, 'Gamemaster sieht die nächste Kategorie');

  // Leertaste während der Runde ist nicht erlaubt
  assert.throws(() => run('core', 'next'), ActionError);

  r = run('format', 'roundWin', { team: 'B' });
  assert.deepEqual(r.effects, [{ sound: 'roundEnd' }]);
  assert.deepEqual(get().formatPoints, { A: 0, B: 1 });
  assert.equal(r.label, 'Punkt für Blau');

  // Zweiter Punkt in derselben Runde geht nicht
  assert.throws(() => run('format', 'roundWin', { team: 'A' }), ActionError);
});

test('Überspringen gibt keinen Punkt', () => {
  const { run, get } = startKategorien();
  run('core', 'next');
  run('format', 'skip');
  assert.deepEqual(get().formatPoints, { A: 0, B: 0 });
  assert.equal(get().formatState.results[0].winner, null);
});

test('Nach der letzten Kategorie beendet die Leertaste das Format', () => {
  const { run, get } = startKategorien();
  const total = get().formatState.items.length;
  for (let i = 0; i < total; i++) {
    run('core', 'next');
    run('format', 'roundWin', { team: i % 2 ? 'B' : 'A' });
  }
  run('core', 'next');
  assert.equal(get().phase, 'summary');
  assert.deepEqual(get().summary.add, { A: 3, B: 2 });
});
