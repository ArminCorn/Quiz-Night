// Geräte-Einstellungen, die KEIN Spielstand sind (z. B. Buzzer-Zuordnung).
// Liegen in data/settings.json, überleben „Neues Spiel“ und sind nicht
// rückgängig zu machen.
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// Tasten, die als Tastatur-Buzzer nicht erlaubt sind (vom Kern belegt).
export const RESERVED_KEYS = [' ', 'z'];

export function defaultSettings(config) {
  const keys = config?.buzzer?.keys ?? {};
  return {
    buzzer: {
      // Gamepad-Knopf je Team: { pad: Gamepad-Index, button: Knopf-Index, name: Gerätename } oder null
      gamepad: { A: null, B: null },
      // Tastatur-Ersatz je Team (ein Zeichen, klein geschrieben)
      keys: { A: normalizeKey(keys.A) ?? 'a', B: normalizeKey(keys.B) ?? 'l' },
    },
  };
}

export function createSettingsStore({ dataDir, config }) {
  mkdirSync(dataDir, { recursive: true });
  const file = join(dataDir, 'settings.json');
  let settings = defaultSettings(config);

  if (existsSync(file)) {
    try {
      settings = validate(JSON.parse(readFileSync(file, 'utf8')), settings);
    } catch (err) {
      console.error(`[settings] data/settings.json unlesbar (${err.message}) – Standardwerte.`);
    }
  }

  function save() {
    const tmp = `${file}.tmp`;
    writeFileSync(tmp, JSON.stringify(settings, null, 2));
    renameSync(tmp, file);
  }

  return {
    get: () => settings,
    /** Teil-Update der Buzzer-Einstellungen. Wirft bei ungültigen Werten. */
    updateBuzzer(patch) {
      const next = validate({ buzzer: { ...settings.buzzer, ...patch } }, settings);
      settings = next;
      save();
      return settings;
    },
  };
}

function normalizeKey(key) {
  if (typeof key !== 'string' || key.length !== 1) return null;
  const k = key.toLowerCase();
  return /^[a-z0-9äöüß]$/.test(k) && !RESERVED_KEYS.includes(k) ? k : null;
}

function validMapping(m) {
  if (m == null) return null;
  const pad = Number(m.pad);
  const button = Number(m.button);
  if (!Number.isInteger(pad) || pad < 0 || pad > 15) throw new Error('Ungültiger Gamepad-Index.');
  if (!Number.isInteger(button) || button < 0 || button > 63) throw new Error('Ungültiger Gamepad-Knopf.');
  return { pad, button, name: String(m.name ?? '').slice(0, 120) };
}

function validate(input, fallback) {
  const b = input?.buzzer ?? {};
  const gamepad = { A: validMapping(b.gamepad?.A), B: validMapping(b.gamepad?.B) };
  if (gamepad.A && gamepad.B && gamepad.A.pad === gamepad.B.pad && gamepad.A.button === gamepad.B.button) {
    throw new Error('Beide Teams haben denselben Gamepad-Knopf.');
  }
  const keys = { A: normalizeKey(b.keys?.A), B: normalizeKey(b.keys?.B) };
  if (!keys.A || !keys.B) throw new Error('Tastatur-Buzzer: bitte je einen Buchstaben oder eine Ziffer (nicht Leertaste oder Z).');
  if (keys.A === keys.B) throw new Error('Beide Teams haben dieselbe Taste.');
  return { ...fallback, buzzer: { gamepad, keys } };
}
