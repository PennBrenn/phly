/**
 * Peer Manager — PeerJS WebRTC with Vercel-backed room code registry.
 *
 * Flow:
 *  Host: init PeerJS (gets random ID) → POST /api/room?action=create → get code
 *        wait for client connection → onConnected fires
 *  Client: POST /api/room?action=join with code → get hostPeerId → connect via PeerJS
 *          → onConnected fires
 *
 * This avoids the deterministic-ID collision problem on the PeerJS broker.
 */

import Peer, { type DataConnection } from 'peerjs';
import { decode, type NetMessage } from '@/networking/protocol';

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'hosting';
export type Role = 'none' | 'host' | 'client';

export interface PeerCallbacks {
  onHostReady: (code: string) => void;    // Host only: room code is ready, show to user
  onConnected: (remotePeerId: string) => void; // Both sides: peer-to-peer link established
  onMessage: (msg: NetMessage) => void;
  onDisconnected: (remotePeerId: string) => void;
  onError: (err: string) => void;
}

// Detect if we're running on Vercel (production) or locally
const API_BASE = typeof window !== 'undefined'
  ? window.location.origin
  : 'http://localhost:3000';

export class PeerManager {
  private peer: Peer | null = null;
  private conn: DataConnection | null = null;       // client's outbound connection
  private remoteConn: DataConnection | null = null; // host's inbound connection
  private _state: ConnectionState = 'disconnected';
  private _role: Role = 'none';
  private _roomCode = '';
  private _callbacks: PeerCallbacks;

  constructor(callbacks: PeerCallbacks) {
    this._callbacks = callbacks;
  }

  get state(): ConnectionState { return this._state; }
  get role(): Role { return this._role; }
  get roomCode(): string { return this._roomCode; }
  get isHost(): boolean { return this._role === 'host'; }
  get isClient(): boolean { return this._role === 'client'; }
  get isConnected(): boolean { return this._state === 'connected'; }

  /**
   * Host: create a PeerJS peer with a random ID, register with API, get room code.
   * Calls onHostReady(code) immediately once registered.
   * Calls onConnected when client joins.
   */
  async hostRoom(): Promise<void> {
    this._state = 'connecting';
    this._role = 'host';

    // Step 1: init PeerJS with a random ID (broker assigns one)
    const peerId = await this.initPeer();
    console.log('[Net] My peer ID:', peerId);

    // Step 2: register with room API → get code
    let code: string;
    try {
      const resp = await fetch(`${API_BASE}/api/room?action=create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ peerId }),
      });
      if (!resp.ok) throw new Error(`API error ${resp.status}`);
      const data = await resp.json() as { code: string };
      code = data.code;
    } catch (err) {
      this.cleanup();
      throw new Error('Failed to register room: ' + String(err));
    }

    this._roomCode = code;
    this._state = 'hosting';
    console.log('[Net] Room code:', code);
    this._callbacks.onHostReady(code);

    // Step 3: wait for incoming connection
    this.peer!.on('connection', (conn) => {
      console.log('[Net] Client connected:', conn.peer);
      this.remoteConn = conn;
      this._state = 'connected';
      this.wireConnection(conn);
      this._callbacks.onConnected(conn.peer);
    });
  }

  /**
   * Client: look up host peer ID via API, connect via PeerJS.
   * Calls onConnected when link is established.
   */
  async joinRoom(code: string): Promise<void> {
    this._roomCode = code.toUpperCase();
    this._state = 'connecting';
    this._role = 'client';

    // Step 1: look up host peer ID
    let hostPeerId: string;
    try {
      const resp = await fetch(`${API_BASE}/api/room?action=join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: this._roomCode }),
      });
      if (!resp.ok) {
        if (resp.status === 404) throw new Error('Room not found');
        throw new Error(`API error ${resp.status}`);
      }
      const data = await resp.json() as { peerId: string };
      hostPeerId = data.peerId;
    } catch (err) {
      this.cleanup();
      throw err;
    }

    console.log('[Net] Connecting to host peer:', hostPeerId);

    // Step 2: init our own peer
    await this.initPeer();

    // Step 3: connect to host
    await new Promise<void>((resolve, reject) => {
      const conn = this.peer!.connect(hostPeerId, { reliable: true });
      this.conn = conn;

      const timeout = setTimeout(() => {
        reject(new Error('Connection timed out'));
      }, 15000);

      conn.on('open', () => {
        clearTimeout(timeout);
        console.log('[Net] Connected to host');
        this._state = 'connected';
        this.wireConnection(conn);
        this._callbacks.onConnected(hostPeerId);
        resolve();
      });

      conn.on('error', (err) => {
        clearTimeout(timeout);
        reject(new Error(String(err)));
      });
    });
  }

  /** Init PeerJS and wait for the broker to assign an ID. */
  private initPeer(): Promise<string> {
    return new Promise((resolve, reject) => {
      const p = new Peer();
      this.peer = p;

      const timeout = setTimeout(() => {
        reject(new Error('PeerJS broker connection timed out'));
      }, 10000);

      p.on('open', (id) => {
        clearTimeout(timeout);
        resolve(id);
      });

      p.on('error', (err) => {
        clearTimeout(timeout);
        this._callbacks.onError(String(err));
        reject(err);
      });

      p.on('disconnected', () => {
        if (this._state !== 'disconnected') {
          console.warn('[Net] Broker disconnected, reconnecting...');
          p.reconnect();
        }
      });
    });
  }

  private wireConnection(conn: DataConnection): void {
    conn.on('data', (raw) => {
      try {
        const msg = decode(raw as string);
        this._callbacks.onMessage(msg);
      } catch (e) {
        console.warn('[Net] Bad message:', e);
      }
    });

    conn.on('close', () => {
      console.log('[Net] Connection closed:', conn.peer);
      this._state = this._role === 'host' ? 'hosting' : 'disconnected';
      this._callbacks.onDisconnected(conn.peer);
    });

    conn.on('error', (err) => {
      console.error('[Net] Data channel error:', err);
    });
  }

  send(data: string): void {
    if (this._role === 'host' && this.remoteConn?.open) {
      this.remoteConn.send(data);
    } else if (this._role === 'client' && this.conn?.open) {
      this.conn.send(data);
    }
  }

  disconnect(): void {
    console.log('[Net] Disconnecting');
    if (this._roomCode && this._role === 'host') {
      // Best-effort cleanup of room entry
      fetch(`${API_BASE}/api/room`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: this._roomCode }),
      }).catch(() => {});
    }
    this.cleanup();
  }

  private cleanup(): void {
    this.conn?.close();
    this.remoteConn?.close();
    this.peer?.destroy();
    this.conn = null;
    this.remoteConn = null;
    this.peer = null;
    this._state = 'disconnected';
    this._role = 'none';
    this._roomCode = '';
  }
}
