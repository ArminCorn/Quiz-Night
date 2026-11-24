// Lädt automatisch alle Formate, die einen Ordner formats/<id>/client.js haben.
// Kein Eintrag im Kern nötig – Vite findet die Dateien beim Build selbst.

const modules = import.meta.glob('../../formats/*/client.js', { eager: true, import: 'default' });

const clients = {};
for (const [path, mod] of Object.entries(modules)) {
  const id = path.split('/').at(-2);
  clients[id] = mod;
}

/** Client-Modul eines Formats (oder null). */
export function formatClient(id) {
  return (id && clients[id]) || null;
}

/** Beschriftung auflösen: Text oder Funktion(view) → Text */
export function resolveLabel(label, view) {
  return typeof label === 'function' ? label(view) : label;
}

/** Alle Client-Module (id → Modul), z. B. um Tastenkonflikte zu prüfen. */
export function allFormatClients() {
  return { ...clients };
}
