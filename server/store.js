// Zustand + Rückgängig-Verlauf + Speicherung auf der Platte.
//
// Nach jeder Änderung wird data/state.json atomar geschrieben (erst in eine
// Temp-Datei, dann umbenennen). So übersteht der Spielstand Neuladen,
// Fensterabstürze und Server-Neustarts. Der Rückgängig-Verlauf wird mit
// gespeichert, Rückgängig funktioniert also auch nach einem Neustart.
import { copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ActionError, createInitialState } from './engine.js';

const HISTORY_LIMIT = 100;

export function createStore({ dataDir, engine, config }) {
  mkdirSync(dataDir, { recursive: true });
  const file = join(dataDir, 'state.json');

  let state;
  let history = []; // [{ label, state }] – Zustand VOR der jeweiligen Aktion
  let restored = false;

  load();

  function load() {
    if (existsSync(file)) {
      try {
        const saved = JSON.parse(readFileSync(file, 'utf8'));
        if (!saved?.state?.phase || !saved.state.teams) throw new Error('unbekanntes Format');
        state = engine.sanitize(saved.state);
        history = Array.isArray(saved.history) ? saved.history.slice(-HISTORY_LIMIT) : [];
        restored = true;
        return;
      } catch (err) {
        const broken = join(dataDir, `state.defekt-${timestamp()}.json`);
        try {
          copyFileSync(file, broken);
        } catch {}
        console.error(`[state] Gespeicherter Stand unlesbar (${err.message}). Kopie: ${broken}. Starte neu.`);
      }
    }
    state = createInitialState(config);
    history = [];
    save();
  }

  function save() {
    const tmp = `${file}.tmp`;
    try {
      writeFileSync(tmp, JSON.stringify({ savedAt: new Date().toISOString(), state, history }));
      renameSync(tmp, file);
    } catch (err) {
      console.error(`[state] Speichern fehlgeschlagen: ${err.message}`);
    }
  }

  /**
   * Führt eine Aktion aus.
   * Rückgabe: { changed, effects, animate }
   * Wirft ActionError bei ungültigen Aktionen.
   */
  function dispatch(action) {
    if (action.scope === 'core' && action.name === 'undo') return undo();
    if (action.scope === 'core' && action.name === 'newGame') return newGame();

    const result = engine.dispatch(state, action);
    if (!result.changed) return { changed: false, effects: result.effects, animate: true };

    history.push({ label: result.label ?? action.name, state });
    if (history.length > HISTORY_LIMIT) history.shift();
    state = result.state;
    save();
    return { changed: true, effects: result.effects, animate: true };
  }

  function undo() {
    const entry = history.pop();
    if (!entry) throw new ActionError('Nichts zum Rückgängigmachen.');
    state = engine.sanitize(entry.state);
    save();
    return { changed: true, effects: [], animate: false, undone: entry.label };
  }

  function newGame() {
    // Alten Stand zur Sicherheit aufheben, Teamnamen behalten.
    if (existsSync(file)) {
      try {
        copyFileSync(file, join(dataDir, `state.backup-${timestamp()}.json`));
      } catch {}
    }
    state = createInitialState({ teams: state.teams });
    history = [];
    save();
    return { changed: true, effects: [], animate: false };
  }

  return {
    dispatch,
    get state() {
      return state;
    },
    get restored() {
      return restored;
    },
    undoInfo() {
      const last = history.at(-1);
      return last ? { label: last.label, count: history.length } : null;
    },
  };
}

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}
