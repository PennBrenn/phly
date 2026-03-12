import type { GameState, Vec3 } from '@/state/gameState';
import {
  clamp,
  quatRotateVec3,
  quatFromAxisAngle,
  quatMultiply,
  quatNormalize,
  vec3Length,
  vec3Scale,
  vec3Add,
  vec3Normalize,
  vec3Dot,
  lerp,
} from '@/utils/math';
import { getTerrainHeight } from '@/utils/terrain';
import { spawnExplosion } from '@/simulation/combat/collisionSystem';

// ═══════════════════════════════════════════════════════════════════════════════
// ─── Arcade Aircraft Parameters ──────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════
const MASS          = 7000;    // kg
const MAX_THRUST    = 90000;   // N (flat, no altitude/speed variation)
const AB_THRUST_MUL = 1.5;
const WING_AREA     = 17.3;    // m²
const GRAVITY       = 9.81;    // m/s²

// Moment of inertia — controls how snappy rotation feels
const Ixx = 5000;   // roll
const Iyy = 18000;  // pitch
const Izz = 20000;  // yaw

// ─── Lift / Drag ─────────────────────────────────────────────────────────────
const CL_MAX    = 1.2;   // max lift coefficient
const CD_ZERO   = 0.022; // parasitic drag
const K_INDUCED = 0.08;  // induced drag factor

// Simple linear lift from AoA, capped
function liftCoefficient(alpha: number): number {
  return clamp(0.1 + 4.5 * alpha, -CL_MAX, CL_MAX);
}

// Drag: parasitic + induced only
function dragCoefficient(CL: number): number {
  return CD_ZERO + K_INDUCED * CL * CL;
}

// ─── Engine ──────────────────────────────────────────────────────────────────
const THROTTLE_RATE = 0.8;  // spool rate/sec
const AB_FUEL_DRAIN = 0.07;
const AB_FUEL_REGEN = 0.04;
const AB_MIN_FUEL   = 0.05;

// Simple exponential density falloff — no full ISA model
function densityRatio(altitude: number): number {
  return Math.exp(-altitude / 10000);
}

function engineThrust(throttle: number, afterburner: boolean, altitude: number): number {
  const abMul = afterburner ? AB_THRUST_MUL : 1.0;
  return MAX_THRUST * throttle * abMul * densityRatio(altitude);
}

// ─── Speed / flight limits ───────────────────────────────────────────────────
const MAX_SPEED        = 380;
const MAX_SPEED_AB     = 440;
// Stall is based on FORWARD speed (nose-aligned velocity), not total speed.
// This means tight turns that bleed lateral speed don't falsely trigger stall.
const STALL_SPEED      = 55;    // m/s forward — below this lift fades out
const STALL_WARN_MULT  = 1.15;  // warning fires at STALL_SPEED * this
const GROUND_CLEARANCE = 3;
const CRASH_SPEED      = 25;
const RESPAWN_DELAY    = 3.5;
const RHO_SL           = 1.225;

// ─── Control moments ─────────────────────────────────────────────────────────
const M_ELEVATOR = 120000;
const M_RUDDER   =  55000;
const M_AILERON  = 100000;

// Control authority scales with forward speed — feel responsive at all speeds,
// but not twitchy at very low speed. Smooth 0→1 ramp from 0 to FULL_AUTH_SPEED.
const FULL_AUTH_SPEED = 120; // m/s forward — full authority above this

// Arcade damping — angular velocity bleeds off when input is released
const PITCH_DAMPING = 0.90; // per-frame multiplier at 60fps equivalent
const YAW_DAMPING   = 0.88;
const ROLL_DAMPING  = 0.88;

const CONTROL_SMOOTH = 8.0; // input lerp speed

// Velocity alignment — gently nudges the velocity vector toward the nose.
// Not a stability restoring force; just removes the "flying sideways" feel
// without fighting the player's inputs. Scale it down to be very subtle.
const VEL_ALIGN_STRENGTH = 1.8; // m/s² per radian of misalignment

export function updateFlightPhysics(state: GameState): void {
  const dt = state.time.delta;
  if (dt <= 0 || dt > 0.1) return;

  const player = state.player;
  const input  = state.input;

  // ─── Crash / Respawn ───────────────────────────────────────────────────────
  if (player.isDead) {
    player.crashTimer += dt;
    if (player.crashTimer >= RESPAWN_DELAY) {
      player.isDead             = false;
      player.crashTimer         = 0;
      player.health             = 100;
      player.position           = { x: 0, y: 2500, z: 0 };
      player.rotation           = { x: 0, y: 0, z: 0, w: 1 };
      player.velocity           = { x: 0, y: 0, z: -90 };
      player.speed              = 90;
      player.throttle           = 1;
      player.afterburner        = false;
      player.afterburnerFuel    = 1.0;
      player.smoothPitch        = 0;
      player.smoothYaw          = 0;
      player.smoothRoll         = 0;
      player.controlDeflection  = { x: 0, y: 0, z: 0 };
      player.angularVelocity    = { x: 0, y: 0, z: 0 };
      player.angleOfAttack      = 0;
      player.sideslipAngle      = 0;
      player.machNumber         = 0;
      state.combat.weaponSlots = [
        { slot: 1, weaponId: 'cannon',     ammo: -1, cooldown: 0 },
        { slot: 2, weaponId: 'sidewinder', ammo: 2,  cooldown: 0 },
        { slot: 3, weaponId: 'sidewinder', ammo: 2,  cooldown: 0 },
        { slot: 4, weaponId: 'chaff',      ammo: 12, cooldown: 0 },
      ];
      state.combat.selectedSlot      = 1;
      state.combat.playerMissileAmmo = 4;
      state.combat.playerDamageFlash = 0;
      state.combat.chaff.ammo        = 12;
      state.combat.chaff.cooldown    = 0;
      state.combat.chaff.activeTimer = 0;
      state.combat.seeker.active     = false;
      state.combat.seeker.seekTimer  = 0;
      state.combat.seeker.lockTimer  = 0;
      state.combat.seeker.locked     = false;
      state.combat.seeker.targetId   = -1;
      state.combat.oob.isOOB         = false;
      state.combat.oob.oobTimer      = 0;
    }
    return;
  }

  // ─── Local axes ────────────────────────────────────────────────────────────
  const fwd   = quatRotateVec3(player.rotation, { x: 0, y: 0,  z: -1 });
  const upDir = quatRotateVec3(player.rotation, { x: 0, y: 1,  z:  0 });
  const right = quatRotateVec3(player.rotation, { x: 1, y: 0,  z:  0 });

  const speed = vec3Length(player.velocity);
  player.speed = speed;
  player.machNumber = speed / 340; // approximate, for HUD only

  // ─── Angle of attack (lift only, no stability derivatives) ────────────────
  let alpha = 0;
  let forwardSpeed = speed; // speed projected along nose
  if (speed > 2) {
    const velNorm  = vec3Normalize(player.velocity);
    const vFwd     = vec3Dot(velNorm, fwd);
    const vUp      = vec3Dot(velNorm, upDir);
    alpha          = Math.atan2(-vUp, Math.max(vFwd, 0.01));
    forwardSpeed   = Math.max(vec3Dot(player.velocity, fwd), 0); // nose-aligned component
  }
  player.angleOfAttack = alpha;
  player.sideslipAngle = 0;

  // ─── Lift & Drag ───────────────────────────────────────────────────────────
  const rho  = RHO_SL * densityRatio(player.position.y);
  const qBar = 0.5 * rho * speed * speed;

  // Stall based on FORWARD speed — turning hard won't falsely trigger it
  const stallFactor = clamp(forwardSpeed / STALL_SPEED, 0, 1);
  player.isStalling = forwardSpeed < STALL_SPEED * STALL_WARN_MULT;

  const CL = liftCoefficient(alpha) * stallFactor * stallFactor;
  const CD = dragCoefficient(CL);

  const liftForce = vec3Scale(upDir, CL * qBar * WING_AREA);
  const dragForce = speed > 0.5
    ? vec3Scale(vec3Normalize(player.velocity), -CD * qBar * WING_AREA)
    : { x: 0, y: 0, z: 0 } as Vec3;

  // ─── Velocity alignment (subtle — smooths out sideslip feel) ──────────────
  // Pushes velocity vector toward the nose direction, proportional to misalignment.
  // Purely a feel improvement; not a restoring/stability moment.
  let alignForce: Vec3 = { x: 0, y: 0, z: 0 };
  if (speed > 20) {
    const velNorm   = vec3Normalize(player.velocity);
    const alignment = vec3Dot(velNorm, fwd); // 1 = perfectly aligned
    const sideSlip  = Math.acos(clamp(alignment, -1, 1)); // radians of misalignment
    if (sideSlip > 0.01) {
      // Cross product gives the correction direction
      const corrX = fwd.x - velNorm.x * alignment;
      const corrY = fwd.y - velNorm.y * alignment;
      const corrZ = fwd.z - velNorm.z * alignment;
      const corrLen = Math.sqrt(corrX * corrX + corrY * corrY + corrZ * corrZ);
      if (corrLen > 0.001) {
        const strength = VEL_ALIGN_STRENGTH * sideSlip * stallFactor * MASS;
        alignForce = {
          x: corrX / corrLen * strength,
          y: corrY / corrLen * strength,
          z: corrZ / corrLen * strength,
        };
      }
    }
  }

  // ─── Throttle & Afterburner ────────────────────────────────────────────────
  if (input.throttleUp)   player.throttle = clamp(player.throttle + THROTTLE_RATE * dt, 0, 1);
  if (input.throttleDown) player.throttle = clamp(player.throttle - THROTTLE_RATE * dt, 0, 1);

  if (input.afterburnerToggle && player.afterburnerFuel > AB_MIN_FUEL && player.throttle > 0.9) {
    player.afterburner     = true;
    player.afterburnerFuel = Math.max(0, player.afterburnerFuel - AB_FUEL_DRAIN * dt);
    if (player.afterburnerFuel <= 0) player.afterburner = false;
  } else {
    player.afterburner     = false;
    player.afterburnerFuel = Math.min(1, player.afterburnerFuel + AB_FUEL_REGEN * dt);
  }

  // ─── Thrust ────────────────────────────────────────────────────────────────
  const thrustForce = vec3Scale(fwd, engineThrust(player.throttle, player.afterburner, player.position.y));

  // ─── Gravity ───────────────────────────────────────────────────────────────
  const weight: Vec3 = { x: 0, y: -MASS * GRAVITY, z: 0 };

  // ─── Sum forces → velocity ─────────────────────────────────────────────────
  const totalForce = vec3Add(vec3Add(vec3Add(vec3Add(thrustForce, liftForce), dragForce), weight), alignForce);
  const accel      = vec3Scale(totalForce, 1 / MASS);
  player.velocity  = vec3Add(player.velocity, vec3Scale(accel, dt));
  player.gForce    = 1 + vec3Dot(accel, upDir) / GRAVITY;

  // Speed cap
  const speedCap = player.afterburner ? MAX_SPEED_AB : MAX_SPEED;
  const newSpeed = vec3Length(player.velocity);
  if (newSpeed > speedCap) {
    player.velocity = vec3Scale(vec3Normalize(player.velocity), speedCap);
  }

  // ─── Control input ─────────────────────────────────────────────────────────
  let targetPitch = input.pitch;
  let targetYaw   = input.yaw;
  let targetRoll  = input.roll;

  if (input.useMouseAim) {
    targetPitch = clamp(input.pitch - input.mouseY * 0.9,  -1, 1);
    targetRoll  = clamp(input.roll  + input.mouseX * 1.3,  -1, 1);
    targetYaw   = clamp(input.yaw   - input.mouseX * 0.6,  -1, 1);
  }

  const smoothA      = Math.min(CONTROL_SMOOTH * dt, 1);
  player.smoothPitch = lerp(player.smoothPitch, targetPitch, smoothA);
  player.smoothYaw   = lerp(player.smoothYaw,   targetYaw,   smoothA);
  player.smoothRoll  = lerp(player.smoothRoll,  targetRoll,  smoothA);

  // Direct deflection — no slew rate limiter
  const cd = player.controlDeflection;
  cd.x = player.smoothPitch;
  cd.y = player.smoothYaw;
  cd.z = player.smoothRoll;

  // ─── Angular velocity from torque ─────────────────────────────────────────
  const omega = player.angularVelocity;

  // Authority ramps up with forward speed — prevents twitchy low-speed controls
  // while still giving full response once airborne and moving.
  const authFactor = clamp(forwardSpeed / FULL_AUTH_SPEED, 0.15, 1.0);

  omega.x += (cd.x * M_ELEVATOR / Iyy) * dt * authFactor;
  omega.y += (cd.y * M_RUDDER   / Izz) * dt * authFactor;
  omega.z += (cd.z * M_AILERON  / Ixx) * dt * authFactor;

  // Damping — bleeds off rotation naturally, snappy arcade feel
  omega.x *= Math.pow(PITCH_DAMPING, dt * 60);
  omega.y *= Math.pow(YAW_DAMPING,   dt * 60);
  omega.z *= Math.pow(ROLL_DAMPING,  dt * 60);

  // Hard clamp
  omega.x = clamp(omega.x, -4.0, 4.0);
  omega.y = clamp(omega.y, -2.0, 2.0);
  omega.z = clamp(omega.z, -5.0, 5.0);

  // ─── Apply rotation ────────────────────────────────────────────────────────
  const pitchQ = quatFromAxisAngle(right,  omega.x * dt);
  const yawQ   = quatFromAxisAngle(upDir,  omega.y * dt);
  const rollQ  = quatFromAxisAngle(fwd,    omega.z * dt);

  let newRot = quatMultiply(rollQ,  player.rotation);
  newRot     = quatMultiply(pitchQ, newRot);
  newRot     = quatMultiply(yawQ,   newRot);
  player.rotation = quatNormalize(newRot);

  // NaN guard
  if (isNaN(player.rotation.x) || isNaN(player.rotation.w)) {
    player.rotation        = { x: 0, y: 0, z: 0, w: 1 };
    player.velocity        = { x: 0, y: 0, z: -90 };
    player.angularVelocity = { x: 0, y: 0, z: 0 };
  }

  // ─── Integrate position ────────────────────────────────────────────────────
  player.position = vec3Add(player.position, vec3Scale(player.velocity, dt));

  // Ground collision
  const terrainH = getTerrainHeight(player.position.x, player.position.z);
  const groundH  = Math.max(terrainH, 0) + GROUND_CLEARANCE;
  if (player.position.y < groundH) {
    const impactSpeed = Math.abs(player.velocity.y);
    const totalSpd    = vec3Length(player.velocity);
    if (impactSpeed > CRASH_SPEED || totalSpd > CRASH_SPEED * 2) {
      player.isDead     = true;
      player.crashTimer = 0;
      player.health     = 0;
      player.velocity   = { x: 0, y: 0, z: 0 };
      player.position.y = groundH;
      state.combat.playerDamageFlash = 1.0;
      spawnExplosion(state.combat.explosions, player.position.x, player.position.y, player.position.z);
      return;
    }
    // Soft landing
    player.position.y = groundH;
    if (player.velocity.y < 0) player.velocity.y = 0;
    player.velocity.x = lerp(player.velocity.x, 0, dt * 2);
    player.velocity.z = lerp(player.velocity.z, 0, dt * 2);
    player.angularVelocity = { x: 0, y: 0, z: 0 };
  }

  // Shot down
  if (player.health <= 0) {
    player.isDead     = true;
    player.crashTimer = 0;
    player.health     = 0;
    state.combat.playerDamageFlash = 1.0;
    spawnExplosion(state.combat.explosions, player.position.x, player.position.y, player.position.z);
    return;
  }

  player.altitude = player.position.y;
}
