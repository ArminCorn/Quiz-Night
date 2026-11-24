// Server-Test: lauscht nur auf localhost, lehnt fremde Host-/Origin-Header ab.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import { networkInterfaces, tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import WebSocket from 'ws';

const root = fileURLToPath(new URL('..', import.meta.url));
let child;
let port;
let output = '';
let dataDir;

before(async () => {
  dataDir = mkdtempSync(join(tmpdir(), 'quiz-srv-'));
  child = spawn('node', ['server/index.js'], {
    cwd: root,
    env: { ...process.env, PORT: '0', QUIZ_DATA_DIR: dataDir },
  });
  child.stderr.on('data', (d) => (output += d));
  port = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Server startet nicht:\n${output}`)), 15000);
    child.stdout.on('data', (d) => {
      output += d;
      const m = /localhost:(\d+)\/host/.exec(output);
      if (m) {
        clearTimeout(timer);
        resolve(Number(m[1]));
      }
    });
  });
});

after(() => {
  child?.kill();
  rmSync(dataDir, { recursive: true, force: true });
});

function get(path, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, path, headers }, (res) => {
      res.resume();
      resolve(res.statusCode);
    });
    req.on('error', reject);
    req.end();
  });
}

test('Startausgabe nennt keine Netzwerkadresse und kein /play', () => {
  assert.doesNotMatch(output, /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b|\/play/);
  assert.match(output, /Nur auf diesem Laptop/);
});

test('Seiten sind über localhost erreichbar, /play gibt es nicht mehr', async () => {
  assert.equal(await get('/host'), 200);
  assert.equal(await get('/screen'), 200);
  assert.equal(await get('/', { host: `127.0.0.1:${port}` }), 200);
  assert.notEqual(await get('/play'), 200);
});

test('Fremder Host-Header wird abgelehnt', async () => {
  assert.equal(await get('/host', { host: 'evil.example' }), 403);
  assert.equal(await get('/api/config', { host: '192.168.1.5:3000' }), 403);
});

test('WebSocket: localhost ja, fremder Origin nein', async () => {
  const open = (origin) =>
    new Promise((resolve) => {
      const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`, { headers: origin ? { origin } : {} });
      ws.on('open', () => {
        ws.close();
        resolve('open');
      });
      ws.on('error', () => resolve('rejected'));
      ws.on('unexpected-response', () => resolve('rejected'));
    });
  assert.equal(await open(), 'open');
  assert.equal(await open(`http://localhost:${port}`), 'open');
  assert.equal(await open('https://evil.example'), 'rejected');
});

test('Rolle „play“ gibt es nicht mehr', async () => {
  const view = await new Promise((resolve) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
    ws.on('open', () => ws.send(JSON.stringify({ t: 'hello', role: 'play' })));
    ws.on('message', (raw) => {
      resolve(JSON.parse(raw));
      ws.close();
    });
  });
  assert.equal(view.t, 'state'); // wird wie ein Beamer behandelt, kann aber nichts steuern
});

test('Server ist über keine andere Netzwerkadresse erreichbar', async (t) => {
  const external = Object.values(networkInterfaces())
    .flat()
    .find((n) => n && n.family === 'IPv4' && !n.internal);
  if (!external) return t.skip('Keine externe Netzwerkadresse auf diesem Rechner');
  const result = await new Promise((resolve) => {
    const socket = net.connect({ host: external.address, port, timeout: 3000 });
    socket.on('connect', () => {
      socket.destroy();
      resolve('verbunden');
    });
    socket.on('error', (e) => resolve(e.code));
    socket.on('timeout', () => {
      socket.destroy();
      resolve('timeout');
    });
  });
  assert.equal(result, 'ECONNREFUSED', `Server antwortet auf ${external.address}`);
});
