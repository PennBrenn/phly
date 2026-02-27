import { createNoise2D } from 'simplex-noise';

// ─── Terrain constants ───────────────────────────────────────────────────────
export const TERRAIN_SIZE = 40000;  // 40km x 40km (doubled from 20km)
export const TERRAIN_SEGMENTS = 1024;  // Higher detail for larger terrain
export const HEIGHT_SCALE = 3200;

// ─── Seed-based PRNG (deterministic terrain across reloads) ──────────────────
export let TERRAIN_SEED = 7742;

function seededRng(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

let rng = seededRng(TERRAIN_SEED);
let continentNoise = createNoise2D(rng);
let detailNoise    = createNoise2D(rng);
let biomeNoise     = createNoise2D(rng);
let riverNoise     = createNoise2D(rng);
let islandNoise    = createNoise2D(rng);
let microNoise     = createNoise2D(rng);

/** Reinitialize all noise functions with a new seed. Call before scene creation. */
export function setTerrainSeed(seed: number): void {
  TERRAIN_SEED = seed;
  rng = seededRng(seed);
  continentNoise = createNoise2D(rng);
  detailNoise    = createNoise2D(rng);
  biomeNoise     = createNoise2D(rng);
  riverNoise     = createNoise2D(rng);
  islandNoise    = createNoise2D(rng);
  microNoise     = createNoise2D(rng);
}

// ─── Plane-space sampling (used by terrain mesh builder) ─────────────────────
// PlaneGeometry is in XY space, rotated -90° around X.
// After rotation: worldX = planeX, worldY = planeZ (height), worldZ = -planeY

/**
 * Sample raw terrain height in plane-space coordinates (px, py).
 * Returns height in world units (already scaled).
 * Uses very low frequency noise for smooth, rolling terrain with no cliffs.
 */
// Fixed river depth in normalized units (before HEIGHT_SCALE)
const RIVER_DEPTH = 0.015;

export function sampleHeightRaw(px: number, py: number): number {
  let h = 0;

  // Continent-scale shapes — very large, gentle undulations
  h += continentNoise(px * 0.000025, py * 0.000025) * 1.0;
  // Broad mountain ranges
  h += continentNoise(px * 0.0001,  py * 0.0001)  * 0.5;
  // Steep mountain peaks (sharper, more dramatic)
  h += detailNoise(px * 0.00025,    py * 0.00025)  * 0.35;
  // Rolling hills (gentle)
  h += detailNoise(px * 0.00035,    py * 0.00035)  * 0.12;
  // Very subtle ground variation (no sharp bumps)
  h += detailNoise(px * 0.001,      py * 0.001)    * 0.02;

  // Shift up so ~20% is below sea level (ocean)
  h = h * 0.55 + 0.08;

  // Islands: only in deep ocean, with gradual beach slopes and proper elevation
  if (h < -0.15) {
    const iv = islandNoise(px * 0.00035, py * 0.00035);
    const threshold = 0.25;

    if (iv > threshold) {
      // 0 at island edge → 1 at island center
      const edge = (iv - threshold) / (1.0 - threshold);
      // Double smoothstep for extra-gradual beach slopes (no cliff)
      const s1 = edge * edge * (3 - 2 * edge);
      const s2 = s1 * s1 * (3 - 2 * s1);

      // Absolute island peak height (normalized): beaches at edges, gentle hills at center
      // 0.025 = 50 world units (beach), up to 0.11 = 220 world units (island hill)
      const peakH = 0.025 + s2 * 0.085;

      // Blend from ocean floor toward island surface — s1 controls the transition
      h = h + (peakH - h) * s1;
    }
  }

  // Rivers: simply lower the terrain by a fixed offset.
  // Banks follow the natural slope — no carving, no cliffs.
  const rT = riverNoise(px * 0.00005, py * 0.00005);
  const riverW = 0.12;
  if (Math.abs(rT) < riverW) {
    const t = 1 - Math.abs(rT) / riverW;
    const blend = t * t * (3 - 2 * t);
    h -= blend * RIVER_DEPTH;
  }

  return h * HEIGHT_SCALE;
}

/** Check river in plane-space */
export function isRiverRaw(px: number, py: number): boolean {
  const t = riverNoise(px * 0.00005, py * 0.00005);
  return Math.abs(t) < 0.16;
}

/** Forest density in plane-space (0..1) */
export function sampleForestRaw(px: number, py: number): number {
  return (biomeNoise(px * 0.00025, py * 0.00025) + 1) * 0.5;
}

/** Field variety in plane-space (0..1) — wheat vs green */
export function sampleFieldVarRaw(px: number, py: number): number {
  return (biomeNoise(px * 0.0006, py * 0.0006) + 1) * 0.5;
}

/** Micro-detail noise for color variation (0..1). Adds subtle per-vertex variation. */
export function sampleMicroRaw(px: number, py: number): number {
  return (microNoise(px * 0.002, py * 0.002) + 1) * 0.5;
}

// ─── World-space sampling (used by props, physics, etc.) ─────────────────────
// Converts world coords → plane coords: planeX = worldX, planeY = -worldZ

/** Get terrain height at world position (wx, wz). */
export function getTerrainHeight(wx: number, wz: number): number {
  return sampleHeightRaw(wx, -wz);
}

/** Check if world position is water (ocean, river, lake). */
export function isWaterWorld(wx: number, wz: number): boolean {
  return getTerrainHeight(wx, wz) < 0;
}

/** Forest density at world position (0..1). */
export function getForestDensity(wx: number, wz: number): number {
  return sampleForestRaw(wx, -wz);
}
