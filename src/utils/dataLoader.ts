// ─── JSON data types for weapons, planes, vehicles, missions ─────────────────

export interface WeaponData {
  id: string;
  name: string;
  type: 'gun' | 'missile' | 'countermeasure';
  // Gun fields
  bulletSpeed?: number;
  bulletMaxAge?: number;
  fireRate?: number;
  damage?: number;
  spread?: number;
  ammo?: number;
  poolSize?: number;
  // Missile fields
  speed?: number;
  maxAge?: number;
  turnRate?: number;
  gLimit?: number;
  lockRange?: number;
  lockCone?: number;
  seekerTimeMin?: number;
  seekerTimeMax?: number;
  cooldown?: number;
  // Countermeasure fields
  effectDuration?: number;
  missileBreakChance?: number;
  model?: string | null;
}

export interface WeaponSlotData {
  slot: number;
  weaponId: string;
  hardpoint: { x: number; y: number; z: number };
}

export interface EnginePosition {
  x: number;
  y: number;
  z: number;
}

export interface PlaneData {
  id: string;
  name: string;
  model: string;
  mass: number;
  maxThrust: number;
  wingArea: number;
  wingSpan: number;
  maxSpeed: number;
  stallSpeed: number;
  pitchRate: number;
  yawRate: number;
  rollRate: number;
  gLimit: number;
  health: number;
  collisionRadius: number;
  engines: EnginePosition[];
  weaponSlots: WeaponSlotData[];
}

export interface VehicleData {
  id: string;
  name: string;
  type: 'ground';
  model: string;
  modelScale: number;
  health: number;
  collisionRadius: number;
  speed: number;
  turnRate: number;
  weaponId: string;
  fireRate: number;
  fireRange: number;
  fireCone: number;
  bulletSpeed?: number;
  bulletDamage?: number;
  missileSpeed?: number;
  missileDamage?: number;
  missileTurnRate?: number;
  missileGLimit?: number;
  canMove: boolean;
}

export interface MissionSpawnAir {
  vehicleId: string;
  position: { x: number; y: number; z: number };
  patrolIndex: number;
}

export interface MissionSpawnGround {
  vehicleId: string;
  position: { x: number; y: number; z: number };
  moving: boolean;
  patrolRadius: number;
}

export interface MissionBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  ceiling: number;
  warningMargin: number;
}

export interface DifficultyTuning {
  airCount: number;
  groundCount: number;
  enemyHealthMul: number;
  enemyManeuverMul: number;
  enemyFireRateMul: number;
}

export interface MissionData {
  id: string;
  name: string;
  description: string;
  terrainSeed: number;
  bounds: MissionBounds;
  playerSpawn: {
    position: { x: number; y: number; z: number };
    rotation: { x: number; y: number; z: number; w: number };
    speed: number;
  };
  airEnemies: MissionSpawnAir[];
  groundEnemies: MissionSpawnGround[];
  difficulty: Record<string, DifficultyTuning>;
}

// ─── Cache ───────────────────────────────────────────────────────────────────
const weaponCache = new Map<string, WeaponData>();
const planeCache = new Map<string, PlaneData>();
const vehicleCache = new Map<string, VehicleData>();

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load ${url}: ${res.status}`);
  return res.json() as Promise<T>;
}

export async function loadWeapon(id: string): Promise<WeaponData> {
  if (weaponCache.has(id)) return weaponCache.get(id)!;
  const data = await fetchJson<WeaponData>(`/data/weapons/${id}.json`);
  weaponCache.set(id, data);
  return data;
}

export async function loadPlane(id: string): Promise<PlaneData> {
  if (planeCache.has(id)) return planeCache.get(id)!;
  const data = await fetchJson<PlaneData>(`/data/planes/${id}.json`);
  planeCache.set(id, data);
  return data;
}

export async function loadVehicle(id: string): Promise<VehicleData> {
  if (vehicleCache.has(id)) return vehicleCache.get(id)!;
  const data = await fetchJson<VehicleData>(`/data/vehicles/${id}.json`);
  vehicleCache.set(id, data);
  return data;
}

export async function loadMission(id: string): Promise<MissionData> {
  return fetchJson<MissionData>(`/missions/${id}.json`);
}

export function getWeaponSync(id: string): WeaponData | undefined {
  return weaponCache.get(id);
}

export function getVehicleSync(id: string): VehicleData | undefined {
  return vehicleCache.get(id);
}

/** Pre-load all data referenced by a mission. */
export async function preloadMissionData(mission: MissionData): Promise<void> {
  const weaponIds = new Set<string>();
  const vehicleIds = new Set<string>();

  // Collect vehicle IDs from mission spawns
  for (const s of mission.airEnemies) {
    // Air enemies use plane data but we also need their weapon references
    if (!planeCache.has(s.vehicleId)) {
      const p = await loadPlane(s.vehicleId);
      for (const ws of p.weaponSlots) weaponIds.add(ws.weaponId);
    } else {
      const p = planeCache.get(s.vehicleId)!;
      for (const ws of p.weaponSlots) weaponIds.add(ws.weaponId);
    }
  }
  for (const s of mission.groundEnemies) {
    vehicleIds.add(s.vehicleId);
  }

  // Load all
  await Promise.all([
    ...Array.from(weaponIds).map(id => loadWeapon(id)),
    ...Array.from(vehicleIds).map(id => loadVehicle(id)),
  ]);

  // Also load weapons referenced by ground vehicles
  for (const vid of vehicleIds) {
    const v = vehicleCache.get(vid)!;
    if (v.weaponId && !weaponCache.has(v.weaponId)) {
      await loadWeapon(v.weaponId);
    }
  }
}
