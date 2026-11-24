// Hauptfarben einer Flaggen-SVG nach Flächenanteil.
// Die Flagge wird gerendert (resvg, WebAssembly – keine Systemabhängigkeit),
// dann werden die Pixel gezählt. Kantenglättung und kleine Details (Wappen,
// Schrift) fallen unter die Schwelle, sehr ähnliche Töne werden zusammengefasst.
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { initWasm, Resvg } from '@resvg/resvg-wasm';

const require = createRequire(import.meta.url);
let ready = null;

async function init() {
  ready ??= initWasm(readFileSync(require.resolve('@resvg/resvg-wasm/index_bg.wasm')));
  return ready;
}

const hex = (r, g, b) => `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase()}`;

/** sRGB-Hex → OKLab [L, a, b] (für Helligkeit und Farbabstand) */
export function oklab(hexColor) {
  const n = parseInt(hexColor.slice(1), 16);
  const lin = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const [r, g, b] = lin;
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

const distance = (a, b) => Math.hypot(...oklab(a).map((v, i) => v - oklab(b)[i]));

/** Neutrale Reihenfolge: nach Helligkeit (dunkel → hell). Gibt keinen Hinweis auf die Anordnung in der Flagge. */
export function sortByLightness(colors) {
  return [...colors].sort((a, b) => oklab(a)[0] - oklab(b)[0]);
}

/**
 * @returns {{ main: {hex, share}[], minor: {hex, share}[] }}
 *   main  – Hauptfarben (Anteil ≥ minShare), Dubletten zusammengefasst
 *   minor – kleinere Anteile zur Kontrolle (nicht übernommen)
 */
export async function flagColors(svg, { minShare = 0.02, mergeDistance = 0.045 } = {}) {
  await init();
  const image = new Resvg(svg, { fitTo: { mode: 'width', value: 900 }, background: 'rgba(0,0,0,0)' }).render();
  const px = image.pixels;
  const counts = new Map();
  let total = 0;
  for (let i = 0; i < px.length; i += 4) {
    if (px[i + 3] !== 255) continue;
    total += 1;
    const key = (px[i] << 16) | (px[i + 1] << 8) | px[i + 2];
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  image.free?.();

  const candidates = [...counts]
    .map(([key, count]) => ({ hex: hex((key >> 16) & 255, (key >> 8) & 255, key & 255), share: count / total }))
    .filter((c) => c.share >= 0.002)
    .sort((a, b) => b.share - a.share);

  const merged = [];
  for (const c of candidates) {
    const near = merged.find((m) => distance(m.hex, c.hex) < mergeDistance);
    if (near) near.share += c.share;
    else merged.push({ ...c });
  }
  // Kantenmischfarben (Kantenglättung zwischen zwei größeren Flächen) verwerfen
  const isBlend = (c, bigger) => {
    const p = rgb(c.hex);
    for (let i = 0; i < bigger.length; i++) {
      for (let j = i + 1; j < bigger.length; j++) {
        const a = rgb(bigger[i].hex);
        const b = rgb(bigger[j].hex);
        const d = b.map((v, k) => v - a[k]);
        const len2 = d.reduce((sum, v) => sum + v * v, 0) || 1;
        const t = d.reduce((sum, v, k) => sum + v * (p[k] - a[k]), 0) / len2;
        if (t <= 0.03 || t >= 0.97) continue;
        const residual = Math.hypot(...p.map((v, k) => v - (a[k] + t * d[k])));
        if (residual < 6) return true;
      }
    }
    return false;
  };
  const kept = [];
  for (const c of merged) if (!isBlend(c, kept.filter((k) => k.share > c.share))) kept.push(c);

  return {
    main: kept.filter((c) => c.share >= minShare),
    minor: kept.filter((c) => c.share < minShare && c.share >= 0.004),
  };
}

function rgb(hexColor) {
  const n = parseInt(hexColor.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
