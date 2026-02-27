import type { GameState, Vec3 } from '@/state/gameState';
import {
  BULLET_SPEED, BULLET_MAX_AGE, BULLET_FIRE_RATE,
  type BulletState,
} from '@/state/combatState';
import { vec3Add, vec3Scale, quatRotateVec3 } from '@/utils/math';
import { getWeaponSync } from '@/utils/dataLoader';

const FIRE_INTERVAL = 1 / BULLET_FIRE_RATE;

/** Fire a bullet from a given position/direction. */
function fireBullet(
  bullets: BulletState[],
  position: Vec3,
  forward: Vec3,
  ownerId: number,
  speed = BULLET_SPEED,
  damage = 8,
): boolean {
  for (const b of bullets) {
    if (!b.active) {
      b.active = true;
      b.position = { ...position };
      b.velocity = vec3Scale(forward, speed);
      b.age = 0;
      b.damage = damage;
      b.ownerId = ownerId;
      return true;
    }
  }
  return false;
}

export function updateBulletSystem(state: GameState): void {
  const dt = state.time.delta;
  const combat = state.combat;

  // ── Tick all slot cooldowns ───────────────────────────────────────────────
  for (const ws of combat.weaponSlots) {
    ws.cooldown = Math.max(0, ws.cooldown - dt);
  }
  combat.fireCooldown = Math.max(0, combat.fireCooldown - dt);

  // ── Player gun firing (Space bar — always slot 1, the plane's gun) ──────
  const gunSlot = combat.weaponSlots.find(ws => ws.slot === 1);
  if (state.input.fireGun && gunSlot) {
    const wData = getWeaponSync(gunSlot.weaponId);
    if (wData && wData.type === 'gun' && gunSlot.cooldown <= 0) {
      const fwd = quatRotateVec3(state.player.rotation, { x: 0, y: 0, z: -1 });
      const spawnPos = vec3Add(state.player.position, vec3Scale(fwd, 8));
      const bSpeed = wData.bulletSpeed ?? BULLET_SPEED;
      const bDmg = wData.damage ?? 8;
      if (fireBullet(combat.bullets, spawnPos, fwd, 0, bSpeed, bDmg)) {
        const rate = wData.fireRate ?? BULLET_FIRE_RATE;
        gunSlot.cooldown = 1 / rate;
        combat.fireCooldown = gunSlot.cooldown;
      }
    }
  }

  // ── Update active bullets ──────────────────────────────────────────────
  for (const b of combat.bullets) {
    if (!b.active) continue;
    b.age += dt;
    if (b.age > BULLET_MAX_AGE) {
      b.active = false;
      continue;
    }
    b.position = vec3Add(b.position, vec3Scale(b.velocity, dt));
  }
}

/** Let an enemy fire a bullet (called from AI). */
export function enemyFireBullet(
  bullets: BulletState[],
  position: Vec3,
  forward: Vec3,
  enemyId: number,
  speed = BULLET_SPEED,
  damage = 8,
): boolean {
  return fireBullet(bullets, position, forward, enemyId, speed, damage);
}
