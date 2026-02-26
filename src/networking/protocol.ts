/**
 * Multiplayer Protocol — message types and serialization for P2P sync.
 */

import type { Vec3, Quat } from '@/state/gameState';
import type { AIMode } from '@/state/combatState';

// ─── Message envelope ───────────────────────────────────────────────────────────
export type MessageType =
  | 'loadout_sync'
  | 'player_state'
  | 'enemy_state'
  | 'bullet_spawn'
  | 'missile_spawn'
  | 'kill_event'
  | 'player_join'
  | 'player_leave'
  | 'mission_start'
  | 'ping'
  | 'pong';

export interface NetMessage {
  t: MessageType;
  ts: number;      // Date.now()
  d: unknown;      // typed payload per message type
}

// ─── Payloads ───────────────────────────────────────────────────────────────────

export interface LoadoutPayload {
  planeId: string;
  modelPath: string;
  weaponSlots: { slot: number; weaponId: string }[];
  playerName: string;
}

export interface PlayerStatePayload {
  p: Vec3;        // position
  r: Quat;        // rotation
  v: Vec3;        // velocity
  spd: number;    // speed scalar
  hp: number;     // health
  thr: number;    // throttle 0-1
  ab: boolean;    // afterburner
  dead: boolean;
}

export interface EnemyNetState {
  id: number;
  p: Vec3;
  r: Quat;
  v: Vec3;
  spd: number;
  hp: number;
  mode: AIMode;
  isGround: boolean;
}

export interface EnemyStatePayload {
  enemies: EnemyNetState[];
}

export interface BulletSpawnPayload {
  p: Vec3;
  v: Vec3;
  dmg: number;
}

export interface MissileSpawnPayload {
  p: Vec3;
  r: Quat;
  spd: number;
  turnRate: number;
  dmg: number;
  targetId: number;
}

export interface KillEventPayload {
  enemyId: number;
  killerIsHost: boolean;
}

export interface MissionStartPayload {
  missionId: string;
  difficulty: string;
}

// ─── Encode / Decode ────────────────────────────────────────────────────────────

export function encode(type: MessageType, data: unknown): string {
  const msg: NetMessage = { t: type, ts: Date.now(), d: data };
  return JSON.stringify(msg);
}

export function decode(raw: string): NetMessage {
  return JSON.parse(raw) as NetMessage;
}

// ─── Helpers to extract player state from game state ────────────────────────────

import type { PlayerState } from '@/state/gameState';

export function packPlayer(s: PlayerState): PlayerStatePayload {
  return {
    p: s.position,
    r: s.rotation,
    v: s.velocity,
    spd: s.speed,
    hp: s.health,
    thr: s.throttle,
    ab: s.afterburner,
    dead: s.isDead,
  };
}

export function unpackPlayer(d: PlayerStatePayload, target: PlayerState): void {
  target.position = d.p;
  target.rotation = d.r;
  target.velocity = d.v;
  target.speed = d.spd;
  target.health = d.hp;
  target.throttle = d.thr;
  target.afterburner = d.ab;
  target.isDead = d.dead;
}
