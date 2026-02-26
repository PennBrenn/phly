import type { GameState, Vec3 } from '@/state/gameState';
import type { EnemyState, Difficulty } from '@/state/combatState';
import { enemyFireBullet } from '@/simulation/combat/bulletSystem';
import { enemyLaunchMissile } from '@/simulation/combat/missileSystem';
import {
  vec3Sub, vec3Normalize, vec3Scale, vec3Add, vec3Length, vec3DistSq,
  quatRotateVec3, quatFromAxisAngle, quatMultiply, quatNormalize,
  vec3Cross, vec3Dot, clamp,
} from '@/utils/math';
import { getTerrainHeight } from '@/utils/terrain';

// ─── AI Constants ────────────────────────────────────────────────────────────
const PATROL_SPEED = 70;
const ENGAGE_SPEED = 110;
const TURN_RATE = 1.8;
const ENGAGE_RANGE = 1200;
const DISENGAGE_RANGE = 2000;
const FIRE_CONE = 0.92;
const FIRE_RANGE = 600;
const FIRE_INTERVAL = 0.4;
const MISSILE_FIRE_INTERVAL = 12;
const MIN_ALT = 80;
const TERRAIN_LOOK_AHEAD = 180;
const EVADE_DURATION = 3.0;
const CHAFF_COOLDOWN = 8.0;

// ─── Waypoints (patrol circuit) ──────────────────────────────────────────────
const WAYPOINTS: Vec3[] = [
  { x: 1500, y: 600, z: -1500 },
  { x: -1500, y: 700, z: -1500 },
  { x: -1500, y: 500, z: 1500 },
  { x: 1500, y: 650, z: 1500 },
  { x: 3000, y: 800, z: 0 },
  { x: -3000, y: 750, z: 0 },
];

function steerToward(enemy: EnemyState, targetDir: Vec3, dt: number, rate: number): void {
  const currentFwd = quatRotateVec3(enemy.rotation, { x: 0, y: 0, z: -1 });
  const axis = vec3Cross(currentFwd, targetDir);
  const axisLen = vec3Length(axis);
  if (axisLen < 0.001) return;
  const dot = vec3Dot(currentFwd, targetDir);
  const angle = Math.acos(clamp(dot, -1, 1));
  const steer = Math.min(angle, rate * enemy.maneuverMul * dt);
  const normAxis = vec3Scale(axis, 1 / axisLen);
  const steerQ = quatFromAxisAngle(normAxis, steer);
  enemy.rotation = quatNormalize(quatMultiply(steerQ, enemy.rotation));
}

function makeDefaultEnemy(id: number, pos: Vec3, wpIdx: number): EnemyState {
  return {
    id,
    position: { ...pos },
    rotation: { x: 0, y: 0, z: 0, w: 1 },
    velocity: { x: 0, y: 0, z: -PATROL_SPEED },
    speed: PATROL_SPEED,
    health: 100,
    maxHealth: 100,
    aiMode: 'patrol',
    fireTimer: 0,
    missileFireTimer: MISSILE_FIRE_INTERVAL,
    waypointIndex: wpIdx,
    hitFlashTimer: 0,
    destroyedTimer: 0,
    collisionRadius: 8,
    isGround: false,
    vehicleId: 'delta',
    canMove: false,
    patrolCenter: { x: 0, y: 0, z: 0 },
    patrolRadius: 0,
    patrolAngle: 0,
    canFireMissiles: false,
    chaffTimer: 0,
    chaffAmmo: 2,
    evadeTimer: 0,
    terrainAvoidCooldown: 0,
    maneuverMul: 1.0,
    fireRateMul: 1.0,
  };
}

/** Apply difficulty scaling multipliers to enemy. */
function applyDifficulty(e: EnemyState, diff: Difficulty): void {
  const muls: Record<Difficulty, { hp: number; man: number; fr: number; missiles: boolean; chaff: number }> = {
    easy:   { hp: 0.7, man: 0.6, fr: 0.5, missiles: false, chaff: 0 },
    normal: { hp: 1.0, man: 1.0, fr: 1.0, missiles: true,  chaff: 2 },
    hard:   { hp: 1.5, man: 1.3, fr: 1.5, missiles: true,  chaff: 4 },
    ace:    { hp: 2.0, man: 1.6, fr: 2.0, missiles: true,  chaff: 6 },
  };
  const m = muls[diff];
  e.health = Math.round(e.health * m.hp);
  e.maxHealth = e.health;
  e.maneuverMul = m.man;
  e.fireRateMul = m.fr;
  e.canFireMissiles = m.missiles && !e.isGround;
  e.chaffAmmo = m.chaff;
}

export function spawnEnemies(state: GameState, count: number): void {
  const combat = state.combat;
  const diff = combat.difficulty;
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    const radius = 1800 + Math.random() * 800;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    const y = 500 + Math.random() * 400;
    const e = makeDefaultEnemy(combat.enemies.length + 1, { x, y, z }, i % WAYPOINTS.length);
    applyDifficulty(e, diff);
    combat.enemies.push(e);
  }
}

export function spawnGroundEnemy(
  state: GameState,
  pos: Vec3,
  vehicleId: string,
  moving: boolean,
  patrolRadius: number,
): void {
  const combat = state.combat;
  const terrainH = Math.max(getTerrainHeight(pos.x, pos.z), 0);
  const e = makeDefaultEnemy(combat.enemies.length + 1, { x: pos.x, y: terrainH, z: pos.z }, 0);
  e.isGround = true;
  e.vehicleId = vehicleId;
  e.canMove = moving;
  e.patrolCenter = { x: pos.x, y: terrainH, z: pos.z };
  e.patrolRadius = patrolRadius;
  e.patrolAngle = Math.random() * Math.PI * 2;
  e.collisionRadius = 6;
  e.health = 80;
  e.maxHealth = 80;
  e.speed = 0;
  applyDifficulty(e, combat.difficulty);
  combat.enemies.push(e);
}

// ── Check if an incoming missile is targeting this enemy ──────────────────
function isBeingTrackedByMissile(state: GameState, enemyId: number): boolean {
  for (const m of state.combat.missiles) {
    if (m.active && m.targetId === enemyId && m.ownerId === 0) return true;
  }
  return false;
}

export function updateEnemyAI(state: GameState): void {
  const dt = state.time.delta;
  const combat = state.combat;
  const playerPos = state.player.position;

  for (const e of combat.enemies) {
    if (e.aiMode === 'destroyed') {
      if (e.isGround) continue; // ground units don't fall
      e.velocity.y -= 9.81 * dt;
      e.position = vec3Add(e.position, vec3Scale(e.velocity, dt));
      continue;
    }

    // ── Ground enemy AI ──────────────────────────────────────────────────
    if (e.isGround) {
      updateGroundEnemyAI(state, e, dt);
      continue;
    }

    // ── Air enemy AI ─────────────────────────────────────────────────────
    const distSqToPlayer = vec3DistSq(e.position, playerPos);
    const distToPlayer = Math.sqrt(distSqToPlayer);

    // Missile evasion check
    if (e.evadeTimer > 0) {
      e.evadeTimer -= dt;
      e.aiMode = 'evade';
    } else if (isBeingTrackedByMissile(state, e.id)) {
      e.evadeTimer = EVADE_DURATION;
      e.aiMode = 'evade';
      // Deploy chaff if available
      if (e.chaffAmmo > 0 && e.chaffTimer <= 0) {
        e.chaffAmmo--;
        e.chaffTimer = CHAFF_COOLDOWN;
        // Distract the missile
        for (const m of combat.missiles) {
          if (m.active && m.targetId === e.id && m.ownerId === 0 && !m.distracted) {
            if (Math.random() < 0.7) { m.distracted = true; m.targetId = -1; }
          }
        }
      }
    }
    if (e.chaffTimer > 0) e.chaffTimer -= dt;

    // State transitions (skip if evading)
    if (e.aiMode !== 'evade') {
      switch (e.aiMode) {
        case 'patrol':
          if (distToPlayer < ENGAGE_RANGE) e.aiMode = 'engage';
          break;
        case 'engage':
          if (distToPlayer > DISENGAGE_RANGE) e.aiMode = 'patrol';
          else if (distToPlayer < FIRE_RANGE) {
            const fwd = quatRotateVec3(e.rotation, { x: 0, y: 0, z: -1 });
            const toPlayer = vec3Normalize(vec3Sub(playerPos, e.position));
            if (vec3Dot(fwd, toPlayer) > FIRE_CONE) e.aiMode = 'fire';
          }
          break;
        case 'fire':
          if (distToPlayer > FIRE_RANGE * 1.3) e.aiMode = 'engage';
          else if (distToPlayer > DISENGAGE_RANGE) e.aiMode = 'patrol';
          break;
      }
    }

    // Behaviour
    let targetSpeed = PATROL_SPEED;

    if (e.aiMode === 'evade') {
      targetSpeed = ENGAGE_SPEED * 1.2;
      // Evasive maneuver: break turn perpendicular to incoming threat
      const toPlayer = vec3Normalize(vec3Sub(playerPos, e.position));
      const right = vec3Cross(toPlayer, { x: 0, y: 1, z: 0 });
      const evadeDir = vec3Normalize(vec3Add(right, { x: 0, y: 0.4, z: 0 }));
      steerToward(e, evadeDir, dt, TURN_RATE * 1.5);
    } else if (e.aiMode === 'patrol') {
      const wp = WAYPOINTS[e.waypointIndex];
      const toWp = vec3Sub(wp, e.position);
      const wpDist = vec3Length(toWp);
      if (wpDist < 100) {
        e.waypointIndex = (e.waypointIndex + 1) % WAYPOINTS.length;
      } else {
        steerToward(e, vec3Normalize(toWp), dt, TURN_RATE * 0.7);
      }
    } else if (e.aiMode === 'engage' || e.aiMode === 'fire') {
      targetSpeed = ENGAGE_SPEED;
      const toPlayer = vec3Normalize(vec3Sub(playerPos, e.position));
      steerToward(e, toPlayer, dt, TURN_RATE);

      if (e.aiMode === 'fire') {
        e.fireTimer -= dt;
        if (e.fireTimer <= 0) {
          const fwd = quatRotateVec3(e.rotation, { x: 0, y: 0, z: -1 });
          const spawnPos = vec3Add(e.position, vec3Scale(fwd, 8));
          enemyFireBullet(combat.bullets, spawnPos, fwd, e.id);
          e.fireTimer = FIRE_INTERVAL / e.fireRateMul;
        }
      }

      // Missile firing (non-easy)
      if (e.canFireMissiles) {
        e.missileFireTimer -= dt;
        if (e.missileFireTimer <= 0 && distToPlayer < ENGAGE_RANGE) {
          enemyLaunchMissile(state, e);
          e.missileFireTimer = MISSILE_FIRE_INTERVAL / e.fireRateMul;
        }
      }
    }

    // Movement
    e.speed += (targetSpeed - e.speed) * dt * 2;
    const fwd = quatRotateVec3(e.rotation, { x: 0, y: 0, z: -1 });
    e.velocity = vec3Scale(fwd, e.speed);
    e.position = vec3Add(e.position, vec3Scale(e.velocity, dt));

    // Terrain avoidance: look ahead and pull up if needed
    const terrainH = Math.max(getTerrainHeight(e.position.x, e.position.z), 0);
    const aheadX = e.position.x + fwd.x * TERRAIN_LOOK_AHEAD;
    const aheadZ = e.position.z + fwd.z * TERRAIN_LOOK_AHEAD;
    const terrainAhead = Math.max(getTerrainHeight(aheadX, aheadZ), 0);
    const maxTerrain = Math.max(terrainH, terrainAhead);

    if (e.position.y < maxTerrain + MIN_ALT) {
      e.position.y = Math.max(e.position.y, terrainH + MIN_ALT * 0.5);
      // Aggressive pull-up
      const pullUpDir = vec3Normalize({ x: fwd.x, y: 1.0, z: fwd.z });
      steerToward(e, pullUpDir, dt, TURN_RATE * 2.0);
    } else if (terrainAhead > e.position.y - MIN_ALT * 2) {
      // Preemptive climb
      const climbDir = vec3Normalize({ x: fwd.x, y: 0.5, z: fwd.z });
      steerToward(e, climbDir, dt, TURN_RATE * 1.2);
    }
  }
}

function updateGroundEnemyAI(state: GameState, e: EnemyState, dt: number): void {
  const playerPos = state.player.position;
  const combat = state.combat;

  // Keep on terrain surface
  const terrainH = Math.max(getTerrainHeight(e.position.x, e.position.z), 0);
  e.position.y = terrainH;

  // Patrol movement (if can move)
  if (e.canMove && e.patrolRadius > 0) {
    e.patrolAngle += 0.15 * dt;
    const targetX = e.patrolCenter.x + Math.cos(e.patrolAngle) * e.patrolRadius;
    const targetZ = e.patrolCenter.z + Math.sin(e.patrolAngle) * e.patrolRadius;
    const toTarget = vec3Normalize(vec3Sub({ x: targetX, y: e.position.y, z: targetZ }, e.position));
    steerToward(e, toTarget, dt, 0.5);
    e.speed = 8;
    const fwd = quatRotateVec3(e.rotation, { x: 0, y: 0, z: -1 });
    e.position.x += fwd.x * e.speed * dt;
    e.position.z += fwd.z * e.speed * dt;
    // Re-snap Y
    e.position.y = Math.max(getTerrainHeight(e.position.x, e.position.z), 0);
  }

  // Turret: always face toward player
  const toPlayer = vec3Sub(playerPos, e.position);
  const distToPlayer = vec3Length(toPlayer);
  if (distToPlayer > 1) {
    const dir = vec3Normalize(toPlayer);
    steerToward(e, dir, dt, 1.5);
  }

  // State: engage if player is in range
  if (distToPlayer < 800) {
    e.aiMode = 'fire';
    e.fireTimer -= dt;
    if (e.fireTimer <= 0) {
      const fwd = quatRotateVec3(e.rotation, { x: 0, y: 0, z: -1 });
      const spawnPos = vec3Add(e.position, vec3Scale(fwd, 5));
      spawnPos.y += 3; // barrel height
      enemyFireBullet(combat.bullets, spawnPos, fwd, e.id, 600, 12);
      e.fireTimer = 1.5 / e.fireRateMul;
    }
  } else {
    e.aiMode = 'patrol';
  }
}
