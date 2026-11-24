// Tests für das Länder-Werkzeug (Farben, Kontinente, Umrisse).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { flagColors, sortByLightness } from '../scripts/lib/colors.js';
import { lookupCountry, mapContinent } from '../scripts/lib/countries.js';
import { corePolygons, findCountry, outlineSvg } from '../scripts/lib/geo.js';
import { formatJson } from '../scripts/land.js';

const require = createRequire(import.meta.url);
const flag = (iso) => readFileSync(require.resolve(`svg-country-flags/svg/${iso}.svg`), 'utf8');
const hexes = (r) => r.main.map((c) => c.hex).sort();

test('Flaggenfarben: exakte Werte, keine Kantenmischfarben, Details unter der Schwelle', async () => {
  assert.deepEqual(hexes(await flagColors(flag('de'))), ['#000000', '#DD0000', '#FFCE00']);
  assert.deepEqual(hexes(await flagColors(flag('se'))), ['#006AA7', '#FECC00']);
  const us = await flagColors(flag('us'));
  assert.deepEqual(hexes(us), ['#3C3B6E', '#B22234', '#FFFFFF']);
  assert.equal(us.minor.length, 0, 'Kanten zwischen Streifen sind keine eigene Farbe');
  const es = await flagColors(flag('es'));
  assert.deepEqual(hexes(es), ['#C60B1E', '#FFC400'], 'Wappen wird ignoriert');
  assert.ok(es.minor.length > 0, 'Wappenfarben stehen zur Prüfung');
  const br = await flagColors(flag('br'), { minShare: 0.008 });
  assert.ok(hexes(br).includes('#FFFFFF'), 'mit gesenkter Schwelle kommt das Weiß dazu');
});

test('Neutrale Reihenfolge nach Helligkeit', () => {
  assert.deepEqual(sortByLightness(['#FFFFFF', '#000000', '#DD0000']), ['#000000', '#DD0000', '#FFFFFF']);
});

test('Länder-Lookup: deutscher Name, Kontinent, Grenzfälle', () => {
  assert.equal(lookupCountry('de').name, 'Deutschland');
  assert.equal(lookupCountry('DE').kontinent, 'Europa');
  assert.equal(lookupCountry('BR').kontinent, 'Südamerika');
  assert.ok(lookupCountry('RU').weitereKontinente.includes('Europa'), 'Russland als Grenzfall erkannt');
  assert.equal(lookupCountry('XX'), null);
  assert.equal(lookupCountry('DEU'), null);
  assert.equal(mapContinent('643'), 'Asien', 'Russland auf der Karte komplett Asien');
});

test('Kernterritorium: Überseegebiete fallen weg, nahe Inseln bleiben', () => {
  const fr = findCountry(lookupCountry('FR').numeric);
  const core = corePolygons(fr, 300);
  assert.ok(core.dropped >= 5, 'Französische Überseegebiete weggelassen');
  // Korsika (≈ 42° N, 9° E) bleibt
  assert.ok(core.kept.some((p) => p[0].some(([lon, lat]) => lon > 8.5 && lon < 9.6 && lat > 41.3 && lat < 43)));
  // Französisch-Guayana (≈ 4° N) ist weg
  assert.ok(!core.kept.some((p) => p[0].some(([, lat]) => lat < 10)));
  const us = corePolygons(findCountry(lookupCountry('US').numeric), 300);
  assert.ok(!us.kept.some((p) => p[0].some(([lon]) => lon < -130)), 'Alaska und Hawaii weggelassen');
});

test('Umriss-SVG: eigenständig, ohne Farbe im Code, handliche Größe', () => {
  const se = findCountry(lookupCountry('SE').numeric);
  const svg = outlineSvg(corePolygons(se).kept);
  assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 \d+ \d+"><path fill="currentColor"/);
  assert.ok(svg.length < 60_000, `zu groß: ${svg.length}`);
});

test('JSON-Ausgabe: Listen einzeilig', () => {
  assert.equal(formatJson({ a: [1, 2], b: ['#FFF', '#000'] }), '{\n  "a": [1, 2],\n  "b": ["#FFF", "#000"]\n}\n');
});
