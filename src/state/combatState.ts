import type { Vec3, Quat } from '@/state/gameState';

// ─── Bullet ──────────────────────────────────────────────────────────────────
export interface BulletState {
  active: boolean;
  position: Vec3;
  velocity: Vec3;
  age: number;
  damage: number;
  ownerId: number; // 0 = player, >0 = enemy id
}

// ─── Missile ─────────────────────────────────────────────────────────────────
export interface MissileState {
  active: boolean;
  position: Vec3;
  velocity: Vec3;
  rotation: Quat;
  age: number;
  maxAge: number;
  speed: number;
  turnRate: number;
  gLimit: number;        // max G the missile can pull
  damage: number;
  targetId: number;      // enemy id, -1 = no target
  ownerId: number;       // 0 = player, >0 = enemy id
  distracted: boolean;   // true if chaff broke the lock
}

// ─── Seeker / Lock state (player) ────────────────────────────────────────────
export interface SeekerState {
  active: boolean;        // is the seeker engaged
  seekTimer: number;      // total time seeker has been active
  lockTimer: number;      // time spent tracking current target (resets on target change)
  seekDuration: number;   // required time to achieve lock
  locked: boolean;        // achieved lock
  targetId: number;       // enemy being tracked, -1 = none
}

// ─── Weapon slot ─────────────────────────────────────────────────────────────
export interface WeaponSlotState {
  slot: number;           // 1-based index
  weaponId: string;       // references JSON id
  ammo: number;           // -1 = infinite (gun)
  cooldown: number;       // seconds remaining
}

// ─── Chaff / Flare ───────────────────────────────────────────────────────────
export interface ChaffState {
  ammo: number;
  cooldown: number;
  activeTimer: number;    // seconds remaining of active chaff cloud
  effectDuration: number;
  breakChance: number;
}

// ─── Enemy AI ────────────────────────────────────────────────────────────────
export type AIMode = 'patrol' | 'engage' | 'fire' | 'evade' | 'destroyed';

export interface EnemyState {
  id: number;
  position: Vec3;
  rotation: Quat;
  velocity: Vec3;
  speed: number;
  health: number;
  maxHealth: number;
  aiMode: AIMode;
  fireTimer: number;
  missileFireTimer: number;
  waypointIndex: number;
  hitFlashTimer: number;
  destroyedTimer: number;
  collisionRadius: number;
  // Ground enemy fields
  isGround: boolean;
  vehicleId: string;
  canMove: boolean;
  patrolCenter: Vec3;
  patrolRadius: number;
  patrolAngle: number;
  // AI enhancements
  canFireMissiles: boolean;
  chaffTimer: number;
  chaffAmmo: number;
  evadeTimer: number;
  terrainAvoidCooldown: number;
  // Difficulty scaling (applied at spawn)
  maneuverMul: number;
  fireRateMul: number;
}

// ─── Explosion ───────────────────────────────────────────────────────────────
export interface FragmentState {
  position: Vec3;
  velocity: Vec3;
}

export interface ExplosionState {
  active: boolean;
  position: Vec3;
  age: number;
  maxAge: number;
  fragments: FragmentState[];
}

// ─── Difficulty ──────────────────────────────────────────────────────────────
export type Difficulty = 'easy' | 'normal' | 'hard' | 'ace';

// ─── Out of bounds ───────────────────────────────────────────────────────────
export interface OOBState {
  isOOB: boolean;
  oobTimer: number;       // seconds player has been out of bounds
  oobMaxTime: number;     // seconds before forced respawn
  warningDir: Vec3;       // direction back to center
}

// ─── Pool sizes ──────────────────────────────────────────────────────────────
export const MAX_BULLETS = 60;
export const MAX_MISSILES = 12;
export const MAX_ENEMIES = 16;
export const MAX_EXPLOSIONS = 12;
export const PLAYER_COLLISION_RADIUS = 6;

// ─── Defaults from JSON (overridden at load time) ────────────────────────────
export const BULLET_SPEED = 800;
export const BULLET_MAX_AGE = 2.0;
export const BULLET_FIRE_RATE = 12;
export const MISSILE_SPEED = 250;
export const MISSILE_MAX_AGE = 8.0;
export const MISSILE_TURN_RATE = 2.5;

export interface CombatState {
  bullets: BulletState[];
  missiles: MissileState[];
  enemies: EnemyState[];
  explosions: ExplosionState[];
  // Weapon slots (replaces flat ammo)
  weaponSlots: WeaponSlotState[];
  selectedSlot: number;           // 1-based
  // Seeker
  seeker: SeekerState;
  // Chaff/flare
  chaff: ChaffState;
  // Legacy compat fields (still used by some systems)
  playerMissileAmmo: number;
  fireCooldown: number;
  missileCooldown: number;
  playerDamageFlash: number;
  // OOB
  oob: OOBState;
  // Difficulty
  difficulty: Difficulty;
}

export function createCombatState(): CombatState {
  const bullets: BulletState[] = [];
  for (let i = 0; i < MAX_BULLETS; i++) {
    bullets.push({
      active: false,
      position: { x: 0, y: 0, z: 0 },
      velocity: { x: 0, y: 0, z: 0 },
      age: 0,
      damage: 8,
      ownerId: 0,
    });
  }

  const missiles: MissileState[] = [];
  for (let i = 0; i < MAX_MISSILES; i++) {
    missiles.push({
      active: false,
      position: { x: 0, y: 0, z: 0 },
      velocity: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0, w: 1 },
      age: 0,
      maxAge: MISSILE_MAX_AGE,
      speed: MISSILE_SPEED,
      turnRate: MISSILE_TURN_RATE,
      gLimit: 30,
      damage: 50,
      targetId: -1,
      ownerId: 0,
      distracted: false,
    });
  }

  const explosions: ExplosionState[] = [];
  for (let i = 0; i < MAX_EXPLOSIONS; i++) {
    explosions.push({
      active: false,
      position: { x: 0, y: 0, z: 0 },
      age: 0,
      maxAge: 1.5,
      fragments: [],
    });
  }

  return {
    bullets,
    missiles,
    enemies: [],
    explosions,
    weaponSlots: [
      { slot: 1, weaponId: 'cannon',    ammo: -1, cooldown: 0 },
      { slot: 2, weaponId: 'sidewinder', ammo: 2,  cooldown: 0 },
      { slot: 3, weaponId: 'sidewinder', ammo: 2,  cooldown: 0 },
      { slot: 4, weaponId: 'chaff',      ammo: 12, cooldown: 0 },
    ],
    selectedSlot: 1,
    seeker: {
      active: false,
      seekTimer: 0,
      lockTimer: 0,
      seekDuration: 8,
      locked: false,
      targetId: -1,
    },
    chaff: {
      ammo: 12,
      cooldown: 0,
      activeTimer: 0,
      effectDuration: 4.0,
      breakChance: 0.85,
    },
    playerMissileAmmo: 4,
    fireCooldown: 0,
    missileCooldown: 0,
    playerDamageFlash: 0,
    oob: {
      isOOB: false,
      oobTimer: 0,
      oobMaxTime: 10,
      warningDir: { x: 0, y: 0, z: 0 },
    },
    difficulty: 'normal',
  };
}
