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

// ─── Aircraft parameters (F-5E Tiger II inspired) ────────────────────────────
const MASS = 7000;             // kg  empty+fuel
const MAX_THRUST_N = 50000;    // N   (two J85 engines)
const WING_AREA = 17.3;        // m²
const WING_SPAN = 8.1;         // m
const ASPECT_RATIO = WING_SPAN * WING_SPAN / WING_AREA;
const GRAVITY = 9.81;          // m/s²

// Atmosphere (simplified — constant for now)
const RHO = 1.0;              // kg/m³ sea-level-ish

// Lift polar
const CL_ZERO = 0.1;          // CL at zero AoA (slight camber)
const CL_ALPHA = 4.8;         // dCL/dAlpha per radian (thin wing)
const STALL_ALPHA = 0.26;     // ~15° critical AoA
const CL_MAX = CL_ZERO + CL_ALPHA * STALL_ALPHA;

// Drag polar  CD = CD0 + K * CL²
const CD_ZERO = 0.020;        // clean config
const OSWALD = 0.78;
const K_INDUCED = 1 / (Math.PI * OSWALD * ASPECT_RATIO);
// Compressibility drag rise near Mach 1
const MACH_CRIT = 0.85;       // drag divergence onset
const SPEED_OF_SOUND = 340;   // m/s at sea level

// Stall
const STALL_SPEED = 55;       // m/s — below this, lift fades

// Control surface max deflection rates (rad/s at max q-bar authority)
const PITCH_RATE_MAX = 2.6;
const YAW_RATE_MAX = 0.75;
const ROLL_RATE_MAX = 3.2;
// Control surfaces produce torque proportional to dynamic pressure.
// REF_Q is the dynamic pressure at which deflection rates are 100%.
const REF_Q = 0.5 * RHO * 90 * 90;   // ~90 m/s reference
// G-load limiting — structural limit dampens pitch authority
const G_LIMIT = 7.0;

// How fast control surfaces physically move (smoothing toward input)
// Lower = more fluid/gradual, higher = snappier
const CONTROL_SMOOTHING = 5.0;

// Secondary smoothing pass on angular rates to prevent jitter
const RATE_SMOOTHING = 6.0;

// Aerodynamic coupling: velocity bleeds toward nose direction
// (sideslip damping / weathervane effect)
const AERO_COUPLING = 2.5;

const THROTTLE_RATE = 0.6;     // throttle change per second (slower spool)
const MAX_SPEED = 360;         // hard cap m/s (military power)
const MAX_SPEED_AB = 420;      // hard cap m/s (afterburner)
const GROUND_CLEARANCE = 3;    // meters above terrain for collision
const CRASH_SPEED = 25;        // impact speed threshold (m/s) for crash
const RESPAWN_DELAY = 3.5;     // seconds before respawn

// Afterburner / WEP
const AB_THRUST_MUL = 1.55;    // thrust multiplier when AB active
const AB_FUEL_DRAIN = 0.08;    // fuel consumed per second (12.5s full burn)
const AB_FUEL_REGEN = 0.04;    // fuel regen per second when off (~25s full recharge)
const AB_MIN_FUEL = 0.05;      // minimum fuel to ignite AB

// Turn-induced drag
const TURN_DRAG_COEFF = 0.015; // extra CD per (rad/s)² of angular rate

// ─── Helpers ──────────────────────────────────────────────────────────────────
function vec3Sub(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

// Smoothed angular rates (persistent across frames)
let smoothedPitchRate = 0;
let smoothedYawRate = 0;
let smoothedRollRate = 0;

export function updateFlightPhysics(state: GameState): void {
  const dt = state.time.delta;
  if (dt <= 0 || dt > 0.1) return;

  const player = state.player;
  const input = state.input;

  // ─── Crash / death handling ────────────────────────────────────────────
  if (player.isDead) {
    player.crashTimer += dt;
    if (player.crashTimer >= RESPAWN_DELAY) {
      // Respawn
      player.isDead = false;
      player.crashTimer = 0;
      player.health = 100;
      player.position = { x: 0, y: 2500, z: 0 };
      player.rotation = { x: 0, y: 0, z: 0, w: 1 };
      player.velocity = { x: 0, y: 0, z: -90 };
      player.speed = 90;
      player.throttle = 1;
      player.afterburner = false;
      player.afterburnerFuel = 1.0;
      player.smoothPitch = 0;
      player.smoothYaw = 0;
      player.smoothRoll = 0;
      smoothedPitchRate = 0;
      smoothedYawRate = 0;
      smoothedRollRate = 0;
      // Reset weapon slots
      state.combat.weaponSlots = [
        { slot: 1, weaponId: 'cannon',    ammo: -1, cooldown: 0 },
        { slot: 2, weaponId: 'sidewinder', ammo: 2,  cooldown: 0 },
        { slot: 3, weaponId: 'sidewinder', ammo: 2,  cooldown: 0 },
        { slot: 4, weaponId: 'chaff',      ammo: 12, cooldown: 0 },
      ];
      state.combat.selectedSlot = 1;
      state.combat.playerMissileAmmo = 4;
      state.combat.playerDamageFlash = 0;
      // Reset chaff
      state.combat.chaff.ammo = 12;
      state.combat.chaff.cooldown = 0;
      state.combat.chaff.activeTimer = 0;
      // Reset seeker
      state.combat.seeker.active = false;
      state.combat.seeker.seekTimer = 0;
      state.combat.seeker.lockTimer = 0;
      state.combat.seeker.locked = false;
      state.combat.seeker.targetId = -1;
      // Reset OOB
      state.combat.oob.isOOB = false;
      state.combat.oob.oobTimer = 0;
    }
    return;
  }

  // ─── Throttle (gradual spool) ───────────────────────────────────────────
  if (input.throttleUp) {
    player.throttle = clamp(player.throttle + THROTTLE_RATE * dt, 0, 1);
  }
  if (input.throttleDown) {
    player.throttle = clamp(player.throttle - THROTTLE_RATE * dt, 0, 1);
  }

  // ─── Local axes ─────────────────────────────────────────────────────────
  const fwd   = quatRotateVec3(player.rotation, { x: 0, y: 0, z: -1 });
  const upDir = quatRotateVec3(player.rotation, { x: 0, y: 1, z: 0 });
  const right = quatRotateVec3(player.rotation, { x: 1, y: 0, z: 0 });

  // ─── Speed & dynamic pressure ───────────────────────────────────────────
  const speed = vec3Length(player.velocity);
  player.speed = speed;
  const qBar = 0.5 * RHO * speed * speed;  // dynamic pressure (Pa)

  // ─── Angle of Attack ────────────────────────────────────────────────────
  // Project velocity into the plane's pitch plane (fwd/up) to get signed AoA
  let aoa = 0;
  if (speed > 2) {
    const velNorm = vec3Normalize(player.velocity);
    // Component of velocity along forward and up
    const vFwd = vec3Dot(velNorm, fwd);
    const vUp  = vec3Dot(velNorm, upDir);
    // AoA = angle from forward in the pitch plane, positive = nose above vel
    aoa = Math.atan2(-vUp, vFwd);
  }

  // ─── Lift coefficient ───────────────────────────────────────────────────
  let CL: number;
  const absAoa = Math.abs(aoa);
  if (absAoa <= STALL_ALPHA) {
    // Linear region
    CL = CL_ZERO + CL_ALPHA * aoa;
  } else {
    // Post-stall: CL drops off smoothly
    const sign = aoa >= 0 ? 1 : -1;
    const excess = absAoa - STALL_ALPHA;
    const dropoff = 1 / (1 + 8 * excess * excess); // smooth falloff
    CL = sign * CL_MAX * dropoff;
  }

  // Low-speed stall factor — lift fades as speed drops below stall speed
  const stallRatio = clamp(speed / STALL_SPEED, 0, 1);
  const stallFactor = stallRatio * stallRatio; // quadratic fade
  CL *= stallFactor;
  player.isStalling = speed < STALL_SPEED * 1.1 || absAoa > STALL_ALPHA;

  // ─── Drag coefficient ───────────────────────────────────────────────────
  let CD = CD_ZERO + K_INDUCED * CL * CL;
  // Compressibility drag rise
  const mach = speed / SPEED_OF_SOUND;
  if (mach > MACH_CRIT) {
    const dm = mach - MACH_CRIT;
    CD += 0.2 * dm * dm;  // wave drag
  }
  // Turn-induced drag: tighter turns = more drag = speed bleeds
  const angRate = Math.abs(smoothedPitchRate) + Math.abs(smoothedYawRate) + Math.abs(smoothedRollRate) * 0.3;
  CD += TURN_DRAG_COEFF * angRate * angRate;

  // ─── Aerodynamic forces (Newtons) ───────────────────────────────────────
  const liftN = CL * qBar * WING_AREA;
  const dragN = CD * qBar * WING_AREA;

  // Lift along plane's up axis
  const liftForce = vec3Scale(upDir, liftN);
  // Drag opposite to velocity
  const dragForce = speed > 0.5
    ? vec3Scale(vec3Normalize(player.velocity), -dragN)
    : { x: 0, y: 0, z: 0 };

  // ─── Afterburner ──────────────────────────────────────────────────────
  if (input.afterburnerToggle && player.afterburnerFuel > AB_MIN_FUEL && player.throttle > 0.9) {
    player.afterburner = true;
    player.afterburnerFuel = Math.max(0, player.afterburnerFuel - AB_FUEL_DRAIN * dt);
    if (player.afterburnerFuel <= 0) player.afterburner = false;
  } else {
    player.afterburner = false;
    player.afterburnerFuel = Math.min(1, player.afterburnerFuel + AB_FUEL_REGEN * dt);
  }

  // ─── Thrust ─────────────────────────────────────────────────────────────
  const abMul = player.afterburner ? AB_THRUST_MUL : 1.0;
  const thrustN = MAX_THRUST_N * abMul * (0.6 * player.throttle + 0.4 * player.throttle * player.throttle);
  const thrustForce = vec3Scale(fwd, thrustN);

  // ─── Gravity ────────────────────────────────────────────────────────────
  const weight = { x: 0, y: -MASS * GRAVITY, z: 0 };

  // ─── Aerodynamic coupling (sideslip damping) ────────────────────────────
  let couplingForce = { x: 0, y: 0, z: 0 };
  if (speed > 5) {
    const velNorm = vec3Normalize(player.velocity);
    const diff = vec3Sub(fwd, velNorm);
    // Scale with dynamic pressure — stronger coupling at higher speed
    const strength = AERO_COUPLING * clamp(qBar / 4000, 0, 1);
    couplingForce = vec3Scale(diff, strength * speed * MASS);
  }

  // ─── Sum forces → F/m → integrate velocity ──────────────────────────────
  let totalForce = vec3Add(thrustForce, liftForce);
  totalForce = vec3Add(totalForce, dragForce);
  totalForce = vec3Add(totalForce, weight);
  totalForce = vec3Add(totalForce, couplingForce);

  const accel = vec3Scale(totalForce, 1 / MASS);
  player.velocity = vec3Add(player.velocity, vec3Scale(accel, dt));

  // G-force (acceleration magnitude / g, projected onto plane's up axis)
  const accelNoGrav = vec3Scale(totalForce, 1 / MASS);
  player.gForce = 1 + vec3Dot(accelNoGrav, upDir) / GRAVITY;

  // Clamp max speed (higher cap with afterburner)
  const speedCap = player.afterburner ? MAX_SPEED_AB : MAX_SPEED;
  const newSpeed = vec3Length(player.velocity);
  if (newSpeed > speedCap) {
    player.velocity = vec3Scale(vec3Normalize(player.velocity), speedCap);
  }

  // ─── Control surfaces (gradual, speed-dependent) ────────────────────────
  // Raw input targets (keyboard + mouse)
  let targetPitch = input.pitch;
  let targetYaw   = input.yaw;
  let targetRoll  = input.roll;

  if (input.useMouseAim) {
    // Mouse and keyboard are fully independent: keyboard input is always applied,
    // mouse adds on top. This means A/D roll still works even when mouse is off-center.
    targetPitch = clamp(input.pitch  - input.mouseY * 0.9,  -1, 1);
    targetRoll  = clamp(input.roll   + input.mouseX * 1.3,  -1, 1);
    targetYaw   = clamp(input.yaw    - input.mouseX * 0.25, -1, 1);
  }

  // Smooth control deflections (simulates hydraulic actuator lag)
  const smoothAlpha = Math.min(CONTROL_SMOOTHING * dt, 1);
  player.smoothPitch = lerp(player.smoothPitch, targetPitch, smoothAlpha);
  player.smoothYaw   = lerp(player.smoothYaw,   targetYaw,   smoothAlpha);
  player.smoothRoll  = lerp(player.smoothRoll,  targetRoll,  smoothAlpha);

  // Authority from dynamic pressure: controls are aerodynamic surfaces,
  // so their effectiveness scales with qBar.
  // Floor of 0.12 so the plane is always somewhat controllable.
  const qAuthority = clamp(qBar / REF_Q, 0.12, 1.8);

  // G-limit dampening: reduce pitch authority if we're near structural limit
  const gRatio = Math.abs(player.gForce) / G_LIMIT;
  const gDampen = gRatio > 0.8 ? clamp(1 - (gRatio - 0.8) * 5, 0.1, 1) : 1;

  const rawPitchRate = player.smoothPitch * PITCH_RATE_MAX * qAuthority * gDampen;
  const rawYawRate   = player.smoothYaw   * YAW_RATE_MAX   * qAuthority;
  const rawRollRate  = player.smoothRoll  * ROLL_RATE_MAX  * qAuthority;

  // Second smoothing pass on angular rates — prevents jittery rotation
  const rateAlpha = Math.min(RATE_SMOOTHING * dt, 1);
  smoothedPitchRate = lerp(smoothedPitchRate, rawPitchRate, rateAlpha);
  smoothedYawRate   = lerp(smoothedYawRate,   rawYawRate,   rateAlpha);
  smoothedRollRate  = lerp(smoothedRollRate,  rawRollRate,  rateAlpha);

  const pitchQ = quatFromAxisAngle(right, smoothedPitchRate * dt);
  const yawQ   = quatFromAxisAngle(upDir, smoothedYawRate   * dt);
  const rollQ  = quatFromAxisAngle(fwd,   smoothedRollRate  * dt);

  let newRot = quatMultiply(rollQ, player.rotation);
  newRot = quatMultiply(pitchQ, newRot);
  newRot = quatMultiply(yawQ,   newRot);

  // Stall auto-pitch: nose drops naturally when AoA exceeds stall
  if (absAoa > STALL_ALPHA * 1.15 && speed > 8) {
    const stallTorque = (absAoa - STALL_ALPHA) * 0.7;
    const stallPitchQ = quatFromAxisAngle(right, -stallTorque * dt);
    newRot = quatMultiply(stallPitchQ, newRot);
  }

  player.rotation = quatNormalize(newRot);

  // NaN guard — if rotation becomes degenerate, reset to identity
  if (isNaN(player.rotation.x) || isNaN(player.rotation.w)) {
    player.rotation = { x: 0, y: 0, z: 0, w: 1 };
    player.velocity = { x: 0, y: 0, z: -90 };
    smoothedPitchRate = 0;
    smoothedYawRate = 0;
    smoothedRollRate = 0;
  }

  // ─── Integrate position ─────────────────────────────────────────────────
  player.position = vec3Add(player.position, vec3Scale(player.velocity, dt));

  // Ground collision — sample terrain heightmap, enforce sea level as minimum
  const terrainH = getTerrainHeight(player.position.x, player.position.z);
  const groundH = Math.max(terrainH, 0) + GROUND_CLEARANCE;
  if (player.position.y < groundH) {
    // Check if impact is hard enough to crash
    const impactSpeed = Math.abs(player.velocity.y);
    const totalSpeed = vec3Length(player.velocity);
    if (impactSpeed > CRASH_SPEED || totalSpeed > CRASH_SPEED * 2) {
      // CRASH!
      player.isDead = true;
      player.crashTimer = 0;
      player.health = 0;
      player.velocity = { x: 0, y: 0, z: 0 };
      player.position.y = groundH;
      state.combat.playerDamageFlash = 1.0;
      // Spawn explosion at crash site
      spawnExplosion(
        state.combat.explosions,
        player.position.x,
        player.position.y,
        player.position.z,
      );
      return;
    }
    // Soft landing — just clamp
    player.position.y = groundH;
    if (player.velocity.y < 0) player.velocity.y = 0;
    // Ground friction
    player.velocity.x = lerp(player.velocity.x, 0, dt * 2);
    player.velocity.z = lerp(player.velocity.z, 0, dt * 2);
  }

  // Also crash if health reaches 0 (shot down)
  if (player.health <= 0) {
    player.isDead = true;
    player.crashTimer = 0;
    player.health = 0;
    state.combat.playerDamageFlash = 1.0;
    spawnExplosion(
      state.combat.explosions,
      player.position.x,
      player.position.y,
      player.position.z,
    );
    return;
  }

  player.altitude = player.position.y;
}
