// Quiz Night – lokaler Server
//
// - liefert die Seiten aus (/screen, /host) – nur auf diesem Laptop (127.0.0.1)
// - hält den Spielzustand zentral und synchronisiert alle Fenster per WebSocket (/ws)
// - speichert den Stand laufend in data/state.json
//
// Start: `npm start` (baut das Frontend und startet den Server)
// Entwicklung: `npm run dev` (Vite mit Hot Reload, ohne Build)
import express from 'express';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { ActionError, createEngine } from './engine.js';
import { loadRegistry } from './registry.js';
import { createSettingsStore } from './settings.js';
import { createStore } from './store.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DEV = process.argv.includes('--dev');
const ROLES = ['screen', 'host'];
const PAGES = { '/': 'index.html', '/screen': 'screen/index.html', '/host': 'host/index.html' };
const AUDIO_EXT = new Set(['.mp3', '.ogg', '.wav', '.m4a', '.aac', '.webm', '.flac']);

const config = loadConfig();
const registry = await loadRegistry({ formatsDir: join(ROOT, 'formats'), formatOrder: config.formatOrder });
const engine = createEngine(registry);
const dataDir = process.env.QUIZ_DATA_DIR ? resolve(process.env.QUIZ_DATA_DIR) : join(ROOT, 'data');
const store = createStore({ dataDir, engine, config });
const settings = createSettingsStore({ dataDir, config });

// Buzzer-Testmodus: solange der Testscreen im Gamemaster-Fenster offen ist,
// lösen Buzzer im Spiel nichts aus. Gilt nur, solange dieses Fenster verbunden ist.
let buzzerTestOwner = null;

// ---------------------------------------------------------------- HTTP

// Der Server ist nur über localhost erreichbar. Zusätzlich werden Anfragen mit
// fremdem Host-/Origin-Header abgelehnt, damit keine andere Webseite im Browser
// des Laptops den Spielstand steuern kann (Schutz vor DNS-Rebinding und
// Cross-Site-WebSocket).
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);
function hostnameOf(value) {
  try {
    return new URL(value.includes('://') ? value : `http://${value}`).hostname.toLowerCase();
  } catch {
    return null;
  }
}
function isLocalHost(value) {
  const name = value ? hostnameOf(value) : null;
  return name !== null && (LOCAL_HOSTS.has(name) || name.endsWith('.localhost'));
}

const app = express();
const server = createServer(app);
app.disable('x-powered-by');
app.use((req, res, next) => {
  if (isLocalHost(req.headers.host)) return next();
  res.status(403).type('text').send('Quiz Night ist nur über localhost erreichbar.');
});

// Allgemeine Einstellungen für alle Ansichten (Titel usw.)
app.get('/api/config', (req, res) => {
  res.json({ title: config.title, subtitle: config.subtitle });
});

// Sound-Manifest: welche Dateien liegen in sounds/? (Name ohne Endung → URL)
const soundsDir = join(ROOT, 'sounds');
app.get('/api/sounds', (req, res) => {
  const manifest = {};
  try {
    for (const file of readdirSync(soundsDir)) {
      const ext = extname(file).toLowerCase();
      if (!AUDIO_EXT.has(ext)) continue;
      manifest[file.slice(0, -ext.length)] = `/sounds/${encodeURIComponent(file)}`;
    }
  } catch {}
  res.set('Cache-Control', 'no-store').json(manifest);
});
app.use('/sounds', express.static(soundsDir, { fallthrough: false }));

if (DEV) {
  const { createServer: createVite } = await import('vite');
  const vite = await createVite({
    configFile: join(ROOT, 'vite.config.js'),
    server: { middlewareMode: true, hmr: { server } },
    appType: 'mpa',
  });
  // /screen → /screen/ (relative Pfade der Unterseiten brauchen den Schrägstrich)
  app.use((req, res, next) => {
    const [path, query] = req.url.split('?');
    if (PAGES[path] && path !== '/') return res.redirect(`${path}/${query ? `?${query}` : ''}`);
    next();
  });
  app.use(vite.middlewares);
} else {
  const dist = join(ROOT, 'dist');
  if (!existsSync(join(dist, 'index.html'))) {
    console.warn('\n[web] Kein Build gefunden (Ordner dist/). Bitte mit `npm start` starten.\n');
  }
  for (const [route, file] of Object.entries(PAGES)) {
    app.get(route, (req, res) => {
      const target = join(dist, file);
      if (existsSync(target)) res.set('Cache-Control', 'no-cache').sendFile(target);
      else res.status(503).type('text').send('Frontend nicht gebaut. Bitte mit `npm start` starten.');
    });
  }
  app.use(express.static(dist, { index: false }));
}

// ---------------------------------------------------------------- WebSocket

const wss = new WebSocketServer({ noServer: true, maxPayload: 64 * 1024 });
let seq = 0;

server.on('upgrade', (req, socket, head) => {
  if (new URL(req.url, 'http://x').pathname !== '/ws') return; // z. B. Vite-HMR im Dev-Modus
  const origin = req.headers.origin;
  if (!isLocalHost(req.headers.host) || (origin && !isLocalHost(origin))) {
    socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');
    return socket.destroy();
  }
  wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
});

function stateMessage(role, { effects = [], animate = false } = {}) {
  const view = engine.view(store.state, role);
  if (role === 'host') view.undo = store.undoInfo();
  return JSON.stringify({ t: 'state', seq, view, effects, animate });
}

function settingsMessage() {
  return JSON.stringify({ t: 'settings', settings: settings.get(), buzzerTest: Boolean(buzzerTestOwner) });
}

function broadcastSettings() {
  const msg = settingsMessage();
  for (const client of wss.clients) if (client.readyState === 1 && client.role) client.send(msg);
}

function broadcast(result) {
  seq += 1;
  const cache = {};
  for (const client of wss.clients) {
    if (client.readyState !== 1 || !client.role) continue;
    cache[client.role] ??= stateMessage(client.role, result);
    client.send(cache[client.role]);
  }
}

wss.on('connection', (ws) => {
  ws.isAlive = true;
  ws.on('pong', () => (ws.isAlive = true));
  ws.on('close', () => {
    if (buzzerTestOwner === ws) {
      buzzerTestOwner = null;
      broadcastSettings();
    }
  });

  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }

    if (msg.t === 'hello') {
      ws.role = ROLES.includes(msg.role) ? msg.role : 'screen';
      ws.send(stateMessage(ws.role));
      ws.send(settingsMessage());
      return;
    }

    if (msg.t === 'settings') {
      if (ws.role !== 'host') return sendError(ws, 'Nur die Gamemaster-Ansicht darf Einstellungen ändern.');
      try {
        settings.updateBuzzer(msg.buzzer ?? {});
        broadcastSettings();
      } catch (err) {
        sendError(ws, err.message);
        ws.send(settingsMessage()); // Anzeige auf den gespeicherten Stand zurücksetzen
      }
      return;
    }

    if (msg.t === 'buzzerTest') {
      if (ws.role !== 'host') return;
      if (msg.on) buzzerTestOwner = ws;
      else if (buzzerTestOwner === ws) buzzerTestOwner = null;
      broadcastSettings();
      return;
    }

    if (msg.t === 'action') {
      const isBuzz = msg.scope === 'core' && msg.name === 'buzz';
      // Das Beamer-Fenster liest die Buzzer als Rückfallebene mit, darf aber nur buzzern.
      if (ws.role !== 'host' && !(ws.role === 'screen' && isBuzz)) {
        return sendError(ws, 'Nur die Gamemaster-Ansicht darf steuern.');
      }
      if (isBuzz && buzzerTestOwner) return; // Testscreen offen → Buzz zählt nicht
      try {
        const result = store.dispatch({ scope: msg.scope, name: msg.name, payload: msg.payload });
        if (result.changed) broadcast(result);
      } catch (err) {
        if (!(err instanceof ActionError)) console.error('[action]', msg.scope, msg.name, err);
        sendError(ws, err.message);
      }
    }
  });
});

function sendError(ws, message) {
  if (ws.readyState === 1) ws.send(JSON.stringify({ t: 'error', message }));
}

// Tote Verbindungen aufräumen
const heartbeat = setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.isAlive) {
      ws.terminate();
      continue;
    }
    ws.isAlive = false;
    ws.ping();
  }
}, 15000);
wss.on('close', () => clearInterval(heartbeat));

// ---------------------------------------------------------------- Start

const port = process.env.PORT != null ? Number(process.env.PORT) : config.port;
const HOST = '127.0.0.1'; // bewusst nur lokal: kein WLAN, keine anderen Geräte
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\nPort ${port} ist schon belegt. Läuft Quiz Night bereits in einem anderen Fenster?`);
    console.error('Entweder das andere Fenster schließen oder in config.json einen anderen "port" eintragen.\n');
    process.exit(1);
  }
  throw err;
});

server.listen(port, HOST, () => {
  const actual = server.address().port;
  const playable = registry.order.filter((f) => f.playable).map((f) => f.name);
  console.log('');
  console.log(`  QUIZ NIGHT läuft${DEV ? ' (Entwicklungsmodus)' : ''}`);
  console.log('');
  console.log(`  Gamemaster (Laptop):   http://localhost:${actual}/host`);
  console.log(`  Beamer (Vollbild):     http://localhost:${actual}/screen`);
  console.log('  Nur auf diesem Laptop erreichbar. Kein WLAN und kein Internet nötig.');
  console.log('');
  console.log(`  Spielbare Formate: ${playable.join(', ') || '–'}`);
  console.log(store.restored ? '  Letzter Spielstand wiederhergestellt.' : '  Neues Spiel angelegt.');
  console.log('  Beenden mit Strg+C');
  console.log('');
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    console.log('\nQuiz Night wird beendet. Der Spielstand ist gespeichert.');
    process.exit(0);
  });
}

// ---------------------------------------------------------------- Hilfen

function loadConfig() {
  const defaults = {
    title: 'Quiz Night',
    subtitle: '',
    teams: { A: 'Team A', B: 'Team B' },
    formatOrder: [],
    port: 3000,
  };
  const file = join(ROOT, 'config.json');
  if (!existsSync(file)) return defaults;
  try {
    const user = JSON.parse(readFileSync(file, 'utf8'));
    return { ...defaults, ...user, teams: { ...defaults.teams, ...(user.teams ?? {}) } };
  } catch (err) {
    console.error(`config.json ist kein gültiges JSON: ${err.message}`);
    process.exit(1);
  }
}
