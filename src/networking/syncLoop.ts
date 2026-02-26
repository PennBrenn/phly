/**
 * Sync Loop — 20Hz state broadcast and client-side interpolation buffer.
 */

import type { PlayerState, Vec3, Quat } from '@/state/gameState';
import type { EnemyState } from '@/state/combatState';
import type { PlayerStatePayload, EnemyNetState } from '@/networking/protocol';

// ─── Interpolation buffer for a single remote player ────────────────────────────

export interface Snapshot {
  ts: number;                      // remote timestamp (ms)
  player: PlayerStatePayload;
}

export interface EnemySnapshot {
  ts: number;
  enemies: EnemyNetState[];
}

export interface InterpBuffer {
  snapshots: Snapshot[];
  enemySnapshots: EnemySnapshot[];
  renderDelay: number;             // ms behind latest (100ms default)
  maxBufferSize: number;           // trim to ~1s of data
}

export function createInterpBuffer(): InterpBuffer {
  return {
    snapshots: [],
    enemySnapshots: [],
    renderDelay: 100,
    maxBufferSize: 30,             // 30 snapshots ~1.5s at 20Hz
  };
}

export function pushPlayerSnapshot(buf: InterpBuffer, ts: number, data: PlayerStatePayload): void {
  buf.snapshots.push({ ts, player: data });
  if (buf.snapshots.length > buf.maxBufferSize) {
    buf.snapshots.splice(0, buf.snapshots.length - buf.maxBufferSize);
  }
}

export function pushEnemySnapshot(buf: InterpBuffer, ts: number, enemies: EnemyNetState[]): void {
  buf.enemySnapshots.push({ ts, enemies });
  if (buf.enemySnapshots.length > buf.maxBufferSize) {
    buf.enemySnapshots.splice(0, buf.enemySnapshots.length - buf.maxBufferSize);
  }
}

// ─── Interpolate remote player state ────────────────────────────────────────────

export function interpolatePlayer(buf: InterpBuffer, now: number, target: PlayerState): boolean {
  const snaps = buf.snapshots;
  if (snaps.length < 2) {
    // Not enough data — just snap to latest
    if (snaps.length === 1) applySnap(snaps[0].player, target);
    return snaps.length > 0;
  }

  const renderTime = now - buf.renderDelay;

  // Find bracketing snapshots
  let i = 0;
  for (; i < snaps.length - 1; i++) {
    if (snaps[i + 1].ts >= renderTime) break;
  }

  const a = snaps[i];
  const b = snaps[Math.min(i + 1, snaps.length - 1)];
  const span = b.ts - a.ts;
  const alpha = span > 0 ? Math.min(Math.max((renderTime - a.ts) / span, 0), 1) : 1;

  lerpPlayer(a.player, b.player, alpha, target);
  return true;
}

// ─── Interpolate enemy state (host → client) ────────────────────────────────────

export function interpolateEnemies(buf: InterpBuffer, now: number, targets: EnemyState[]): void {
  const snaps = buf.enemySnapshots;
  if (snaps.length < 1) return;

  const renderTime = now - buf.renderDelay;
  let i = 0;
  for (; i < snaps.length - 1; i++) {
    if (snaps[i + 1].ts >= renderTime) break;
  }

  const a = snaps[i];
  const b = snaps[Math.min(i + 1, snaps.length - 1)];
  const span = b.ts - a.ts;
  const alpha = span > 0 ? Math.min(Math.max((renderTime - a.ts) / span, 0), 1) : 1;

  for (const eNet of b.enemies) {
    const existing = targets.find(e => e.id === eNet.id);
    if (!existing) continue;

    const aEnemy = a.enemies.find(e => e.id === eNet.id);
    if (aEnemy) {
      existing.position = lerpVec3(aEnemy.p, eNet.p, alpha);
      existing.rotation = slerpQuat(aEnemy.r, eNet.r, alpha);
      existing.velocity = lerpVec3(aEnemy.v, eNet.v, alpha);
    } else {
      existing.position = eNet.p;
      existing.rotation = eNet.r;
      existing.velocity = eNet.v;
    }
    existing.speed = eNet.spd;
    existing.health = eNet.hp;
    existing.aiMode = eNet.mode;
  }
}

// ─── 20Hz Sync Timer ────────────────────────────────────────────────────────────

export class SyncTimer {
  private interval: ReturnType<typeof setInterval> | null = null;

  start(hz: number, callback: () => void): void {
    this.stop();
    this.interval = setInterval(callback, 1000 / hz);
  }

  stop(): void {
    if (this.interval !== null) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }
}

// ─── Math helpers ───────────────────────────────────────────────────────────────

function lerpVec3(a: Vec3, b: Vec3, t: number): Vec3 {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    z: a.z + (b.z - a.z) * t,
  };
}

function slerpQuat(a: Quat, b: Quat, t: number): Quat {
  // Simple nlerp (normalized lerp) — close enough for 50ms intervals
  let dot = a.x * b.x + a.y * b.y + a.z * b.z + a.w * b.w;
  const sign = dot < 0 ? -1 : 1;
  dot = Math.abs(dot);

  const bx = b.x * sign, by = b.y * sign, bz = b.z * sign, bw = b.w * sign;
  const rx = a.x + (bx - a.x) * t;
  const ry = a.y + (by - a.y) * t;
  const rz = a.z + (bz - a.z) * t;
  const rw = a.w + (bw - a.w) * t;

  const len = Math.sqrt(rx * rx + ry * ry + rz * rz + rw * rw) || 1;
  return { x: rx / len, y: ry / len, z: rz / len, w: rw / len };
}

function lerpPlayer(a: PlayerStatePayload, b: PlayerStatePayload, t: number, out: PlayerState): void {
  out.position = lerpVec3(a.p, b.p, t);
  out.rotation = slerpQuat(a.r, b.r, t);
  out.velocity = lerpVec3(a.v, b.v, t);
  out.speed = a.spd + (b.spd - a.spd) * t;
  out.throttle = a.thr + (b.thr - a.thr) * t;
  // Snap discrete state from latest
  out.health = b.hp;
  out.afterburner = b.ab;
  out.isDead = b.dead;
}

function applySnap(d: PlayerStatePayload, out: PlayerState): void {
  out.position = d.p;
  out.rotation = d.r;
  out.velocity = d.v;
  out.speed = d.spd;
  out.health = d.hp;
  out.throttle = d.thr;
  out.afterburner = d.ab;
  out.isDead = d.dead;
}
