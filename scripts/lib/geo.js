// Umrisse und Weltkarte aus Natural Earth (Paket world-atlas, gemeinfrei).
// Wird nur von den Skripten benutzt, nie zur Laufzeit.
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { geoArea, geoAzimuthalEqualArea, geoCentroid, geoDistance } from 'd3-geo';
import { feature } from 'topojson-client';

const require = createRequire(import.meta.url);
const EARTH_KM = 6371;

let cache10m = null;
function topology10m() {
  cache10m ??= JSON.parse(readFileSync(require.resolve('world-atlas/countries-10m.json'), 'utf8'));
  return cache10m;
}

/** Land-Geometrie (GeoJSON-Feature) nach ISO-Nummerncode, z. B. "392" für Japan. */
export function findCountry(numericCode) {
  const topo = topology10m();
  const geom = topo.objects.countries.geometries.find((g) => g.id === numericCode);
  if (!geom) return null;
  return feature(topo, geom);
}

/** Alle Polygone eines Features als Liste von Polygon-Koordinaten. */
function polygonsOf(f) {
  const g = f.geometry;
  if (g.type === 'Polygon') return [g.coordinates];
  if (g.type === 'MultiPolygon') return g.coordinates;
  return [];
}

// Für Abstandsberechnungen: Stichprobe der Außenring-Punkte + Ausdehnung
function describe(poly) {
  const ring = poly[0];
  const step = Math.max(1, Math.floor(ring.length / 80));
  const sample = ring.filter((_, i) => i % step === 0);
  const lats = ring.map((p) => p[1]);
  return {
    poly,
    area: geoArea({ type: 'Polygon', coordinates: poly }),
    sample,
    minLat: Math.min(...lats),
    maxLat: Math.max(...lats),
    lonRange: lonInterval(ring.map((p) => p[0])),
  };
}

// Kleinstes Längengrad-Intervall, das alle Werte enthält (beachtet die Datumsgrenze)
function lonInterval(lons) {
  const sorted = [...lons].sort((a, b) => a - b);
  let bestGap = sorted[0] + 360 - sorted.at(-1);
  let start = sorted[0];
  for (let i = 1; i < sorted.length; i++) {
    const gap = sorted[i] - sorted[i - 1];
    if (gap > bestGap) {
      bestGap = gap;
      start = sorted[i];
    }
  }
  return { start, span: 360 - bestGap };
}

// Untergrenze für den Abstand zweier Polygone in km (schneller Vorfilter)
function boxGapKm(a, b) {
  const latGap = Math.max(0, a.minLat - b.maxLat, b.minLat - a.maxLat);
  const d = (((b.lonRange.start - a.lonRange.start) % 360) + 360) % 360;
  const gap1 = Math.max(0, d - a.lonRange.span);
  const gap2 = Math.max(0, 360 - d - b.lonRange.span);
  const lonGap = Math.min(gap1, gap2);
  const lat = Math.min(Math.abs(a.minLat), Math.abs(a.maxLat), Math.abs(b.minLat), Math.abs(b.maxLat));
  const lonKm = lonGap * 111.32 * Math.cos((Math.min(lat, 89) * Math.PI) / 180);
  return Math.max(latGap * 110.57, lonKm);
}

function distanceKm(a, b) {
  let min = Infinity;
  for (const p of a.sample) for (const q of b.sample) min = Math.min(min, geoDistance(p, q));
  return min * EARTH_KM;
}

/**
 * Kernterritorium: ausgehend vom größten Landesteil alle Teile, die höchstens
 * maxKm von einem bereits behaltenen Teil entfernt liegen (Inselketten bleiben,
 * weit entfernte Überseegebiete fallen weg).
 */
export function corePolygons(f, maxKm = 300) {
  const parts = polygonsOf(f).map(describe).sort((a, b) => b.area - a.area);
  const kept = [parts[0]];
  const rest = parts.slice(1);
  let added = true;
  while (added) {
    added = false;
    for (let i = rest.length - 1; i >= 0; i--) {
      const cand = rest[i];
      if (kept.some((k) => boxGapKm(k, cand) <= maxKm && distanceKm(k, cand) <= maxKm)) {
        kept.push(cand);
        rest.splice(i, 1);
        added = true;
      }
    }
  }
  return { kept: kept.map((p) => p.poly), dropped: rest.length, total: parts.length };
}

// Geschlossener Ring: am weitesten entfernten Punkt teilen, beide Hälften vereinfachen
function simplifyRing(points, tolerance) {
  if (points.length < 5) return points;
  const [x0, y0] = points[0];
  let far = 1;
  let farD = -1;
  for (let i = 1; i < points.length - 1; i++) {
    const d = Math.hypot(points[i][0] - x0, points[i][1] - y0);
    if (d > farD) {
      farD = d;
      far = i;
    }
  }
  const first = simplify(points.slice(0, far + 1), tolerance);
  const second = simplify(points.slice(far), tolerance);
  return [...first, ...second.slice(1)];
}

// Douglas-Peucker-Vereinfachung in Pixeln (offene Linie)
function simplify(points, tolerance) {
  if (points.length < 4) return points;
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [s, e] = stack.pop();
    let maxD = 0;
    let idx = -1;
    const [x1, y1] = points[s];
    const [x2, y2] = points[e];
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy) || 1;
    for (let i = s + 1; i < e; i++) {
      const d = Math.abs(dy * points[i][0] - dx * points[i][1] + x2 * y1 - y2 * x1) / len;
      if (d > maxD) {
        maxD = d;
        idx = i;
      }
    }
    if (maxD > tolerance && idx > 0) {
      keep[idx] = 1;
      stack.push([s, idx], [idx, e]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

function ringArea(points) {
  let a = 0;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    a += (points[j][0] + points[i][0]) * (points[j][1] - points[i][1]);
  }
  return Math.abs(a / 2);
}

/**
 * Umriss als eigenständige SVG: flächentreue Azimutalprojektion um die
 * Landesmitte, auf 1000 px skaliert, vereinfacht, Farbe per CSS (currentColor).
 */
export function outlineSvg(polygons, { size = 1000, pad = 16, tolerance = 1, minArea = 3 } = {}) {
  const geo = { type: 'MultiPolygon', coordinates: polygons };
  const [lon, lat] = geoCentroid(geo);
  const projection = geoAzimuthalEqualArea().rotate([-lon, -lat]).scale(1000).translate([0, 0]);

  const projected = polygons.map((poly) => poly.map((ring) => ring.map((p) => projection(p))));
  const all = projected.flat(2);
  const minX = Math.min(...all.map((p) => p[0]));
  const maxX = Math.max(...all.map((p) => p[0]));
  const minY = Math.min(...all.map((p) => p[1]));
  const maxY = Math.max(...all.map((p) => p[1]));
  const s = size / Math.max(maxX - minX, maxY - minY);
  const w = Math.round((maxX - minX) * s + 2 * pad);
  const h = Math.round((maxY - minY) * s + 2 * pad);

  const rings = [];
  for (const poly of projected) {
    for (const ring of poly) {
      const pts = ring.map(([x, y]) => [(x - minX) * s + pad, (y - minY) * s + pad]);
      const simple = simplifyRing(pts, tolerance);
      if (simple.length >= 4 && ringArea(simple) >= minArea) rings.push(simple);
    }
  }
  // Notfall (z. B. sehr kleine Inselstaaten): nichts wegwerfen
  if (rings.length === 0) {
    for (const poly of projected) for (const ring of poly) rings.push(ring.map(([x, y]) => [(x - minX) * s + pad, (y - minY) * s + pad]));
  }

  const d = rings.map((r) => `M${r.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join('L')}Z`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}"><path fill="currentColor" fill-rule="evenodd" d="${d}"/></svg>\n`;
}
