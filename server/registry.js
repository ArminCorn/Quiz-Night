// Lädt die Format-Registry (formats/index.js), prüft, welche Formate spielbar
// sind (Ordner mit server.js + client.js), und lädt deren Server-Logik.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const ID_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

export async function loadRegistry({ formatsDir, formatOrder = [] }) {
  const { default: entries } = await import(pathToFileURL(join(formatsDir, 'index.js')).href);
  if (!Array.isArray(entries)) throw new Error('formats/index.js muss ein Array exportieren.');

  const byId = new Map();
  for (const entry of entries) {
    if (!entry || !ID_PATTERN.test(entry.id ?? '')) {
      throw new Error(`Ungültige Format-id in formats/index.js: ${JSON.stringify(entry?.id)}`);
    }
    if (byId.has(entry.id)) throw new Error(`Format-id doppelt vergeben: ${entry.id}`);
    byId.set(entry.id, {
      id: entry.id,
      name: String(entry.name ?? entry.id),
      color: String(entry.color ?? '#C9C6BD'),
      playable: false,
    });
  }

  // Server-Module der spielbaren Formate laden.
  const modules = new Map();
  for (const format of byId.values()) {
    const dir = join(formatsDir, format.id);
    const serverFile = join(dir, 'server.js');
    const clientFile = join(dir, 'client.js');
    if (!existsSync(serverFile)) continue;
    if (!existsSync(clientFile)) {
      console.warn(`[formats] ${format.id}: server.js gefunden, aber client.js fehlt. Format bleibt deaktiviert.`);
      continue;
    }
    const { default: mod } = await import(pathToFileURL(serverFile).href);
    validateServerModule(format.id, mod);
    modules.set(format.id, mod);
    format.playable = true;
  }

  // Reihenfolge laut config.json, unbekannte ids ignorieren, fehlende anhängen.
  const order = [];
  for (const id of formatOrder) {
    if (!byId.has(id)) {
      console.warn(`[config] formatOrder enthält unbekanntes Format "${id}" – wird ignoriert.`);
      continue;
    }
    if (!order.includes(id)) order.push(id);
  }
  for (const id of byId.keys()) if (!order.includes(id)) order.push(id);

  return {
    order: order.map((id) => byId.get(id)),
    get: (id) => byId.get(id) ?? null,
    module: (id) => modules.get(id) ?? null,
    /** Liest formats/<id>/content.json frisch von der Platte (Änderungen greifen beim nächsten Formatstart). */
    loadContent(id) {
      const file = join(formatsDir, id, 'content.json');
      if (!existsSync(file)) return null;
      try {
        return JSON.parse(readFileSync(file, 'utf8'));
      } catch (err) {
        throw new Error(`formats/${id}/content.json ist kein gültiges JSON: ${err.message}`);
      }
    },
  };
}

function validateServerModule(id, mod) {
  const problems = [];
  if (!mod || typeof mod !== 'object') problems.push('kein default-Export');
  else {
    if (typeof mod.init !== 'function') problems.push('init(content, api) fehlt');
    if (mod.actions != null && typeof mod.actions !== 'object') problems.push('actions muss ein Objekt sein');
    if (mod.view != null && typeof mod.view !== 'function') problems.push('view(state, role) muss eine Funktion sein');
  }
  if (problems.length) throw new Error(`formats/${id}/server.js: ${problems.join(', ')}`);
}
