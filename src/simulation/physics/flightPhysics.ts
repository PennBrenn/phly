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
const PITCH_RATE_MAX = 1.6;
const YAW_RATE_MAX = 0.45;
const ROLL_RATE_MAX = 2.8;
// Control surfaces produce torque proportional to dynamic pressure.
// REF_Q is the dynamic pressure at which deflection rates are 100%.
const REF_Q = 0.5 * RHO * 90 * 90;   // ~90 m/s reference
// G-load limiting — structural limit dampens pitch authority
const G_LIMIT = 7.0;

// How fast control surfaces physically move (smoothing toward input)
const CONTROL_SMOOTHING = 4.5; // higher = snappier response

// Aerodynamic coupling: velocity bleeds toward nose direction
// (sideslip damping / weathervane effect)
const AERO_COUPLING = 2.2;

const THROTTLE_RATE = 0.5;     // throttle change per second
const MAX_SPEED = 340;         // hard cap m/s
const GROUND_LEVEL = 2;

// ─── Helpers ──────────────────────────────────────────────────────────────────
function vec3Sub(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

export function updateFlightPhysics(state: GameState): void {
  const dt = state.time.delta;
  if (dt <= 0 || dt > 0.1) return;

  const player = state.player;
  const input = state.input;

  // ─── Throttle (gradual spool) ───────────────────────────────────────────
  if (input.throttleUp) {
    player.throttle = clamp(player.throttle + THROTTLE_RATE * dt, 0, 1);
    console.log('[Physics] Throttle UP, new throttle =', player.throttle.toFixed(3));
  }
  if (input.throttleDown) {
    player.throttle = clamp(player.throttle - THROTTLE_RATE * dt, 0, 1);
    console.log('[Physics] Throttle DOWN, new throttle =', player.throttle.toFixed(3));
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

  // ─── Aerodynamic forces (Newtons) ───────────────────────────────────────
  const liftN = CL * qBar * WING_AREA;
  const dragN = CD * qBar * WING_AREA;

  // Lift along plane's up axis
  const liftForce = vec3Scale(upDir, liftN);
  // Drag opposite to velocity
  const dragForce = speed > 0.5
    ? vec3Scale(vec3Normalize(player.velocity), -dragN)
    : { x: 0, y: 0, z: 0 };

  // ─── Thrust ─────────────────────────────────────────────────────────────
  // Mild afterburner curve (slightly more than linear)
  const thrustN = MAX_THRUST_N * (0.6 * player.throttle + 0.4 * player.throttle * player.throttle);
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

  // Clamp max speed
  const newSpeed = vec3Length(player.velocity);
  if (newSpeed > MAX_SPEED) {
    player.velocity = vec3Scale(vec3Normalize(player.velocity), MAX_SPEED);
  }

  // ─── Control surfaces (gradual, speed-dependent) ────────────────────────
  // Raw input targets (keyboard + mouse)
  let targetPitch = input.pitch;
  let targetYaw   = input.yaw;
  let targetRoll  = input.roll;

  if (input.useMouseAim) {
    targetPitch = clamp(targetPitch + input.mouseY * 0.9, -1, 1);
    targetRoll  = clamp(targetRoll  - input.mouseX * 1.3, -1, 1);
    targetYaw   = clamp(targetYaw   + input.mouseX * 0.25, -1, 1);
  }

  // Smooth control deflections (simulates hydraulic actuator lag)
  const smoothAlpha = Math.min(CONTROL_SMOOTHING * dt, 1);
  player.smoothPitch = lerp(player.smoothPitch, targetPitch, smoothAlpha);
  player.smoothYaw   = lerp(player.smoothYaw,   targetYaw,   smoothAlpha);
  player.smoothRoll  = lerp(player.smoothRoll,  targetRoll,  smoothAlpha);

  // Authority from dynamic pressure: controls are aerodynamic surfaces,
  // so their effectiveness scales with qBar
  const qAuthority = clamp(qBar / REF_Q, 0.05, 1.8);

  // G-limit dampening: reduce pitch authority if we're near structural limit
  const gRatio = Math.abs(player.gForce) / G_LIMIT;
  const gDampen = gRatio > 0.8 ? clamp(1 - (gRatio - 0.8) * 5, 0.1, 1) : 1;

  const pitchRate = player.smoothPitch * PITCH_RATE_MAX * qAuthority * gDampen;
  const yawRate   = player.smoothYaw   * YAW_RATE_MAX   * qAuthority;
  const rollRate  = player.smoothRoll  * ROLL_RATE_MAX  * qAuthority;

  const pitchQ = quatFromAxisAngle(right, pitchRate * dt);
  const yawQ   = quatFromAxisAngle(upDir, yawRate   * dt);
  const rollQ  = quatFromAxisAngle(fwd,   rollRate  * dt);

  let newRot = quatMultiply(rollQ, player.rotation);
  newRot = quatMultiply(pitchQ, newRot);
  newRot = quatMultiply(yawQ,   newRot);
  player.rotation = quatNormalize(newRot);

  // ─── Integrate position ─────────────────────────────────────────────────
  player.position = vec3Add(player.position, vec3Scale(player.velocity, dt));

  // Ground collision
  if (player.position.y < GROUND_LEVEL) {
    player.position.y = GROUND_LEVEL;
    if (player.velocity.y < 0) player.velocity.y = 0;
    // Ground friction
    player.velocity.x = lerp(player.velocity.x, 0, dt * 2);
    player.velocity.z = lerp(player.velocity.z, 0, dt * 2);
  }

  player.altitude = player.position.y;
}
