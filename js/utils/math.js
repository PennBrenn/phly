// Math utilities for PHLY
const PHLYMath = {
  clamp: (v, min, max) => Math.max(min, Math.min(max, v)),
  lerp: (a, b, t) => a + (b - a) * t,
  smoothstep: (edge0, edge1, x) => {
    const t = PHLYMath.clamp((x - edge0) / (edge1 - edge0), 0, 1);
    return t * t * (3 - 2 * t);
  },
  inverseLerp: (a, b, v) => (v - a) / (b - a),
  remap: (inMin, inMax, outMin, outMax, v) => PHLYMath.lerp(outMin, outMax, PHLYMath.inverseLerp(inMin, inMax, v)),
  degToRad: (d) => d * Math.PI / 180,
  radToDeg: (r) => r * 180 / Math.PI,
  randRange: (min, max) => min + Math.random() * (max - min),
  randInt: (min, max) => Math.floor(PHLYMath.randRange(min, max + 1)),
  seededRandom: (seed) => {
    seed = (seed * 16807 + 0) % 2147483647;
    return (seed - 1) / 2147483646;
  },
  distXZ: (a, b) => Math.sqrt((a.x - b.x) ** 2 + (a.z - b.z) ** 2),
  dist3D: (a, b) => Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2),
  angleBetweenVectors: (a, b) => Math.acos(PHLYMath.clamp(a.dot(b) / (a.length() * b.length()), -1, 1)),
  wrapAngle: (a) => {
    while (a > Math.PI) a -= 2 * Math.PI;
    while (a < -Math.PI) a += 2 * Math.PI;
    return a;
  },
  headingFromDirection: (dx, dz) => {
    let h = Math.atan2(dx, dz) * 180 / Math.PI;
    if (h < 0) h += 360;
    return h;
  },
  slopeAngle: (normal) => Math.acos(PHLYMath.clamp(normal.y, 0, 1)) * 180 / Math.PI,
  // Generate a random 6-character lobby code
  lobbyCode: () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return code;
  },
  // Format currency
  formatCurrency: (amount) => {
    if (amount < 0) return '-$' + Math.abs(amount).toLocaleString();
    return '$' + amount.toLocaleString();
  },
  // Speed conversion
  msToKmh: (ms) => ms * 3.6,
  kmhToMs: (kmh) => kmh / 3.6,
};

window.PHLYMath = PHLYMath;
console.log('[PHLY] Math utilities loaded');
