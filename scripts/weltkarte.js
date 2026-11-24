// Erzeugt formats/laender/assets/weltkarte.svg (Kontinent-Silhouetten).
// Einmalig nötig; das Ergebnis liegt im Repository.
//   npm run weltkarte
import { writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { geoCentroid, geoDistance, geoEqualEarth, geoPath } from 'd3-geo';
import { feature, merge } from 'topojson-client';
import { mapContinent } from './lib/countries.js';

const require = createRequire(import.meta.url);
const out = new URL('../formats/laender/assets/weltkarte.svg', import.meta.url);
const topo = JSON.parse(readFileSync(require.resolve('world-atlas/countries-110m.json'), 'utf8'));
const geoms = topo.objects.countries.geometries;

// Länder ohne ISO-Nummer in Natural Earth
const BY_NAME = { Kosovo: 'Europa', 'N. Cyprus': 'Europa', Somaliland: 'Afrika' };
const MAX_KM = 1200; // weiter entfernte Landesteile gehören zum Kontinent des nächsten Nachbarn

// Mittelpunkte aller Länder (größter Landesteil), um Überseegebiete zuzuordnen
const centers = geoms.map((g) => {
  const f = feature(topo, g);
  const polys = f.geometry?.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry?.coordinates ?? [];
  return { g, polys, center: polys.length ? geoCentroid({ type: 'Polygon', coordinates: polys[0] }) : null };
});

const parts = new Map(); // Kontinent → [Pseudo-Geometrie mit arcs]
function add(continent, type, arcs) {
  if (!continent) return;
  if (!parts.has(continent)) parts.set(continent, []);
  parts.get(continent).push({ type, arcs });
}

for (const { g, polys, center } of centers) {
  const own = mapContinent(g.id) ?? BY_NAME[g.properties?.name] ?? null;
  if (!own) continue; // Antarktis und Gebiete ohne Kontinent bleiben weg
  if (g.type === 'Polygon') {
    add(own, 'Polygon', g.arcs);
    continue;
  }
  if (g.type !== 'MultiPolygon') continue;
  // Größter Landesteil zuerst (polys[0] ist nicht immer der größte – nach Punktzahl wählen)
  const main = polys.reduce((best, p, i) => (p[0].length > polys[best][0].length ? i : best), 0);
  const mainCenter = geoCentroid({ type: 'Polygon', coordinates: polys[main] });
  g.arcs.forEach((arcs, i) => {
    const c = geoCentroid({ type: 'Polygon', coordinates: polys[i] });
    if (geoDistance(c, mainCenter) * 6371 <= MAX_KM) return add(own, 'Polygon', arcs);
    // Überseegebiet → Kontinent des nächstgelegenen anderen Landes
    let best = null;
    for (const other of centers) {
      if (other.g === g || !other.center) continue;
      const d = geoDistance(c, other.center);
      if (!best || d < best.d) best = { d, cont: mapContinent(other.g.id) ?? BY_NAME[other.g.properties?.name] };
    }
    add(best?.cont ?? own, 'Polygon', arcs);
  });
}

const merged = [...parts].map(([name, list]) => ({ name, shape: merge(topo, list) }));
const collection = { type: 'FeatureCollection', features: merged.map((m) => ({ type: 'Feature', geometry: m.shape })) };
const width = 1000;
const projection = geoEqualEarth().fitWidth(width, collection);
const path = geoPath(projection).digits(1);
const [[, y0], [, y1]] = path.bounds(collection);
projection.translate([projection.translate()[0], projection.translate()[1] - y0 + 2]);
const height = Math.ceil(y1 - y0 + 4);
const body = merged.map((m) => `<path data-kontinent="${m.name}" d="${path(m.shape)}"/>`).join('\n');
writeFileSync(out, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">\n${body}\n</svg>\n`);
console.log(`Weltkarte geschrieben: ${merged.map((m) => m.name).join(', ')}`);
