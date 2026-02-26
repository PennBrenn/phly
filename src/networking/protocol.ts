/**
 * Multiplayer Protocol — message types and serialization format.
 *
 * Future: P2P via PeerJS, room codes via Vercel KV,
 * 20Hz state broadcast with interpolation.
 */

export type MessageType =
  | 'state_snapshot'
  | 'input_update'
  | 'player_join'
  | 'player_leave'
  | 'chat'
  | 'room_info';

export interface NetworkMessage {
  type: MessageType;
  timestamp: number;
  senderId: string;
  payload: unknown;
}

export interface StateSnapshot {
  tick: number;
  players: PlayerNetState[];
  bullets: BulletNetState[];
  missiles: MissileNetState[];
}

export interface PlayerNetState {
  id: string;
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number; w: number };
  velocity: { x: number; y: number; z: number };
  health: number;
  throttle: number;
  afterburner: boolean;
  isDead: boolean;
}

export interface BulletNetState {
  position: { x: number; y: number; z: number };
  velocity: { x: number; y: number; z: number };
  ownerId: string;
}

export interface MissileNetState {
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number; w: number };
  targetId: string;
  ownerId: string;
  speed: number;
}

export interface RoomInfo {
  code: string;
  hostId: string;
  players: string[];
  maxPlayers: number;
}

/** Serialize a message to send over the wire. */
export function encodeMessage(msg: NetworkMessage): string {
  return JSON.stringify(msg);
}

/** Deserialize a received message. */
export function decodeMessage(data: string): NetworkMessage {
  return JSON.parse(data) as NetworkMessage;
}
