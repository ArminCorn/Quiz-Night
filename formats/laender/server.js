// Länderraten – Zustandslogik (läuft auf dem Server)
//
// Pro Land vier Etappen, die nacheinander aufgedeckt werden und sichtbar
// bleiben: 1 Flaggenfarben, 2 Kontinent, 3 Umriss, 4 Tipp. Wer früher
// richtig rät, bekommt mehr Formatpunkte (Werte in content.json → "punkte").
//
// Zustand:
//   countries – spielbare Länder (Platzhalter sind schon herausgefiltert)
//   warnings  – übersprungene Einträge mit Grund (nur für den Gamemaster)
//   index     – aktuelles Land
//   stage     – 0 (noch nichts aufgedeckt) … 4
//   phase     – 'idle' | 'running' | 'answering' | 'resolved'
//   answering – Team, das gerade antwortet (nach einem Buzz)
//   tried     – { A, B }: hat in DIESER Etappe schon gebuzzert
//   result    – { team, stage, points } | null (nach der Auflösung)
//   results   – Liste aller Länder-Ergebnisse
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ASSETS = fileURLToPath(new URL('./assets/', import.meta.url));
const CONTINENTS = ['Europa', 'Asien', 'Afrika', 'Nordamerika', 'Südamerika', 'Ozeanien'];
const DEFAULT_POINTS = [100, 75, 55, 40];
const PLACEHOLDER = /\[(LAND|TIPP) EINTRAGEN\]/;
export const STAGES = ['Flaggenfarben', 'Kontinent', 'Umriss', 'Tipp'];

// SVGs werden nur bei Bedarf gelesen und zwischengespeichert – im Spielstand
// stehen nur Pfade, damit data/state.json klein bleibt.
const svgCache = new Map();
function svg(rel) {
  if (!rel) return null;
  if (!svgCache.has(rel)) {
    const file = ASSETS + rel;
    svgCache.set(rel, existsSync(file) ? readFileSync(file, 'utf8') : null);
  }
  return svgCache.get(rel);
}
const assetExists = (rel) => typeof rel === 'string' && /^[a-z0-9/_-]+\.svg$/i.test(rel) && !rel.includes('..') && existsSync(ASSETS + rel);

// Helligkeit (OKLab-L) für die neutrale Reihenfolge der Farbfelder
function lightness(hex) {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
}

/** Prüft einen JSON-Eintrag. Gibt { country } oder { problems } zurück. */
function checkEntry(e) {
  const problems = [];
  const name = typeof e?.name === 'string' ? e.name.trim() : '';
  const tipp = typeof e?.tipp === 'string' ? e.tipp.trim() : '';
  if (!name || PLACEHOLDER.test(name)) problems.push('Land fehlt');
  if (!tipp || PLACEHOLDER.test(tipp)) problems.push('Tipp fehlt');
  if (!/^[A-Za-z]{2}$/.test(e?.iso ?? '')) problems.push('ISO-Code fehlt');
  if (!CONTINENTS.includes(e?.kontinent)) problems.push(`Kontinent muss einer von ${CONTINENTS.join(', ')} sein`);
  const farben = Array.isArray(e?.farben) ? e.farben.map((f) => String(f).trim().toUpperCase()) : [];
  if (!farben.length || farben.some((f) => !/^#[0-9A-F]{6}$/.test(f))) problems.push('Farben fehlen oder sind keine #RRGGBB-Werte');
  if (!assetExists(e?.flagge)) problems.push('Flaggen-Datei fehlt');
  let umriss = e?.umriss;
  if (!assetExists(umriss)) problems.push('Umriss-Datei fehlt');
  else if (e.nurKernterritorium === false) {
    const voll = umriss.replace(/\.svg$/, '-voll.svg');
    if (assetExists(voll)) umriss = voll;
  }
  if (problems.length) return { problems };
  return {
    country: {
      iso: e.iso.toUpperCase(),
      name,
      kontinent: e.kontinent,
      // neutrale Reihenfolge: nach Helligkeit, Dubletten entfernt
      farben: [...new Set(farben)].sort((a, b) => lightness(a) - lightness(b)),
      tipp,
      umriss,
      flagge: e.flagge,
      beispiel: e.beispiel === true,
    },
  };
}

function validPoints(p) {
  return Array.isArray(p) && p.length === 4 && p.every((n) => Number.isInteger(n) && n >= 0) ? p : null;
}

export default {
  init(content, api) {
    const countries = [];
    const warnings = [];
    (Array.isArray(content?.laender) ? content.laender : []).forEach((entry, i) => {
      const { country, problems } = checkEntry(entry);
      if (country) countries.push(country);
      else warnings.push({ nr: i + 1, name: PLACEHOLDER.test(entry?.name ?? '') ? null : entry?.name ?? null, problems });
    });
    const punkte = validPoints(content?.punkte);
    if (!punkte) warnings.push({ nr: null, name: null, problems: ['"punkte" ungültig – nehme 100, 75, 55, 40'] });
    if (countries.length === 0) {
      api.fail('Keine spielbaren Länder – bitte formats/laender/content.json füllen (npm run land -- DE).');
    }
    return {
      punkte: punkte ?? DEFAULT_POINTS,
      countries,
      warnings,
      index: 0,
      stage: 0,
      phase: 'idle',
      answering: null,
      tried: { A: false, B: false },
      result: null,
      results: [],
    };
  },

  actions: {
    // Leertaste: nächste Etappe · ohne Treffer auflösen · nächstes Land · Formatende
    next(s, payload, api) {
      if (s.phase === 'answering') api.fail('Erst bewerten: R (richtig) oder F (falsch).');
      if (s.phase === 'resolved') {
        if (s.index + 1 >= s.countries.length) return api.endFormat();
        s.index += 1;
        s.stage = 0;
        s.phase = 'idle';
        s.result = null;
        s.answering = null;
        api.buzzer.reset();
        api.label(`Land ${s.index + 1}`);
        return;
      }
      if (s.stage >= 4) return resolve(s, api, null);
      s.stage += 1;
      s.phase = 'running';
      s.tried = { A: false, B: false };
      api.buzzer.open(['A', 'B']);
      api.label(`Etappe ${s.stage} aufgedeckt (${STAGES[s.stage - 1]})`);
    },

    // R: Antwort richtig
    correct(s, payload, api) {
      if (s.phase !== 'answering') api.fail('Gerade antwortet niemand.');
      const team = s.answering;
      const points = s.punkte[s.stage - 1];
      api.addPoints(team, points);
      api.sound('correct');
      resolve(s, api, { team, stage: s.stage, points });
      api.label(`Richtig: ${api.teams[team]} +${points}`);
    },

    // F: Antwort falsch – dieses Team ist für die Etappe gesperrt
    wrong(s, payload, api) {
      if (s.phase !== 'answering') api.fail('Gerade antwortet niemand.');
      const team = s.answering;
      const other = team === 'A' ? 'B' : 'A';
      s.answering = null;
      s.phase = 'running';
      api.sound('wrong');
      if (s.tried[other]) api.buzzer.reset();
      else api.buzzer.open([other]);
      api.label(`Falsch: ${api.teams[team]}`);
    },

    // Ohne Treffer auflösen (jederzeit während einer Etappe)
    resolve(s, payload, api) {
      if (s.phase !== 'running' && s.phase !== 'idle') api.fail(s.phase === 'answering' ? 'Erst bewerten: R oder F.' : 'Das Land ist schon aufgelöst.');
      resolve(s, api, null);
    },
  },

  // Buzz kam an (der Kern hat schon alle Buzzer gesperrt)
  onBuzz(s, team) {
    if (s.phase !== 'running' || s.tried[team]) return;
    s.tried[team] = true;
    s.answering = team;
    s.phase = 'answering';
  },

  view(s, role) {
    const c = s.countries[s.index];
    const resolved = s.phase === 'resolved';
    const show = (n) => role === 'host' || resolved || s.stage >= n;
    const stages = [
      show(1) ? { farben: c.farben } : null,
      show(2) ? { kontinent: c.kontinent } : null,
      show(3) ? { umriss: svg(c.umriss) } : null,
      show(4) ? { tipp: c.tipp } : null,
    ];
    const base = {
      landNr: s.index + 1,
      landTotal: s.countries.length,
      stage: s.stage,
      phase: s.phase,
      punkte: s.punkte,
      answering: s.answering,
      tried: s.tried,
      result: s.result,
      stages,
      // Ländername und Flagge erst bei der Auflösung (außer für den Gamemaster)
      name: role === 'host' || resolved ? c.name : null,
      flagge: role === 'host' || resolved ? svg(c.flagge) : null,
      umriss: role === 'host' || resolved ? svg(c.umriss) : null,
    };
    if (role !== 'host') return base;
    const next = s.countries[s.index + 1];
    return {
      ...base,
      iso: c.iso,
      beispiel: c.beispiel,
      nextName: next ? `${next.name}${next.beispiel ? ' (Beispiel)' : ''}` : null,
      warnings: s.warnings,
      results: s.results,
    };
  },
};

function resolve(s, api, result) {
  s.phase = 'resolved';
  s.answering = null;
  s.result = result;
  s.results.push({ landNr: s.index + 1, name: s.countries[s.index].name, ...(result ?? { team: null, stage: null, points: 0 }) });
  api.buzzer.reset();
  api.sound('reveal');
  if (!result) api.label(`${s.countries[s.index].name}: ohne Treffer aufgelöst`);
}
