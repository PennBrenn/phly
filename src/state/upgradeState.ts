/**
 * Upgrade State — tracks unlocked planes, weapons, and active loadout.
 * Planes and weapons are bought permanently with credits.
 */

export interface PlaneUnlock {
  planeId: string;
  unlocked: boolean;
  purchasePrice: number;
}

export interface WeaponUnlock {
  weaponId: string;
  unlocked: boolean;
  purchasePrice: number;
}

export interface LoadoutConfig {
  planeId: string;
  weaponSlots: { slot: number; weaponId: string }[];
}

export interface UpgradeState {
  planes: PlaneUnlock[];
  weapons: WeaponUnlock[];
  selectedPlane: string;
  loadout: LoadoutConfig;
}

// All planes ordered by price
const ALL_PLANES: PlaneUnlock[] = [
  { planeId: 'pico',    unlocked: true,  purchasePrice: 0 },
  { planeId: 'delta',   unlocked: false, purchasePrice: 1500 },
  { planeId: 'vector',  unlocked: false, purchasePrice: 3000 },
  { planeId: 'cutlass', unlocked: false, purchasePrice: 4000 },
  { planeId: 'titan',   unlocked: false, purchasePrice: 5000 },
  { planeId: 'flanker', unlocked: false, purchasePrice: 6000 },
  { planeId: 'typhoon', unlocked: false, purchasePrice: 8000 },
  { planeId: 'bobcat',  unlocked: false, purchasePrice: 10000 },
  { planeId: 'bat',     unlocked: false, purchasePrice: 12000 },
  { planeId: 'raptor',  unlocked: false, purchasePrice: 20000 },
  { planeId: 'felon',   unlocked: false, purchasePrice: 25000 },
  { planeId: 'ghost',   unlocked: false, purchasePrice: 30000 },
  { planeId: 'reaper',  unlocked: false, purchasePrice: 35000 },
];

// All ordnance (missiles, bombs, rockets) ordered by price — guns come from the plane
const ALL_WEAPONS: WeaponUnlock[] = [
  // Countermeasures
  { weaponId: 'chaff',         unlocked: true,  purchasePrice: 0 },
  // Missiles (ordered by price)
  { weaponId: 'mini',          unlocked: true,  purchasePrice: 0 },
  { weaponId: 'macro',         unlocked: false, purchasePrice: 500 },
  { weaponId: 'sidewinder',    unlocked: false, purchasePrice: 800 },
  { weaponId: 'meteor',        unlocked: false, purchasePrice: 1000 },
  { weaponId: 'dart',          unlocked: false, purchasePrice: 1200 },
  { weaponId: 'duplex',        unlocked: false, purchasePrice: 1500 },
  { weaponId: 'flash',         unlocked: false, purchasePrice: 2500 },
  { weaponId: 'sprint',        unlocked: false, purchasePrice: 4000 },
  { weaponId: 'zip',           unlocked: false, purchasePrice: 6000 },
  { weaponId: 'birdshot',      unlocked: false, purchasePrice: 8000 },
  { weaponId: 'destroyer',     unlocked: false, purchasePrice: 12000 },
  { weaponId: 'cruise',        unlocked: false, purchasePrice: 25000 },
  // Rockets (ordered by price)
  { weaponId: 'hydra',         unlocked: true,  purchasePrice: 0 },
  { weaponId: 'mighty_mouse',  unlocked: false, purchasePrice: 400 },
  { weaponId: 'zuni',          unlocked: false, purchasePrice: 500 },
  // Bombs (ordered by price)
  { weaponId: 'mk82',          unlocked: false, purchasePrice: 300 },
  { weaponId: 'gbu12',         unlocked: false, purchasePrice: 800 },
  { weaponId: 'cluster',       unlocked: false, purchasePrice: 1500 },
];

export function createUpgradeState(): UpgradeState {
  return {
    planes: ALL_PLANES.map(p => ({ ...p })),
    weapons: ALL_WEAPONS.map(w => ({ ...w })),
    selectedPlane: 'pico',
    loadout: {
      planeId: 'pico',
      weaponSlots: [
        { slot: 1, weaponId: 'pellet' },
        { slot: 2, weaponId: 'mini' },
        { slot: 3, weaponId: 'mini' },
        { slot: 4, weaponId: 'chaff' },
      ],
    },
  };
}

const STORAGE_KEY = 'phly-upgrades';

export function loadUpgradeState(): UpgradeState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const saved = JSON.parse(raw) as UpgradeState;
      // Merge with defaults in case new planes/weapons were added
      const base = createUpgradeState();
      for (const p of base.planes) {
        const existing = saved.planes?.find(sp => sp.planeId === p.planeId);
        if (existing) { p.unlocked = existing.unlocked; }
      }
      for (const w of base.weapons) {
        const existing = saved.weapons?.find(sw => sw.weaponId === w.weaponId);
        if (existing) { w.unlocked = existing.unlocked; }
      }
      return {
        planes: base.planes,
        weapons: base.weapons,
        selectedPlane: saved.selectedPlane || base.selectedPlane,
        loadout: saved.loadout || base.loadout,
      };
    }
  } catch { /* ignore */ }
  return createUpgradeState();
}

export function saveUpgradeState(state: UpgradeState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}
