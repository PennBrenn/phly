/**
 * Local dev server for /api routes — runs on port 3001.
 * In production, Vercel handles this via serverless functions.
 * Run alongside vite: node api/dev-server.mjs
 */

import http from 'http';

const rooms = new Map();
const TTL_MS = 10 * 60 * 1000;

function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 5; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function pruneExpired() {
  const now = Date.now();
  for (const [code, entry] of rooms.entries()) {
    if (now - entry.createdAt > TTL_MS) rooms.delete(code);
  }
}

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200); res.end(); return;
  }

  const url = new URL(req.url, `http://localhost:3001`);
  if (!url.pathname.startsWith('/api/room')) {
    res.writeHead(404); res.end('Not found'); return;
  }

  let body = '';
  req.on('data', chunk => { body += chunk; });
  req.on('end', () => {
    pruneExpired();
    let parsed = {};
    try { parsed = JSON.parse(body || '{}'); } catch {}

    const action = url.searchParams.get('action');

    if (req.method === 'POST' && action === 'create') {
      const { peerId } = parsed;
      if (!peerId) { res.writeHead(400); res.end(JSON.stringify({ error: 'Missing peerId' })); return; }
      let code = generateCode();
      let attempts = 0;
      while (rooms.has(code) && attempts < 10) { code = generateCode(); attempts++; }
      rooms.set(code, { peerId, createdAt: Date.now() });
      console.log(`[Room] Created: ${code} → ${peerId}`);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ code }));
      return;
    }

    if (req.method === 'POST' && action === 'join') {
      const { code } = parsed;
      if (!code) { res.writeHead(400); res.end(JSON.stringify({ error: 'Missing code' })); return; }
      const entry = rooms.get(code.toUpperCase());
      if (!entry) { res.writeHead(404); res.end(JSON.stringify({ error: 'Room not found' })); return; }
      console.log(`[Room] Join: ${code} → ${entry.peerId}`);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ peerId: entry.peerId }));
      return;
    }

    if (req.method === 'DELETE') {
      const { code } = parsed;
      if (code) rooms.delete(code.toUpperCase());
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    res.writeHead(405); res.end('Method not allowed');
  });
});

server.listen(3001, () => {
  console.log('[API Dev Server] Listening on http://localhost:3001');
});
