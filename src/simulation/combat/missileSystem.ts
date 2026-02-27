import type { GameState, Vec3 } from '@/state/gameState';
import {
  MISSILE_SPEED, MISSILE_MAX_AGE, MISSILE_TURN_RATE,
  type MissileState, type EnemyState,
} from '@/state/combatState';
import {
  vec3Add, vec3Scale, vec3Sub, vec3Normalize, vec3Length,
  quatRotateVec3, quatFromAxisAngle, quatMultiply, quatNormalize,
  vec3Cross, vec3Dot, clamp,
} from '@/utils/math';
import { getWeaponSync } from '@/utils/dataLoader';

const MISSILE_COOLDOWN = 2.0;
const LOCK_RANGE = 2000;
const LOCK_CONE = 0.7;
const GRAVITY = 9.81;
const LOCK_TIME = 2.0; // seconds to acquire lock on a target once tracking

/** Find best enemy in front of player within lock cone. */
function findSeekerTarget(enemies: EnemyState[], playerPos: Vec3, playerFwd: Vec3): number {
  let bestId = -1;
  let bestScore = -Infinity;
  for (const e of enemies) {
    if (e.aiMode === 'destroyed') continue;
    const dx = e.position.x - playerPos.x;
    const dy = e.position.y - playerPos.y;
    const dz = e.position.z - playerPos.z;
    const distSq = dx * dx + dy * dy + dz * dz;
    if (distSq > LOCK_RANGE * LOCK_RANGE) continue;
    const dist = Math.sqrt(distSq);
    if (dist < 1) continue;
    const dir = { x: dx / dist, y: dy / dist, z: dz / dist };
    const dot = vec3Dot(playerFwd, dir);
    if (dot < LOCK_CONE) continue;
    const score = dot * 1000 - dist;
    if (score > bestScore) { bestScore = score; bestId = e.id; }
  }
  return bestId;
}

// ── Seeker system: hold left-click to engage (only when missile is selected)
let fireMissileConsumed = false;

/** Check if selected slot has a missile. */
function selectedSlotHasMissile(combat: any): boolean {
  const sel = combat.weaponSlots.find((ws: any) => ws.slot === combat.selectedSlot);
  if (!sel) return false;
  const wd = getWeaponSync(sel.weaponId);
  return wd?.type === 'missile' && sel.ammo > 0;
}

function updateSeekerSystem(state: GameState): void {
  const dt = state.time.delta;
  const combat = state.combat;
  const seeker = combat.seeker;
  const playerFwd = quatRotateVec3(state.player.rotation, { x: 0, y: 0, z: -1 });

  const hasMissile = selectedSlotHasMissile(combat);

  // Hold left-click to engage seeker (only if missile is selected)
  if (state.input.seekerEngage && hasMissile) {
    if (!seeker.active) {
      seeker.active = true;
      seeker.seekTimer = 0;
      seeker.locked = false;
      seeker.targetId = findSeekerTarget(combat.enemies, state.player.position, playerFwd);
    }
  } else if (!hasMissile || !state.input.seekerEngage) {
    // Release or no missile — deactivate
    if (seeker.active && !seeker.locked) {
      seeker.active = false;
      seeker.seekTimer = 0;
      seeker.locked = false;
      seeker.targetId = -1;
    }
  }

  // While seeker is active, update tracking
  if (seeker.active) {
    // seekTimer counts up — the window is seekDuration seconds total
    seeker.seekTimer += dt;

    // Continuously search for / validate target
    if (seeker.targetId >= 0) {
      const target = combat.enemies.find(e => e.id === seeker.targetId);
      if (!target || target.aiMode === 'destroyed') {
        seeker.targetId = findSeekerTarget(combat.enemies, state.player.position, playerFwd);
        seeker.lockTimer = 0;
        seeker.locked = false;
      }
    } else {
      seeker.targetId = findSeekerTarget(combat.enemies, state.player.position, playerFwd);
      seeker.lockTimer = 0;
    }

    // Lock acquisition — takes LOCK_TIME seconds once a target is being tracked
    if (seeker.targetId >= 0 && !seeker.locked) {
      seeker.lockTimer += dt;
      if (seeker.lockTimer >= LOCK_TIME) seeker.locked = true;
    }

    // Window expired without a lock — deactivate seeker
    if (!seeker.locked && seeker.seekTimer > seeker.seekDuration) {
      seeker.active = false;
      seeker.seekTimer = 0;
      seeker.lockTimer = 0;
      seeker.locked = false;
      seeker.targetId = -1;
    }

    // Fire missile on click when locked (edge-triggered on fire input)
    if (seeker.locked && seeker.targetId >= 0 && state.input.fire) {
      if (!fireMissileConsumed) {
        fireMissileConsumed = true;
        launchPlayerMissile(state, seeker.targetId);
        // Reset seeker for next missile
        seeker.locked = false;
        seeker.lockTimer = 0;
        seeker.targetId = findSeekerTarget(combat.enemies, state.player.position, playerFwd);
      }
    } else if (!state.input.fire) {
      fireMissileConsumed = false;
    }
  }
}

function launchPlayerMissile(state: GameState, targetId: number): void {
  const combat = state.combat;
  const missileSlot = combat.weaponSlots.find(ws => {
    const wd = getWeaponSync(ws.weaponId);
    return wd && wd.type === 'missile' && ws.ammo > 0 && ws.cooldown <= 0;
  });
  if (!missileSlot) return;
  const wData = getWeaponSync(missileSlot.weaponId);
  if (!wData) return;

  for (const m of combat.missiles) {
    if (!m.active) {
      const fwd = quatRotateVec3(state.player.rotation, { x: 0, y: 0, z: -1 });
      m.active = true;
      m.position = vec3Add(state.player.position, vec3Scale(fwd, 6));
      m.velocity = vec3Scale(fwd, wData.speed ?? MISSILE_SPEED);
      m.rotation = { ...state.player.rotation };
      m.age = 0;
      m.maxAge = wData.maxAge ?? MISSILE_MAX_AGE;
      m.speed = wData.speed ?? MISSILE_SPEED;
      m.turnRate = wData.turnRate ?? MISSILE_TURN_RATE;
      m.gLimit = wData.gLimit ?? 30;
      m.damage = wData.damage ?? 50;
      m.ownerId = 0;
      m.targetId = targetId;
      m.distracted = false;
      missileSlot.ammo--;
      missileSlot.cooldown = wData.cooldown ?? MISSILE_COOLDOWN;
      combat.playerMissileAmmo = combat.weaponSlots
        .filter(ws => { const w = getWeaponSync(ws.weaponId); return w && w.type === 'missile'; })
        .reduce((sum, ws) => sum + Math.max(0, ws.ammo), 0);
      break;
    }
  }
}

/** Launch a missile from an enemy (used by AI). */
export function enemyLaunchMissile(
  state: GameState, enemy: EnemyState,
  speed = MISSILE_SPEED, turnRate = MISSILE_TURN_RATE,
  gLimit = 25, damage = 50,
): void {
  for (const m of state.combat.missiles) {
    if (!m.active) {
      const fwd = quatRotateVec3(enemy.rotation, { x: 0, y: 0, z: -1 });
      m.active = true;
      m.position = vec3Add(enemy.position, vec3Scale(fwd, 6));
      m.velocity = vec3Scale(fwd, speed);
      m.rotation = { ...enemy.rotation };
      m.age = 0;
      m.maxAge = MISSILE_MAX_AGE;
      m.speed = speed;
      m.turnRate = turnRate;
      m.gLimit = gLimit;
      m.damage = damage;
      m.ownerId = enemy.id;
      m.targetId = 0; // target = player
      m.distracted = false;
      break;
    }
  }
}

export function updateMissileSystem(state: GameState): void {
  const dt = state.time.delta;
  const combat = state.combat;

  // ── Seeker (handles player lock & launch) ───────────────────────────────
  updateSeekerSystem(state);

  // ── Chaff tick ──────────────────────────────────────────────────────────
  combat.chaff.cooldown = Math.max(0, combat.chaff.cooldown - dt);
  if (combat.chaff.activeTimer > 0) combat.chaff.activeTimer -= dt;
  if (state.input.deployCountermeasure && combat.chaff.cooldown <= 0 && combat.chaff.ammo > 0) {
    combat.chaff.ammo--;
    combat.chaff.cooldown = 3.0;
    combat.chaff.activeTimer = combat.chaff.effectDuration;
  }

  // ── Update active missiles ──────────────────────────────────────────────
  for (const m of combat.missiles) {
    if (!m.active) continue;
    m.age += dt;
    if (m.age > m.maxAge) { m.active = false; continue; }

    // Chaff distraction: missiles targeting player check chaff
    if (!m.distracted && m.targetId === 0 && m.ownerId !== 0) {
      if (combat.chaff.activeTimer > 0 && Math.random() < combat.chaff.breakChance * dt) {
        m.distracted = true;
        m.targetId = -1;
      }
    }

    // Homing with G-limit
    if (m.targetId >= 0 && !m.distracted) {
      let targetPos: Vec3 | null = null;
      if (m.targetId === 0) {
        targetPos = state.player.position;
      } else {
        const target = combat.enemies.find(e => e.id === m.targetId);
        if (target && target.aiMode !== 'destroyed') {
          targetPos = target.position;
        } else {
          m.targetId = -1;
        }
      }

      if (targetPos) {
        const toTarget = vec3Normalize(vec3Sub(targetPos, m.position));
        const currentFwd = quatRotateVec3(m.rotation, { x: 0, y: 0, z: -1 });
        const axis = vec3Cross(currentFwd, toTarget);
        const axisLen = vec3Length(axis);
        if (axisLen > 0.001) {
          const dot = vec3Dot(currentFwd, toTarget);
          const angle = Math.acos(clamp(dot, -1, 1));
          // G-limit: max turn rate = gLimit * g / speed
          const maxTurnFromG = (m.gLimit * GRAVITY) / Math.max(m.speed, 50);
          const effectiveTurnRate = Math.min(m.turnRate, maxTurnFromG);
          const steer = Math.min(angle, effectiveTurnRate * dt);
          const normAxis = vec3Scale(axis, 1 / axisLen);
          const steerQ = quatFromAxisAngle(normAxis, steer);
          m.rotation = quatNormalize(quatMultiply(steerQ, m.rotation));
        }
      }
    }

    const fwd = quatRotateVec3(m.rotation, { x: 0, y: 0, z: -1 });
    m.velocity = vec3Scale(fwd, m.speed);
    m.position = vec3Add(m.position, vec3Scale(m.velocity, dt));
  }
}
