/**
 * Vercel Serverless API — Room code registry.
 *
 * POST /api/room?action=create  { peerId: string } → { code: string }
 * POST /api/room?action=join    { code: string }   → { peerId: string }
 * DELETE /api/room              { code: string }   → { ok: true }
 *
 * Uses in-memory store — sufficient for room code handshake (seconds-long window).
 * Codes expire after 10 minutes automatically.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

interface RoomEntry {
  peerId: string;
  createdAt: number;
}

// Module-level map persists across warm invocations within the same instance
const rooms = new Map<string, RoomEntry>();
const TTL_MS = 10 * 60 * 1000; // 10 minutes

function pruneExpired(): void {
  const now = Date.now();
  for (const [code, entry] of rooms.entries()) {
    if (now - entry.createdAt > TTL_MS) rooms.delete(code);
  }
}

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous chars (0/O, 1/I)
  let code = '';
  for (let i = 0; i < 5; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

export default function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  pruneExpired();

  const action = req.query.action as string;

  if (req.method === 'POST' && action === 'create') {
    const { peerId } = req.body as { peerId?: string };
    if (!peerId) return res.status(400).json({ error: 'Missing peerId' });

    // Generate unique code
    let code = generateCode();
    let attempts = 0;
    while (rooms.has(code) && attempts < 10) {
      code = generateCode();
      attempts++;
    }
    if (rooms.has(code)) return res.status(503).json({ error: 'Could not generate unique code' });

    rooms.set(code, { peerId, createdAt: Date.now() });
    console.log(`[Room] Created: ${code} → ${peerId}`);
    return res.status(200).json({ code });
  }

  if (req.method === 'POST' && action === 'join') {
    const { code } = req.body as { code?: string };
    if (!code) return res.status(400).json({ error: 'Missing code' });

    const entry = rooms.get(code.toUpperCase());
    if (!entry) return res.status(404).json({ error: 'Room not found' });

    console.log(`[Room] Join: ${code} → ${entry.peerId}`);
    return res.status(200).json({ peerId: entry.peerId });
  }

  if (req.method === 'DELETE') {
    const { code } = req.body as { code?: string };
    if (code) rooms.delete(code.toUpperCase());
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
