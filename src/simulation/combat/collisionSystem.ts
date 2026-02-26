import type { GameState } from '@/state/gameState';
import {
  PLAYER_COLLISION_RADIUS,
  MAX_EXPLOSIONS,
  type ExplosionState,
} from '@/state/combatState';
import { vec3DistSq } from '@/utils/math';

const BULLET_RADIUS = 2;
const MISSILE_RADIUS = 4;
const FRAGMENT_COUNT = 12;

export function spawnExplosion(explosions: ExplosionState[], x: number, y: number, z: number): void {
  for (const ex of explosions) {
    if (!ex.active) {
      ex.active = true;
      ex.position = { x, y, z };
      ex.age = 0;
      ex.maxAge = 1.8;
      ex.fragments = [];
      for (let i = 0; i < FRAGMENT_COUNT; i++) {
        const angle = (i / FRAGMENT_COUNT) * Math.PI * 2;
        const pitch = (Math.random() - 0.3) * Math.PI;
        const speed = 30 + Math.random() * 60;
        ex.fragments.push({
          position: { x, y, z },
          velocity: {
            x: Math.cos(angle) * Math.cos(pitch) * speed,
            y: Math.sin(pitch) * speed + 20,
            z: Math.sin(angle) * Math.cos(pitch) * speed,
          },
        });
      }
      return;
    }
  }
}

export function updateCollisionSystem(state: GameState): void {
  const dt = state.time.delta;
  const combat = state.combat;
  const player = state.player;

  // ── Bullets vs Enemies ─────────────────────────────────────────────────
  for (const b of combat.bullets) {
    if (!b.active || b.ownerId !== 0) continue; // only player bullets hit enemies
    for (const e of combat.enemies) {
      if (e.aiMode === 'destroyed') continue;
      const distSq = vec3DistSq(b.position, e.position);
      const r = BULLET_RADIUS + e.collisionRadius;
      if (distSq < r * r) {
        b.active = false;
        e.health -= b.damage;
        e.hitFlashTimer = 0.15;
        if (e.health <= 0) {
          e.aiMode = 'destroyed';
          e.destroyedTimer = 0;
          spawnExplosion(combat.explosions, e.position.x, e.position.y, e.position.z);
        }
        break;
      }
    }
  }

  // ── Missiles vs Enemies (player missiles) ─────────────────────────────
  for (const m of combat.missiles) {
    if (!m.active || m.ownerId !== 0) continue;
    for (const e of combat.enemies) {
      if (e.aiMode === 'destroyed') continue;
      const distSq = vec3DistSq(m.position, e.position);
      const r = MISSILE_RADIUS + e.collisionRadius;
      if (distSq < r * r) {
        m.active = false;
        e.health -= m.damage;
        e.hitFlashTimer = 0.25;
        spawnExplosion(combat.explosions, m.position.x, m.position.y, m.position.z);
        if (e.health <= 0) {
          e.aiMode = 'destroyed';
          e.destroyedTimer = 0;
          spawnExplosion(combat.explosions, e.position.x, e.position.y, e.position.z);
        }
        break;
      }
    }
  }

  // ── Enemy missiles vs Player ───────────────────────────────────────────
  for (const m of combat.missiles) {
    if (!m.active || m.ownerId === 0) continue;
    const distSq = vec3DistSq(m.position, player.position);
    const r = MISSILE_RADIUS + PLAYER_COLLISION_RADIUS;
    if (distSq < r * r) {
      m.active = false;
      player.health -= m.damage;
      combat.playerDamageFlash = 0.5;
      spawnExplosion(combat.explosions, m.position.x, m.position.y, m.position.z);
      if (player.health <= 0) player.health = 0;
    }
  }

  // ── Enemy bullets vs Player ────────────────────────────────────────────
  for (const b of combat.bullets) {
    if (!b.active || b.ownerId === 0) continue;
    const distSq = vec3DistSq(b.position, player.position);
    const r = BULLET_RADIUS + PLAYER_COLLISION_RADIUS;
    if (distSq < r * r) {
      b.active = false;
      player.health -= b.damage;
      combat.playerDamageFlash = 0.3;
      if (player.health <= 0) player.health = 0;
    }
  }

  // ── Update explosions ──────────────────────────────────────────────────
  for (const ex of combat.explosions) {
    if (!ex.active) continue;
    ex.age += dt;
    if (ex.age > ex.maxAge) {
      ex.active = false;
      continue;
    }
    for (const f of ex.fragments) {
      f.position.x += f.velocity.x * dt;
      f.position.y += f.velocity.y * dt;
      f.position.z += f.velocity.z * dt;
      f.velocity.y -= 30 * dt; // gravity on fragments
    }
  }

  // ── Decay timers ───────────────────────────────────────────────────────
  combat.playerDamageFlash = Math.max(0, combat.playerDamageFlash - dt);
  for (const e of combat.enemies) {
    if (e.hitFlashTimer > 0) e.hitFlashTimer -= dt;
    if (e.aiMode === 'destroyed') {
      e.destroyedTimer += dt;
    }
  }
}
