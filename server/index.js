import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { NET } from '../shared/constants.js';

const PORT = Number(process.env.PORT) || 8787;
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

function sendJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

function serveStatic(req, res) {
  if (!fs.existsSync(DIST)) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Pasta dist/ não encontrada. Rode "npm run build" primeiro.');
    return;
  }

  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  } catch {
    res.writeHead(400);
    res.end('Bad request');
    return;
  }

  let filePath = path.join(DIST, pathname);
  // Impede sair da pasta dist/ (ex.: /../server/index.js)
  if (filePath !== DIST && !filePath.startsWith(DIST + path.sep)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  try {
    if (fs.statSync(filePath).isDirectory()) filePath = path.join(filePath, 'index.html');
    const data = fs.readFileSync(filePath);
    const type = MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type });
    res.end(req.method === 'HEAD' ? undefined : data);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
  }
}

const server = http.createServer((req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  if (req.method === 'GET' && pathname === '/health') {
    sendJson(res, 200, { ok: true });
    return;
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405);
    res.end('Method not allowed');
    return;
  }
  serveStatic(req, res);
});

const wss = new WebSocketServer({ noServer: true });

wss.on('connection', (ws) => {
  ws.send(JSON.stringify({ t: 'hello', v: 1 }));
  ws.on('message', (data) => {
    let msg;
    try {
      msg = JSON.parse(data.toString());
    } catch {
      return;
    }
    if (msg && msg.t === 'ping') ws.send(JSON.stringify({ t: 'pong' }));
  });
});

server.on('upgrade', (req, socket, head) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  if (pathname !== '/ws') {
    socket.destroy();
    return;
  }
  wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
});

server.listen(PORT, () => {
  console.log(`Servidor LUZ NEGRA em http://localhost:${PORT} (rede a ${NET.TICK_RATE} Hz)`);
});
