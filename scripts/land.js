// Legt ein Land für „Länderraten“ an oder aktualisiert es.
//
//   npm run land -- DE              Deutschland anlegen
//   npm run land -- BR --min 0.8    Farben ab 0,8 % Flächenanteil übernehmen (Standard 2 %)
//   npm run land -- NO --km 700     Kernterritorium großzügiger fassen (Standard 300 km)
//
// Erzeugt: Flaggen-SVG, Umriss-SVG (Kernterritorium und vollständig) und den
// Eintrag in formats/laender/content.json mit Name, Kontinent und Flaggenfarben.
// Nur der Tipp bleibt als Platzhalter "[TIPP EINTRAGEN]".
//
// Bei einem schon vorhandenen Land werden Flagge, Umriss und Farben neu
// erzeugt; Name, Kontinent, Tipp und die Schalter bleiben, wie sie sind.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { flagColors, sortByLightness } from './lib/colors.js';
import { lookupCountry } from './lib/countries.js';
import { corePolygons, findCountry, outlineSvg } from './lib/geo.js';

const require = createRequire(import.meta.url);
const FORMAT_DIR = fileURLToPath(new URL('../formats/laender/', import.meta.url));
const ASSETS = `${FORMAT_DIR}assets/`;
const CONTENT = `${FORMAT_DIR}content.json`;
export const PLACEHOLDER_NAME = '[LAND EINTRAGEN]';
export const PLACEHOLDER_TIPP = '[TIPP EINTRAGEN]';

function parseArgs(argv) {
  const args = { iso: null, min: 2, km: 300 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--min') args.min = Number(argv[++i]);
    else if (a === '--km') args.km = Number(argv[++i]);
    else if (!a.startsWith('--')) args.iso = a;
  }
  return args;
}

function fail(message) {
  console.error(`\n  Fehler: ${message}\n`);
  process.exit(1);
}

/** Flaggen-SVG säubern: keine Skripte, keine Ereignisse, keine externen Verweise. */
function sanitizeSvg(svg) {
  return svg
    .replace(/<\?xml[^>]*>\s*/g, '')
    .replace(/<!DOCTYPE[^>]*>\s*/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, '')
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*')/gi, '')
    .replace(/\s(xlink:)?href\s*=\s*("(?!#)[^"]*"|'(?!#)[^']*')/gi, '')
    .trim();
}

/** JSON mit Zahlen-/Textlisten in einer Zeile (besser lesbar beim Bearbeiten). */
export function formatJson(value) {
  return `${JSON.stringify(value, null, 2).replace(/\[\s+((?:"[^"\n]*"|-?\d+(?:\.\d+)?)(?:,\s+(?:"[^"\n]*"|-?\d+(?:\.\d+)?))*)\s+\]/g, (m, inner) => `[${inner.replace(/,\s+/g, ', ')}]`)}\n`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.iso) fail('Bitte einen ISO-Code angeben, z. B.  npm run land -- DE');
  const country = lookupCountry(args.iso);
  if (!country) fail(`„${args.iso}“ ist kein gültiger ISO-3166-Code (zwei Buchstaben, z. B. DE, FR, JP).`);
  const iso = country.iso;
  const lower = iso.toLowerCase();

  // ---- Flagge
  let flagSource;
  try {
    flagSource = require.resolve(`svg-country-flags/svg/${lower}.svg`);
  } catch {
    fail(`Keine Flagge für ${iso} im Paket svg-country-flags gefunden.`);
  }
  const flag = sanitizeSvg(readFileSync(flagSource, 'utf8'));
  writeFileSync(`${ASSETS}flaggen/${lower}.svg`, `${flag}\n`);

  // ---- Farben
  const { main: mainColors, minor } = await flagColors(flag, { minShare: args.min / 100 });
  const farben = sortByLightness(mainColors.map((c) => c.hex));

  // ---- Umriss
  const geo = findCountry(country.numeric);
  if (!geo) fail(`Kein Umriss für ${iso} in Natural Earth gefunden.`);
  const core = corePolygons(geo, args.km);
  const allPolys = geo.geometry.type === 'Polygon' ? [geo.geometry.coordinates] : geo.geometry.coordinates;
  const coreSvg = outlineSvg(core.kept);
  const fullSvg = outlineSvg(allPolys);
  writeFileSync(`${ASSETS}umrisse/${lower}.svg`, coreSvg);
  writeFileSync(`${ASSETS}umrisse/${lower}-voll.svg`, fullSvg);

  // ---- Eintrag
  const content = JSON.parse(readFileSync(CONTENT, 'utf8'));
  content.laender ??= [];
  const generated = { farben, umriss: `umrisse/${lower}.svg`, flagge: `flaggen/${lower}.svg` };
  let entry = content.laender.find((l) => String(l.iso ?? '').toUpperCase() === iso);
  let action;
  if (entry) {
    const oldColors = JSON.stringify(entry.farben ?? []);
    Object.assign(entry, generated);
    action = 'aktualisiert';
    if (oldColors !== JSON.stringify(farben)) console.log(`  Hinweis: Farben neu ausgelesen (vorher ${oldColors}).`);
  } else {
    entry = {
      iso,
      name: country.shortName ?? country.name,
      kontinent: country.kontinent ?? 'Europa',
      ...generated,
      tipp: PLACEHOLDER_TIPP,
      nurKernterritorium: true,
      beispiel: false,
    };
    const slot = content.laender.findIndex((l) => l.name === PLACEHOLDER_NAME);
    if (slot >= 0) content.laender[slot] = entry;
    else content.laender.push(entry);
    action = slot >= 0 ? 'angelegt (ersetzt einen Platzhalter)' : 'angelegt (am Ende angehängt)';
  }
  writeFileSync(CONTENT, formatJson(content));

  // ---- Ausgabe
  const kb = (s) => `${Math.round(Buffer.byteLength(s) / 1024)} KB`;
  console.log('');
  console.log(`  ${entry.name} (${iso}) ${action}`);
  console.log('');
  console.log(`  Kontinent:   ${entry.kontinent}${country.weitereKontinente.length ? `   (Grenzfall – auch: ${country.weitereKontinente.join(', ')}; in der JSON anpassbar)` : ''}`);
  console.log(`  Flagge:      assets/${generated.flagge}`);
  console.log(`  Umriss:      assets/${generated.umriss} (${kb(coreSvg)})` + (core.dropped ? ` – ${core.dropped} von ${core.total} Landesteilen weggelassen (weiter als ${args.km} km entfernt)` : ''));
  console.log(`               assets/umrisse/${lower}-voll.svg (${kb(fullSvg)}) – vollständig, für "nurKernterritorium": false`);
  console.log('');
  console.log('  Flaggenfarben (bitte prüfen):');
  for (const c of mainColors) console.log(`    ${c.hex}  ${(c.share * 100).toFixed(1).padStart(5)} %`);
  if (minor.length) {
    console.log(`  Kleinere Farbflächen (nicht übernommen, unter ${args.min} %):`);
    for (const c of minor) console.log(`    ${c.hex}  ${(c.share * 100).toFixed(1).padStart(5)} %   ← gehört sie zur Flagge? Dann in "farben" ergänzen oder --min senken`);
  }
  console.log('');
  if (entry.tipp === PLACEHOLDER_TIPP) {
    console.log(`  Noch zu tun: in formats/laender/content.json den "tipp" für ${entry.name} eintragen.`);
    console.log('  Bis dahin wird das Land im Spiel übersprungen.');
    console.log('');
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((err) => fail(err.message));
}
