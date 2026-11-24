// Spiel-Engine: verarbeitet Aktionen auf dem zentralen Spielzustand.
//
// Der Zustand ist ein reines JSON-Objekt. Jede Aktion arbeitet auf einer Kopie
// (Entwurf). Ändert sich nichts, gilt die Aktion als wirkungslos und landet
// nicht im Rückgängig-Verlauf.
//
// Phasen des Abends:
//   lobby   → Übersicht / Pausenbild mit Gesamtstand
//   intro   → Intro-Screen eines Formats
//   play    → das Format läuft (Formatpunkte sichtbar)
//   summary → Zwischenstand: Formatpunkte wandern in den Gesamtstand

export const TEAMS = ['A', 'B'];
const MAX_TEAM_NAME = 30;

export class ActionError extends Error {}

export function createInitialState({ teams }) {
  return {
    version: 1,
    teams: { A: teams.A, B: teams.B },
    phase: 'lobby',
    current: null,
    done: [],
    formatPoints: { A: 0, B: 0 },
    totalPoints: { A: 0, B: 0 },
    summary: null,
    formatState: null,
    buzzer: closedBuzzer(),
  };
}

/** Buzzer: wer darf buzzern (open) und wer hat zuerst gebuzzert (winner). */
export function closedBuzzer() {
  return { open: { A: false, B: false }, winner: null };
}

export function createEngine(registry) {
  const nextPlayable = (state) =>
    registry.order.find((f) => f.playable && !state.done.includes(f.id)) ?? null;

  // Schnittstelle, die Formate in init() und in ihren Aktionen bekommen.
  function makeApi(draft, fx) {
    return {
      teams: { ...draft.teams },
      addPoints(team, amount = 1) {
        assertTeam(team);
        assertInt(amount, 'Punkte');
        draft.formatPoints[team] += amount;
      },
      sound(name) {
        if (typeof name === 'string' && name) fx.effects.push({ sound: name });
      },
      endFormat() {
        fx.endFormat = true;
      },
      label(text) {
        fx.label = String(text);
      },
      fail(message) {
        throw new ActionError(message);
      },
      // Eingaben des Gamemasters prüfen (z. B. von Papierkarten abgetippt).
      // Immer benutzen, bevor Text oder Zahlen in den Zustand wandern.
      cleanText(value, { max = 200, label = 'Text', allowEmpty = false } = {}) {
        return cleanText(value, { max, label, allowEmpty });
      },
      cleanInt(value, { min = 0, max = 1000, label = 'Zahl' } = {}) {
        return cleanInt(value, { min, max, label });
      },
      // Buzzer steuern. Der erste gültige Buzz sperrt automatisch alles und
      // ruft onBuzz(state, team, api) des Formats auf.
      buzzer: {
        /** Freigeben, z. B. open(['A', 'B']) oder open(['B']). Setzt den letzten Buzz zurück. */
        open(teams = TEAMS) {
          for (const t of teams) assertTeam(t);
          draft.buzzer = { open: { A: teams.includes('A'), B: teams.includes('B') }, winner: null };
        },
        /** Alle sperren. Wer zuletzt gebuzzert hat, bleibt sichtbar. */
        lock() {
          draft.buzzer.open = { A: false, B: false };
        },
        /** Alle sperren und den letzten Buzz vergessen. */
        reset() {
          draft.buzzer = closedBuzzer();
        },
        /** Aktueller Stand: { open: { A, B }, winner } */
        get state() {
          return structuredClone(draft.buzzer);
        },
      },
    };
  }

  function startFormat(draft, id, fx) {
    const entry = registry.get(id);
    if (!entry) throw new ActionError(`Unbekanntes Format: ${id}`);
    if (!entry.playable) throw new ActionError(`${entry.name} ist noch nicht gebaut.`);
    const mod = registry.module(id);
    draft.current = id;
    draft.phase = 'intro';
    draft.buzzer = closedBuzzer();
    draft.formatPoints = { A: 0, B: 0 };
    draft.summary = null;
    draft.formatState = null;
    const content = registry.loadContent(id);
    draft.formatState = mod.init(content, makeApi(draft, fx)) ?? {};
    fx.effects.push({ sound: 'formatIntro' });
    fx.label = `${entry.name} gestartet`;
  }

  function endFormat(draft, fx) {
    if (draft.phase !== 'play' && draft.phase !== 'intro') {
      throw new ActionError('Gerade läuft kein Format.');
    }
    const id = draft.current;
    if (!draft.done.includes(id)) draft.done.push(id);
    draft.phase = 'summary';
    draft.buzzer = closedBuzzer();
    draft.summary = {
      formatId: id,
      before: { ...draft.totalPoints },
      add: { ...draft.formatPoints },
      applied: false,
    };
    fx.label = `${registry.get(id)?.name ?? id} beendet`;
  }

  function runFormatAction(draft, name, payload, fx) {
    if (draft.phase !== 'play') throw new ActionError('Das Format läuft gerade nicht.');
    const mod = registry.module(draft.current);
    const action = mod?.actions?.[name];
    if (typeof action !== 'function') throw new ActionError(`Unbekannte Aktion: ${name}`);
    const result = action(draft.formatState, payload ?? {}, makeApi(draft, fx));
    if (result !== undefined) draft.formatState = result;
    if (!fx.label) fx.label = name;
    if (fx.endFormat) endFormat(draft, fx);
  }

  const core = {
    // Leertaste: der jeweils nächste Schritt.
    next(draft, payload, fx) {
      switch (draft.phase) {
        case 'lobby': {
          const next = nextPlayable(draft);
          if (!next) throw new ActionError('Alle spielbaren Formate sind gespielt.');
          return startFormat(draft, next.id, fx);
        }
        case 'intro':
          draft.phase = 'play';
          fx.label = 'Intro beendet';
          return;
        case 'play': {
          const mod = registry.module(draft.current);
          if (typeof mod?.actions?.next !== 'function') {
            throw new ActionError('Dieses Format hat keinen „nächsten Schritt“.');
          }
          return runFormatAction(draft, 'next', payload, fx);
        }
        case 'summary':
          if (!draft.summary.applied) {
            for (const t of TEAMS) draft.totalPoints[t] += draft.summary.add[t];
            draft.summary.applied = true;
            fx.effects.push({ sound: 'scoreUpdate' });
            fx.label = 'Zwischenstand übernommen';
          } else {
            draft.phase = 'lobby';
            draft.current = null;
            draft.formatState = null;
            draft.formatPoints = { A: 0, B: 0 };
            draft.summary = null;
            draft.buzzer = closedBuzzer();
            fx.label = 'Zur Übersicht';
          }
          return;
      }
    },

    startFormat(draft, payload, fx) {
      if (draft.phase !== 'lobby') throw new ActionError('Formate lassen sich nur aus der Übersicht starten.');
      startFormat(draft, String(payload.id ?? ''), fx);
    },

    endFormat(draft, payload, fx) {
      endFormat(draft, fx);
    },

    // Buzzer gedrückt (Gamepad, Tastatur-Ersatz oder manuell durch den Gamemaster).
    // Nicht freigegeben → still ignorieren (keine Änderung, kein Rückgängig-Eintrag).
    buzz(draft, payload, fx) {
      const { team } = payload;
      assertTeam(team);
      if (draft.phase !== 'play' || !draft.buzzer?.open?.[team]) return;
      draft.buzzer = { open: { A: false, B: false }, winner: team };
      fx.effects.push({ sound: 'buzz' }, { buzz: team });
      fx.label = `Buzz: ${draft.teams[team]}${payload.source === 'manual' ? ' (manuell)' : ''}`;
      const mod = registry.module(draft.current);
      if (typeof mod?.onBuzz === 'function') {
        const result = mod.onBuzz(draft.formatState, team, makeApi(draft, fx));
        if (result !== undefined) draft.formatState = result;
        if (fx.endFormat) endFormat(draft, fx);
      }
    },

    adjustPoints(draft, payload, fx) {
      const { team, delta } = payload;
      const scope = payload.scope === 'total' ? 'total' : 'format';
      assertTeam(team);
      assertInt(delta, 'Korrektur');
      if (delta === 0 || Math.abs(delta) > 100) throw new ActionError('Ungültige Korrektur.');
      if (scope === 'format') {
        if (draft.phase !== 'play' && draft.phase !== 'intro') {
          throw new ActionError('Formatpunkte gibt es nur während eines Formats.');
        }
        draft.formatPoints[team] += delta;
      } else {
        draft.totalPoints[team] += delta;
        // Im Zwischenstand auch die Ausgangswerte mitziehen, damit die Animation stimmt.
        if (draft.summary && !draft.summary.applied) draft.summary.before[team] += delta;
      }
      const amount = `${delta > 0 ? '+' : '−'}${Math.abs(delta)}`;
      fx.label = scope === 'total'
        ? `Gesamtpunkte ${amount} für ${draft.teams[team]}`
        : `${amount} für ${draft.teams[team]}`;
    },

    setTeams(draft, payload, fx) {
      for (const t of TEAMS) {
        if (payload[t] == null) continue;
        const name = String(payload[t]).trim().slice(0, MAX_TEAM_NAME);
        if (!name) throw new ActionError('Teamnamen dürfen nicht leer sein.');
        draft.teams[t] = name;
      }
      fx.label = 'Teamnamen geändert';
    },
  };

  /**
   * Führt eine Aktion aus. Gibt { state, effects, label, changed } zurück.
   * Wirft ActionError bei ungültigen Aktionen (Zustand bleibt unverändert).
   */
  function dispatch(state, { scope, name, payload }) {
    const before = JSON.stringify(state);
    const draft = structuredClone(state);
    const fx = { effects: [], label: null, endFormat: false };
    const safePayload = payload && typeof payload === 'object' ? payload : {};

    if (scope === 'core') {
      const fn = Object.hasOwn(core, name) ? core[name] : null;
      if (!fn) throw new ActionError(`Unbekannte Aktion: ${name}`);
      fn(draft, safePayload, fx);
    } else if (scope === 'format') {
      runFormatAction(draft, String(name), safePayload, fx);
    } else {
      throw new ActionError(`Unbekannter Bereich: ${scope}`);
    }

    const changed = JSON.stringify(draft) !== before;
    return { state: draft, effects: fx.effects, label: fx.label, changed };
  }

  /** Baut die Ansicht für eine Rolle (screen | host | play). */
  function view(state, role) {
    const entry = state.current ? registry.get(state.current) : null;
    const mod = state.current ? registry.module(state.current) : null;
    const idx = entry ? registry.order.findIndex((f) => f.id === entry.id) : -1;
    const next = nextPlayable(state);

    let format = null;
    if (mod && state.formatState) {
      format = typeof mod.view === 'function' ? mod.view(state.formatState, role) : state.formatState;
    }

    return {
      phase: state.phase,
      teams: state.teams,
      formatPoints: state.formatPoints,
      totalPoints: state.totalPoints,
      summary: state.summary
        ? { ...state.summary, formatName: registry.get(state.summary.formatId)?.name ?? state.summary.formatId }
        : null,
      current: entry
        ? { id: entry.id, name: entry.name, color: entry.color, number: idx + 1, count: registry.order.length }
        : null,
      chapters: registry.order.map((f) => ({
        id: f.id,
        name: f.name,
        color: f.color,
        playable: f.playable,
        done: state.done.includes(f.id),
        active: f.id === state.current,
      })),
      next: next ? { id: next.id, name: next.name, color: next.color } : null,
      buzzer: state.buzzer ?? closedBuzzer(),
      format,
    };
  }

  /** Repariert einen geladenen Zustand, falls z. B. ein Format entfernt wurde. */
  function sanitize(state) {
    if (state.current && !registry.get(state.current)?.playable) {
      console.warn(`[state] Format "${state.current}" ist nicht mehr verfügbar – zurück zur Übersicht.`);
      state.phase = 'lobby';
      state.current = null;
      state.formatState = null;
      state.summary = null;
      state.formatPoints = { A: 0, B: 0 };
    }
    state.done = state.done.filter((id) => registry.get(id));
    if (!state.buzzer || state.phase !== 'play') state.buzzer = closedBuzzer();
    return state;
  }

  return { dispatch, view, sanitize };
}

function assertTeam(team) {
  if (!TEAMS.includes(team)) throw new ActionError(`Unbekanntes Team: ${team}`);
}

function assertInt(value, what) {
  if (!Number.isInteger(value)) throw new ActionError(`${what} muss eine ganze Zahl sein.`);
}

/** Text aus einer Eingabemaske: getrimmt, Leerraum vereinheitlicht, Länge begrenzt. */
export function cleanText(value, { max = 200, label = 'Text', allowEmpty = false } = {}) {
  if (typeof value !== 'string') throw new ActionError(`${label}: bitte Text eingeben.`);
  const text = value.replace(/\s+/g, ' ').trim();
  if (!text && !allowEmpty) throw new ActionError(`${label} darf nicht leer sein.`);
  if (text.length > max) throw new ActionError(`${label} ist zu lang (höchstens ${max} Zeichen).`);
  return text;
}

/** Ganze Zahl aus einer Eingabemaske (Zahl oder Text wie "3"), mit Grenzen. */
export function cleanInt(value, { min = 0, max = 1000, label = 'Zahl' } = {}) {
  const n = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  if (!Number.isInteger(n)) throw new ActionError(`${label}: bitte eine ganze Zahl eingeben.`);
  if (n < min || n > max) throw new ActionError(`${label} muss zwischen ${min} und ${max} liegen.`);
  return n;
}
