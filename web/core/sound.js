// Sound-Modul mit benannten Platzhaltern.
//
// Die Dateien liegen im Ordner sounds/ (Dateiname = Soundname, z. B.
// sounds/reveal.mp3). Der Server liefert unter /api/sounds die Liste der
// vorhandenen Dateien. Fehlt eine Datei, passiert stillschweigend nichts.

/** Bekannte Namen – Formate dürfen zusätzlich eigene verwenden. */
export const SOUND_NAMES = ['formatIntro', 'reveal', 'roundEnd', 'correct', 'wrong', 'scoreUpdate'];

const sounds = new Map();
let enabled = true;

export async function initSounds() {
  try {
    const res = await fetch('/api/sounds', { cache: 'no-store' });
    const manifest = await res.json();
    for (const [name, url] of Object.entries(manifest)) {
      const audio = new Audio(url);
      audio.preload = 'auto';
      sounds.set(name, audio);
    }
  } catch {
    // Kein Manifest → keine Sounds. Kein Fehler.
  }
}

export function setSoundEnabled(value) {
  enabled = Boolean(value);
}

export function playSound(name) {
  if (!enabled) return;
  const base = sounds.get(name);
  if (!base) return;
  try {
    // Kopie, damit derselbe Sound sich überlappen darf
    const audio = base.cloneNode();
    audio.play()?.catch(() => {});
  } catch {
    // Browser blockiert Ton (noch nicht ins Fenster geklickt) → still bleiben
  }
}
