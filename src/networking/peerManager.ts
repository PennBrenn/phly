/**
 * Peer Manager — handles PeerJS connections and room management.
 *
 * Future: uses PeerJS for WebRTC data channels,
 * Vercel KV for room code persistence and discovery.
 */

export interface PeerConfig {
  vercelKvUrl?: string;    // Vercel KV endpoint for room codes
  maxPlayers: number;
  tickRate: number;         // Hz for state sync (target: 20)
}

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'hosting';

export class PeerManager {
  private _state: ConnectionState = 'disconnected';
  private _peerId: string | null = null;
  private _roomCode: string | null = null;
  private _config: PeerConfig;

  constructor(config?: Partial<PeerConfig>) {
    this._config = {
      maxPlayers: 8,
      tickRate: 20,
      ...config,
    };
  }

  get state(): ConnectionState { return this._state; }
  get peerId(): string | null { return this._peerId; }
  get roomCode(): string | null { return this._roomCode; }

  /** Create a new room as host. */
  async hostRoom(): Promise<string> {
    // TODO: initialize PeerJS, generate room code, register with Vercel KV
    this._state = 'hosting';
    this._roomCode = this.generateCode();
    console.log(`[PeerManager] Hosting room: ${this._roomCode}`);
    return this._roomCode;
  }

  /** Join an existing room by code. */
  async joinRoom(_code: string): Promise<void> {
    // TODO: look up host peer ID from Vercel KV, connect via PeerJS
    this._state = 'connecting';
    console.log(`[PeerManager] Joining room: ${_code}`);
  }

  /** Send state snapshot to all peers. */
  broadcast(_data: string): void {
    // TODO: send to all connected peers
  }

  /** Register callback for incoming messages. */
  onMessage(_cb: (senderId: string, data: string) => void): void {
    // TODO: wire up PeerJS data channel message handler
  }

  disconnect(): void {
    this._state = 'disconnected';
    this._roomCode = null;
    // TODO: close PeerJS connections, remove room from Vercel KV
  }

  private generateCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return code;
  }
}
