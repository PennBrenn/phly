/**
 * Peer Manager — handles PeerJS WebRTC connections and room codes.
 *
 * Room codes use the peer ID directly (no external KV needed for local/LAN).
 * Host creates a Peer with a known ID derived from the room code.
 * Client connects to that peer ID.
 */

import Peer, { type DataConnection } from 'peerjs';
import { decode, type NetMessage } from '@/networking/protocol';

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'hosting';
export type Role = 'none' | 'host' | 'client';

export interface PeerCallbacks {
  onConnected: (remotePeerId: string) => void;
  onMessage: (msg: NetMessage) => void;
  onDisconnected: (remotePeerId: string) => void;
  onError: (err: string) => void;
}

const PEER_PREFIX = 'phly-room-';

export class PeerManager {
  private peer: Peer | null = null;
  private conn: DataConnection | null = null;      // client's connection to host
  private remoteConn: DataConnection | null = null; // host's connection from client
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
  get isConnected(): boolean { return this._state === 'connected' || this._state === 'hosting'; }

  /** Host a room: creates a Peer with a deterministic ID from the room code. */
  async hostRoom(): Promise<string> {
    this._roomCode = this.generateCode();
    const peerId = PEER_PREFIX + this._roomCode;
    this._state = 'connecting';
    this._role = 'host';

    return new Promise((resolve, reject) => {
      this.peer = new Peer(peerId);

      this.peer.on('open', () => {
        console.log('[Net] Hosting room:', this._roomCode);
        this._state = 'hosting';
        resolve(this._roomCode);
      });

      this.peer.on('connection', (conn) => {
        console.log('[Net] Client connected:', conn.peer);
        this.remoteConn = conn;
        this._state = 'connected';
        this.wireConnection(conn);
        this._callbacks.onConnected(conn.peer);
      });

      this.peer.on('error', (err) => {
        console.error('[Net] Host error:', err);
        this._callbacks.onError(String(err));
        reject(err);
      });

      this.peer.on('disconnected', () => {
        if (this._state !== 'disconnected') {
          console.warn('[Net] Peer server disconnected, attempting reconnect...');
          this.peer?.reconnect();
        }
      });
    });
  }

  /** Join a room by code: connects to the host's deterministic peer ID. */
  async joinRoom(code: string): Promise<void> {
    this._roomCode = code.toUpperCase();
    const hostPeerId = PEER_PREFIX + this._roomCode;
    this._state = 'connecting';
    this._role = 'client';

    return new Promise((resolve, reject) => {
      this.peer = new Peer();

      this.peer.on('open', () => {
        console.log('[Net] Connecting to host:', hostPeerId);
        const conn = this.peer!.connect(hostPeerId, { reliable: true });
        this.conn = conn;

        conn.on('open', () => {
          console.log('[Net] Connected to host');
          this._state = 'connected';
          this.wireConnection(conn);
          this._callbacks.onConnected(hostPeerId);
          resolve();
        });

        conn.on('error', (err) => {
          console.error('[Net] Connection error:', err);
          this._callbacks.onError(String(err));
          reject(err);
        });
      });

      this.peer.on('error', (err) => {
        console.error('[Net] Client error:', err);
        this._callbacks.onError(String(err));
        reject(err);
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

  /** Send a raw encoded string to the remote peer. */
  send(data: string): void {
    if (this._role === 'host' && this.remoteConn?.open) {
      this.remoteConn.send(data);
    } else if (this._role === 'client' && this.conn?.open) {
      this.conn.send(data);
    }
  }

  /** Disconnect and clean up everything. */
  disconnect(): void {
    console.log('[Net] Disconnecting');
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

  private generateCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 5; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return code;
  }
}
