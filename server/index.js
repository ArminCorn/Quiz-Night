// Quiz Night – lokaler Server
//
// - liefert die Seiten aus (/screen, /host, /play)
// - hält den Spielzustand zentral und synchronisiert alle Fenster per WebSocket (/ws)
// - speichert den Stand laufend in data/state.json
//
// Start: `npm start` (baut das Frontend und startet den Server)
// Entwicklung: `npm run dev` (Vite mit Hot Reload, ohne Build)
import express from 'express';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { networkInterfaces } from 'node:os';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { ActionError, createEngine } from './engine.js';
import { loadRegistry } from './registry.js';
import { createStore } from './store.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DEV = process.argv.includes('--dev');
const ROLES = ['screen', 'host', 'play'];
const PAGES = { '/': 'index.html', '/screen': 'screen/index.html', '/host': 'host/index.html', '/play': 'play/index.html' };
const AUDIO_EXT = new Set(['.mp3', '.ogg', '.wav', '.m4a', '.aac', '.webm', '.flac']);

const config = loadConfig();
const registry = await loadRegistry({ formatsDir: join(ROOT, 'formats'), formatOrder: config.formatOrder });
const engine = createEngine(registry);
const store = createStore({
  dataDir: process.env.QUIZ_DATA_DIR ? resolve(process.env.QUIZ_DATA_DIR) : join(ROOT, 'data'),
  engine,
  config,
});

// ---------------------------------------------------------------- HTTP

const app = express();
const server = createServer(app);
app.disable('x-powered-by');

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
  // /screen → /screen/ (Vite erwartet den Schrägstrich für Unterseiten)
  app.use((req, res, next) => {
    const [path, query] = req.url.split('?');
    if (PAGES[path] && path !== '/') req.url = `${path}/${query ? `?${query}` : ''}`;
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
  wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
});

function stateMessage(role, { effects = [], animate = false } = {}) {
  const view = engine.view(store.state, role);
  if (role === 'host') view.undo = store.undoInfo();
  return JSON.stringify({ t: 'state', seq, view, effects, animate });
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
      return;
    }

    if (msg.t === 'action') {
      if (ws.role !== 'host') return sendError(ws, 'Nur die Gamemaster-Ansicht darf steuern.');
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
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\nPort ${port} ist schon belegt. Läuft Quiz Night bereits in einem anderen Fenster?`);
    console.error('Entweder das andere Fenster schließen oder in config.json einen anderen "port" eintragen.\n');
    process.exit(1);
  }
  throw err;
});

server.listen(port, '0.0.0.0', () => {
  const actual = server.address().port;
  const ips = localIps();
  const playable = registry.order.filter((f) => f.playable).map((f) => f.name);
  console.log('');
  console.log(`  QUIZ NIGHT läuft${DEV ? ' (Entwicklungsmodus)' : ''}`);
  console.log('');
  console.log(`  Gamemaster (Laptop):   http://localhost:${actual}/host`);
  console.log(`  Beamer (Vollbild):     http://localhost:${actual}/screen`);
  for (const ip of ips) console.log(`  Im WLAN (Handys):      http://${ip}:${actual}/play`);
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

function localIps() {
  const result = [];
  for (const list of Object.values(networkInterfaces())) {
    for (const net of list ?? []) {
      if (net.family === 'IPv4' && !net.internal) result.push(net.address);
    }
  }
  return result;
}
