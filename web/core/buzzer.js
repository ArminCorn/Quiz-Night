// Buzzer-Eingang über die Gamepad-API.
//
// Die Arcade-Buttons hängen an einem USB-Encoder, der sich im Browser als
// EIN Gamepad mit mehreren Knöpfen meldet. Welcher Knopf zu welchem Team
// gehört, steht in den Einstellungen (Buzzer-Testscreen im Gamemaster-Fenster).
//
// Wo wird gelesen?
//  - Im Gamemaster-Fenster (hat am Abend den Fokus, dort wird getippt).
//  - Zusätzlich im Beamer-Fenster als Rückfallebene: Liefert der Browser die
//    Gamepad-Daten nur an eines der beiden Fenster, kommt der Buzz trotzdem an.
//    Doppelte Meldungen schaden nicht – der erste gültige Buzz sperrt auf dem
//    Server sofort alle weiteren.
//  - Nicht in der Beamer-Vorschau (iframe) im Gamemaster-Fenster.
//
// Hinweise zur Gamepad-API:
//  - Nur in „sicheren“ Seiten verfügbar. http://localhost zählt dazu.
//  - Der Browser meldet ein Gamepad erst, nachdem einmal ein Knopf gedrückt
//    wurde, während die Seite sichtbar war.
//  - Chrome fragt Gamepads etwa alle 16 ms ab. Drücken beide Teams innerhalb
//    desselben Abfragetakts, entscheidet das Los.

const POLL_MS = 8; // zusätzlich zu requestAnimationFrame (läuft auch, wenn rAF gedrosselt ist)

export function gamepadSupported() {
  return typeof navigator !== 'undefined' && typeof navigator.getGamepads === 'function';
}

/**
 * @param {object} handlers
 *   onTeam(team)               – zugeordneter Knopf eines Teams wurde gedrückt
 *   onButton({pad, button, name}) – irgendein Knopf wurde gedrückt (für „Zuordnen“)
 *   onChange(pads)             – Rohzustand hat sich geändert: [{ index, id, buttons: [bool] }]
 */
export function createGamepadReader({ onTeam, onButton, onChange } = {}) {
  let mapping = { A: null, B: null };
  const previous = new Map();
  let lastSignature = '';
  let running = true;

  function read() {
    if (!gamepadSupported()) return [];
    let list;
    try {
      list = [...navigator.getGamepads()];
    } catch {
      return []; // z. B. durch Permissions-Policy blockiert
    }
    return list
      .filter(Boolean)
      .map((pad) => ({
        index: pad.index,
        id: pad.id,
        buttons: pad.buttons.map((b) => Boolean(b.pressed || b.value > 0.5)),
      }));
  }

  function poll() {
    if (!running) return;
    const pads = read();
    const rising = [];
    for (const pad of pads) {
      pad.buttons.forEach((pressed, button) => {
        const key = `${pad.index}:${button}`;
        if (pressed && !previous.get(key)) rising.push({ pad: pad.index, button, name: pad.id });
        previous.set(key, pressed);
      });
    }

    if (rising.length) {
      for (const r of rising) onButton?.(r);
      const teams = ['A', 'B'].filter((team) => {
        const m = mapping[team];
        return m && rising.some((r) => r.pad === m.pad && r.button === m.button);
      });
      // Beide im selben Abfragetakt gedrückt → Los entscheidet die Reihenfolge
      if (teams.length === 2 && Math.random() < 0.5) teams.reverse();
      for (const team of teams) onTeam?.(team);
    }

    const signature = JSON.stringify(pads);
    if (signature !== lastSignature) {
      lastSignature = signature;
      onChange?.(pads);
    }
  }

  function frame() {
    poll();
    if (running) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  const timer = setInterval(poll, POLL_MS);
  const refresh = () => poll();
  window.addEventListener('gamepadconnected', refresh);
  window.addEventListener('gamepaddisconnected', refresh);

  return {
    setMapping(next) {
      mapping = { A: next?.A ?? null, B: next?.B ?? null };
    },
    /** Aktueller Rohzustand (für die erste Anzeige im Testscreen). */
    snapshot: read,
    stop() {
      running = false;
      clearInterval(timer);
      window.removeEventListener('gamepadconnected', refresh);
      window.removeEventListener('gamepaddisconnected', refresh);
    },
  };
}

/** Lesbare Beschreibung einer Zuordnung. */
export function describeMapping(m) {
  if (!m) return 'nicht zugeordnet';
  return `Gamepad ${m.pad + 1} · Knopf ${m.button + 1}`;
}
