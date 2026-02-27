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
// ─── Aircraft parameters (light fighter baseline) ────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════
const MASS = 7000;             // kg  empty+fuel
const MAX_THRUST_SL = 50000;   // N   static sea-level thrust (twin engines)
const WING_AREA = 17.3;        // m²
const WING_SPAN = 8.1;         // m
const ASPECT_RATIO = WING_SPAN * WING_SPAN / WING_AREA;
const GRAVITY = 9.81;          // m/s²

// Moment of inertia (kg·m²) — determines rotational resistance (arcade-style: very light)
const Ixx = 2200;   // roll  (much lighter for snappy roll)
const Iyy = 12000;  // pitch (much lighter for responsive pitch)
const Izz = 14000;  // yaw   (much lighter for quick yaw)

// ═══════════════════════════════════════════════════════════════════════════════
// ─── ISA Atmosphere Model ────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════
const RHO_SL = 1.225;         // kg/m³ sea-level density
const T_SL = 288.15;          // K     sea-level temperature
const P_SL = 101325;          // Pa    sea-level pressure
const LAPSE_RATE = 0.0065;    // K/m   temperature lapse rate (troposphere)
const R_AIR = 287.058;        // J/(kg·K)  specific gas constant
const GAMMA = 1.4;            // ratio of specific heats

interface AtmState { rho: number; T: number; P: number; a: number; }

function getAtmosphere(altitude: number): AtmState {
  const h = Math.max(altitude, 0);
  if (h < 11000) {
    // Troposphere
    const T = T_SL - LAPSE_RATE * h;
    const P = P_SL * Math.pow(T / T_SL, GRAVITY / (LAPSE_RATE * R_AIR));
    const rho = P / (R_AIR * T);
    const a = Math.sqrt(GAMMA * R_AIR * T);
    return { rho, T, P, a };
  }
  // Stratosphere (isothermal above 11km)
  const T11 = T_SL - LAPSE_RATE * 11000;
  const P11 = P_SL * Math.pow(T11 / T_SL, GRAVITY / (LAPSE_RATE * R_AIR));
  const P = P11 * Math.exp(-GRAVITY * (h - 11000) / (R_AIR * T11));
  const rho = P / (R_AIR * T11);
  const a = Math.sqrt(GAMMA * R_AIR * T11);
  return { rho, T: T11, P, a };
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── Lift / Drag Polar ───────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

// Lift curve (arcade-style: harder to stall)
const CL_ZERO = 0.1;          // CL at zero AoA (slight camber)
const CL_ALPHA = 4.8;         // dCL/dAlpha per radian (thin wing)
const STALL_ALPHA = 0.40;     // ~23° critical AoA (much higher, harder to stall)
const CL_MAX = CL_ZERO + CL_ALPHA * STALL_ALPHA;

// Post-stall: Viterna flat-plate model blends CL toward CD_90*sin(2α)
const CD_90 = 1.8;            // drag coeff at 90° AoA (flat plate)

function liftCoefficient(alpha: number): number {
  const absA = Math.abs(alpha);
  const sign = alpha >= 0 ? 1 : -1;
  if (absA <= STALL_ALPHA) {
    // Linear pre-stall region
    return CL_ZERO + CL_ALPHA * alpha;
  }
  // Post-stall: Viterna extrapolation
  // CL transitions from peak toward flat-plate: CL = CD_90/2 * sin(2α)
  const clPeak = CL_MAX;
  const clFlatPlate = CD_90 * 0.5 * Math.sin(2 * absA);
  // Blend from peak to flat-plate over ~15° beyond stall
  const blendRange = 0.26; // radians
  const excess = absA - STALL_ALPHA;
  const t = clamp(excess / blendRange, 0, 1);
  const smooth = t * t * (3 - 2 * t); // smoothstep
  return sign * (clPeak * (1 - smooth) + clFlatPlate * smooth);
}

// Drag polar: CD = CD0 + induced + compressibility + post-stall
const CD_ZERO = 0.020;        // clean parasitic drag
const OSWALD = 0.78;
const K_INDUCED = 1 / (Math.PI * OSWALD * ASPECT_RATIO);
const MACH_CRIT = 0.85;       // drag divergence onset
const MACH_DD = 0.05;         // width of transonic drag rise

function dragCoefficient(CL: number, mach: number, alpha: number): number {
  // Parasitic + induced
  let CD = CD_ZERO + K_INDUCED * CL * CL;
  // Compressibility drag rise (Prandtl-Glauert → wave drag)
  if (mach > MACH_CRIT) {
    const dm = (mach - MACH_CRIT) / MACH_DD;
    CD += 0.12 * dm * dm;  // wave drag quadratic rise
  }
  // Post-stall form drag (flat plate component)
  const absA = Math.abs(alpha);
  if (absA > STALL_ALPHA) {
    const excess = absA - STALL_ALPHA;
    CD += CD_90 * Math.sin(absA) * clamp(excess / 0.3, 0, 1);
  }
  return CD;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── Stability Derivatives ───────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

// Pitch (arcade-style: minimal damping, less auto-correction)
const Cm_alpha = -0.3;   // static longitudinal stability (minimal - player has full control)
const Cm_q = -3.5;       // pitch damping (very low - minimal resistance)
const Cm_alphadot = -1.2; // AoA rate damping (very low)

// Yaw (arcade-style: minimal auto-correction)
const Cn_beta = 0.05;    // directional stability (minimal weathervane effect)
const Cn_r = -0.08;      // yaw damping (very low resistance)
const Cn_da = -0.01;     // adverse yaw from aileron (minimal)

// Roll (arcade-style: very snappy response)
const Cl_beta = -0.03;   // dihedral effect (minimal)
const Cl_p = -0.12;      // roll damping (very low for rapid roll)
const Cl_r = 0.02;       // roll from yaw rate (minimal coupling)

// ═══════════════════════════════════════════════════════════════════════════════
// ─── Control Surface Parameters ──────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

// Max moments generated by control surfaces at reference q (N·m per unit deflection) - arcade-style: very powerful
const M_elevator = 250000;   // pitch moment from elevator (very strong)
const M_rudder = 95000;      // yaw moment from rudder (very strong)
const M_aileron = 180000;    // roll moment from ailerons (very strong)

// Control surface slew rate (max deflection change per second, -1..1 range) - arcade-style: instant response
const CONTROL_SLEW_RATE = 8.0;   // units/sec (very fast, near-instant)

// Dynamic pressure reference for control authority
const Q_REF = 0.5 * RHO_SL * 90 * 90;   // at ~90 m/s sea level

// Control authority at high speed reversal point (above this, controls weaken)
const Q_REVERSAL = 0.5 * RHO_SL * 340 * 340; // near Mach 1

// G-load structural limit
const G_LIMIT = 7.0;

// Mach tuck: pitch-down moment above critical Mach
const MACH_TUCK_ONSET = 0.88;
const MACH_TUCK_MOMENT = -40000;  // nose-down N·m

// ═══════════════════════════════════════════════════════════════════════════════
// ─── Engine / Thrust Model ───────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

const THROTTLE_RATE = 0.6;    // throttle spool rate per second
const AB_THRUST_MUL = 1.55;
const AB_FUEL_DRAIN = 0.08;
const AB_FUEL_REGEN = 0.04;
const AB_MIN_FUEL = 0.05;

// Thrust decreases with altitude (proportional to density ratio)
// and with airspeed (ram drag effect for jets)
function engineThrust(throttle: number, afterburner: boolean, speed: number, atm: AtmState): number {
  const abMul = afterburner ? AB_THRUST_MUL : 1.0;
  // Throttle curve: slightly non-linear (spool characteristic)
  const throttleEff = 0.6 * throttle + 0.4 * throttle * throttle;
  // Altitude effect: thrust proportional to density ratio
  const densityRatio = atm.rho / RHO_SL;
  // Ram drag effect: thrust drops ~15% at Mach 0.9 for a turbojet
  const mach = speed / atm.a;
  const ramFactor = 1.0 - 0.15 * clamp(mach / 0.9, 0, 1);
  return MAX_THRUST_SL * abMul * throttleEff * densityRatio * ramFactor;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── Other Constants ─────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

const MAX_SPEED = 360;         // hard cap m/s (military power)
const MAX_SPEED_AB = 420;      // hard cap m/s (afterburner)
const GROUND_CLEARANCE = 3;
const CRASH_SPEED = 25;
const RESPAWN_DELAY = 3.5;
const STALL_SPEED = 45;        // lower stall speed (easier to maintain flight)

// Angular momentum damping from aerodynamic surfaces (baseline) - arcade-style: minimal damping
const AERO_DAMPING_SCALE = 0.35;

// Sideslip damping / weathervane (force that aligns velocity with nose)
const SIDESLIP_FORCE_SCALE = 2.5;

// Cross-axis inertia coupling scale
const INERTIA_COUPLING_SCALE = 0.3;

// ═══════════════════════════════════════════════════════════════════════════════
// ─── Helpers ─────────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════
function vec3Sub(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

// Previous AoA for derivative computation
let prevAoA = 0;

export function updateFlightPhysics(state: GameState): void {
  const dt = state.time.delta;
  if (dt <= 0 || dt > 0.1) return;

  const player = state.player;
  const input = state.input;

  // ─── Crash / death handling ────────────────────────────────────────────
  if (player.isDead) {
    player.crashTimer += dt;
    if (player.crashTimer >= RESPAWN_DELAY) {
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
      player.controlDeflection = { x: 0, y: 0, z: 0 };
      player.angularVelocity = { x: 0, y: 0, z: 0 };
      player.angleOfAttack = 0;
      player.sideslipAngle = 0;
      player.machNumber = 0;
      prevAoA = 0;
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
      state.combat.chaff.ammo = 12;
      state.combat.chaff.cooldown = 0;
      state.combat.chaff.activeTimer = 0;
      state.combat.seeker.active = false;
      state.combat.seeker.seekTimer = 0;
      state.combat.seeker.lockTimer = 0;
      state.combat.seeker.locked = false;
      state.combat.seeker.targetId = -1;
      state.combat.oob.isOOB = false;
      state.combat.oob.oobTimer = 0;
    }
    return;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ─── 1. Atmosphere ─────────────────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════
  const atm = getAtmosphere(player.position.y);

  // ═══════════════════════════════════════════════════════════════════════════
  // ─── 2. Local Axes & Speed ─────────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════
  const fwd   = quatRotateVec3(player.rotation, { x: 0, y: 0, z: -1 });
  const upDir = quatRotateVec3(player.rotation, { x: 0, y: 1, z: 0 });
  const right = quatRotateVec3(player.rotation, { x: 1, y: 0, z: 0 });

  const speed = vec3Length(player.velocity);
  player.speed = speed;
  const qBar = 0.5 * atm.rho * speed * speed;  // dynamic pressure

  const mach = speed / atm.a;
  player.machNumber = mach;

  // ═══════════════════════════════════════════════════════════════════════════
  // ─── 3. Angle of Attack & Sideslip ─────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════
  let alpha = 0;
  let beta = 0;
  if (speed > 2) {
    const velNorm = vec3Normalize(player.velocity);
    const vFwd  = vec3Dot(velNorm, fwd);
    const vUp   = vec3Dot(velNorm, upDir);
    const vSide = vec3Dot(velNorm, right);
    alpha = Math.atan2(-vUp, Math.max(vFwd, 0.01));
    beta  = Math.asin(clamp(vSide, -1, 1));
  }
  player.angleOfAttack = alpha;
  player.sideslipAngle = beta;

  // AoA rate (for Cm_alphadot derivative)
  const alphaDot = (alpha - prevAoA) / Math.max(dt, 0.001);
  prevAoA = alpha;

  // ═══════════════════════════════════════════════════════════════════════════
  // ─── 4. Lift & Drag Forces ─────────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════
  let CL = liftCoefficient(alpha);

  // Low-speed stall factor (arcade-style: ONLY speed-based, NO angle limit)
  const stallRatio = clamp(speed / STALL_SPEED, 0, 1);
  CL *= stallRatio * stallRatio;
  // Stall ONLY based on speed, not angle of attack (arcade-style)
  player.isStalling = speed < STALL_SPEED * 1.1;

  const CD = dragCoefficient(CL, mach, alpha);

  const liftN = CL * qBar * WING_AREA;
  const dragN = CD * qBar * WING_AREA;

  const liftForce = vec3Scale(upDir, liftN);
  const dragForce = speed > 0.5
    ? vec3Scale(vec3Normalize(player.velocity), -dragN)
    : { x: 0, y: 0, z: 0 };

  // ═══════════════════════════════════════════════════════════════════════════
  // ─── 5. Throttle & Afterburner ─────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════
  if (input.throttleUp) {
    player.throttle = clamp(player.throttle + THROTTLE_RATE * dt, 0, 1);
  }
  if (input.throttleDown) {
    player.throttle = clamp(player.throttle - THROTTLE_RATE * dt, 0, 1);
  }

  if (input.afterburnerToggle && player.afterburnerFuel > AB_MIN_FUEL && player.throttle > 0.9) {
    player.afterburner = true;
    player.afterburnerFuel = Math.max(0, player.afterburnerFuel - AB_FUEL_DRAIN * dt);
    if (player.afterburnerFuel <= 0) player.afterburner = false;
  } else {
    player.afterburner = false;
    player.afterburnerFuel = Math.min(1, player.afterburnerFuel + AB_FUEL_REGEN * dt);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ─── 6. Thrust (varies with altitude & airspeed) ───────────────────────
  // ═══════════════════════════════════════════════════════════════════════════
  const thrustN = engineThrust(player.throttle, player.afterburner, speed, atm);
  const thrustForce = vec3Scale(fwd, thrustN);

  // ═══════════════════════════════════════════════════════════════════════════
  // ─── 7. Gravity ────────────────────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════
  const weight = { x: 0, y: -MASS * GRAVITY, z: 0 };

  // ═══════════════════════════════════════════════════════════════════════════
  // ─── 8. Sideslip Damping Force ─────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════
  let sideForce: Vec3 = { x: 0, y: 0, z: 0 };
  if (speed > 5) {
    // Side force proportional to sideslip, scales with dynamic pressure
    const sideN = -beta * qBar * WING_AREA * 0.8 * SIDESLIP_FORCE_SCALE;
    sideForce = vec3Scale(right, sideN);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ─── 9. Sum Forces → Acceleration → Integrate Velocity ─────────────────
  // ═══════════════════════════════════════════════════════════════════════════
  let totalForce = vec3Add(thrustForce, liftForce);
  totalForce = vec3Add(totalForce, dragForce);
  totalForce = vec3Add(totalForce, weight);
  totalForce = vec3Add(totalForce, sideForce);

  const accel = vec3Scale(totalForce, 1 / MASS);
  player.velocity = vec3Add(player.velocity, vec3Scale(accel, dt));

  // G-force (along plane's up axis)
  player.gForce = 1 + vec3Dot(accel, upDir) / GRAVITY;

  // Speed cap
  const speedCap = player.afterburner ? MAX_SPEED_AB : MAX_SPEED;
  const newSpeed = vec3Length(player.velocity);
  if (newSpeed > speedCap) {
    player.velocity = vec3Scale(vec3Normalize(player.velocity), speedCap);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ─── 10. Control Surface Rate Limiting ─────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════
  let targetPitch = input.pitch;
  let targetYaw   = input.yaw;
  let targetRoll  = input.roll;

  if (input.useMouseAim) {
    targetPitch = clamp(input.pitch  - input.mouseY * 0.9,  -1, 1);
    targetRoll  = clamp(input.roll   + input.mouseX * 1.3,  -1, 1);
    targetYaw   = clamp(input.yaw    - input.mouseX * 0.6,  -1, 1);
  }

  // Smooth command input (pilot stick smoothing)
  const smoothAlpha = Math.min(5.0 * dt, 1);
  player.smoothPitch = lerp(player.smoothPitch, targetPitch, smoothAlpha);
  player.smoothYaw   = lerp(player.smoothYaw,   targetYaw,   smoothAlpha);
  player.smoothRoll  = lerp(player.smoothRoll,  targetRoll,  smoothAlpha);

  // Rate-limit actual control surface deflections (slew rate)
  const maxSlew = CONTROL_SLEW_RATE * dt;
  const cd = player.controlDeflection;
  cd.x = clamp(player.smoothPitch, cd.x - maxSlew, cd.x + maxSlew); // elevator
  cd.y = clamp(player.smoothYaw,   cd.y - maxSlew, cd.y + maxSlew); // rudder
  cd.z = clamp(player.smoothRoll,  cd.z - maxSlew, cd.z + maxSlew); // aileron

  // ═══════════════════════════════════════════════════════════════════════════
  // ─── 11. Control Authority (dynamic pressure dependent) ────────────────
  // ═══════════════════════════════════════════════════════════════════════════
  // Controls effective proportional to qBar, with floor and reversal at extreme speed
  let qAuth = clamp(qBar / Q_REF, 0.08, 2.0);
  // Aileron reversal at very high speed (flexible wing effect)
  if (qBar > Q_REVERSAL) {
    const overQ = (qBar - Q_REVERSAL) / Q_REVERSAL;
    qAuth *= Math.max(0.1, 1 - overQ * 0.5);
  }

  // G-limit dampening on pitch
  const gRatio = Math.abs(player.gForce) / G_LIMIT;
  const gDampen = gRatio > 0.8 ? clamp(1 - (gRatio - 0.8) * 5, 0.1, 1) : 1;

  // ═══════════════════════════════════════════════════════════════════════════
  // ─── 12. Compute Aerodynamic Moments (Torques) ─────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════
  const omega = player.angularVelocity; // body-frame angular velocity
  const qNorm = qBar / Q_REF; // normalized dynamic pressure

  // --- Pitch moment (Nm) ---
  let pitchMoment = 0;
  // Control: elevator deflection
  pitchMoment += cd.x * M_elevator * qAuth * gDampen;
  // Static stability: restoring moment from AoA
  pitchMoment += Cm_alpha * alpha * qBar * WING_AREA * 1.5; // reference length = MAC
  // Pitch damping: opposes pitch rate
  pitchMoment += Cm_q * omega.x * qNorm * WING_AREA * 40;
  // AoA rate damping
  pitchMoment += Cm_alphadot * alphaDot * qNorm * WING_AREA * 2.0;
  // Mach tuck: pitch-down above critical Mach
  if (mach > MACH_TUCK_ONSET) {
    const tuckFactor = (mach - MACH_TUCK_ONSET) / 0.1;
    pitchMoment += MACH_TUCK_MOMENT * clamp(tuckFactor, 0, 2);
  }
  // No AoA-based stall auto-pitch (removed for arcade-style control)

  // --- Yaw moment (Nm) ---
  let yawMoment = 0;
  // Control: rudder deflection
  yawMoment += cd.y * M_rudder * qAuth;
  // Directional stability: weathervane from sideslip
  yawMoment += Cn_beta * beta * qBar * WING_AREA * 3.0;
  // Yaw damping
  yawMoment += Cn_r * omega.y * qNorm * WING_AREA * 40;
  // Adverse yaw from aileron
  yawMoment += Cn_da * cd.z * qAuth * M_rudder * 0.5;

  // --- Roll moment (Nm) ---
  let rollMoment = 0;
  // Control: aileron deflection
  rollMoment += cd.z * M_aileron * qAuth;
  // Dihedral effect: roll from sideslip
  rollMoment += Cl_beta * beta * qBar * WING_AREA * 5.0;
  // Roll damping
  rollMoment += Cl_p * omega.z * qNorm * WING_AREA * 30;
  // Roll from yaw rate (Dutch roll coupling)
  rollMoment += Cl_r * omega.y * qNorm * WING_AREA * 20;

  // ═══════════════════════════════════════════════════════════════════════════
  // ─── 13. Cross-Axis Inertia Coupling ───────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════
  // At high roll rates, pitch/yaw become coupled through Euler equations:
  // M_pitch += (Izz - Ixx) * ωyaw * ωroll
  // M_yaw   += (Ixx - Iyy) * ωpitch * ωroll
  pitchMoment += INERTIA_COUPLING_SCALE * (Izz - Ixx) * omega.y * omega.z;
  yawMoment   += INERTIA_COUPLING_SCALE * (Ixx - Iyy) * omega.x * omega.z;

  // ═══════════════════════════════════════════════════════════════════════════
  // ─── 14. Angular Acceleration & Integrate Angular Velocity ─────────────
  // ═══════════════════════════════════════════════════════════════════════════
  // τ = I·α  →  α = τ/I
  const angAccelPitch = pitchMoment / Iyy;
  const angAccelYaw   = yawMoment   / Izz;
  const angAccelRoll  = rollMoment  / Ixx;

  // Integrate angular velocity (persistent — this is the key difference)
  omega.x += angAccelPitch * dt;
  omega.y += angAccelYaw   * dt;
  omega.z += angAccelRoll  * dt;

  // Clamp angular velocity to prevent runaway (structural limits)
  omega.x = clamp(omega.x, -4.0, 4.0);   // max ~230°/s pitch
  omega.y = clamp(omega.y, -2.0, 2.0);    // max ~115°/s yaw
  omega.z = clamp(omega.z, -5.0, 5.0);    // max ~286°/s roll

  // ═══════════════════════════════════════════════════════════════════════════
  // ─── 15. Apply Rotation ────────────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════
  const pitchQ = quatFromAxisAngle(right, omega.x * dt);
  const yawQ   = quatFromAxisAngle(upDir, omega.y * dt);
  const rollQ  = quatFromAxisAngle(fwd,   omega.z * dt);

  let newRot = quatMultiply(rollQ, player.rotation);
  newRot = quatMultiply(pitchQ, newRot);
  newRot = quatMultiply(yawQ,   newRot);
  player.rotation = quatNormalize(newRot);

  // NaN guard
  if (isNaN(player.rotation.x) || isNaN(player.rotation.w)) {
    player.rotation = { x: 0, y: 0, z: 0, w: 1 };
    player.velocity = { x: 0, y: 0, z: -90 };
    player.angularVelocity = { x: 0, y: 0, z: 0 };
    prevAoA = 0;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ─── 16. Integrate Position ────────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════
  player.position = vec3Add(player.position, vec3Scale(player.velocity, dt));

  // Ground collision
  const terrainH = getTerrainHeight(player.position.x, player.position.z);
  const groundH = Math.max(terrainH, 0) + GROUND_CLEARANCE;
  if (player.position.y < groundH) {
    const impactSpeed = Math.abs(player.velocity.y);
    const totalSpeed = vec3Length(player.velocity);
    if (impactSpeed > CRASH_SPEED || totalSpeed > CRASH_SPEED * 2) {
      player.isDead = true;
      player.crashTimer = 0;
      player.health = 0;
      player.velocity = { x: 0, y: 0, z: 0 };
      player.position.y = groundH;
      state.combat.playerDamageFlash = 1.0;
      spawnExplosion(
        state.combat.explosions,
        player.position.x,
        player.position.y,
        player.position.z,
      );
      return;
    }
    // Soft landing
    player.position.y = groundH;
    if (player.velocity.y < 0) player.velocity.y = 0;
    player.velocity.x = lerp(player.velocity.x, 0, dt * 2);
    player.velocity.z = lerp(player.velocity.z, 0, dt * 2);
    // Kill angular momentum on ground
    player.angularVelocity = { x: 0, y: 0, z: 0 };
  }

  // Shot down
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
