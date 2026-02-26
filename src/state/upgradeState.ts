/**
 * Upgrade State — tracks unlocked planes, upgrades, and loadouts.
 *
 * Future: planes are unlocked with credits, upgrades modify
 * plane stats (thrust, turn rate, health, weapon capacity).
 */

export interface PlaneUnlock {
  planeId: string;
  unlocked: boolean;
  purchasePrice: number;
}

export interface UpgradeSlot {
  id: string;
  name: string;
  description: string;
  stat: string;          // e.g. 'maxThrust', 'pitchRate', 'health'
  modifier: number;      // multiplier, e.g. 1.1 = +10%
  price: number;
  purchased: boolean;
}

export interface LoadoutConfig {
  planeId: string;
  weaponSlots: { slot: number; weaponId: string }[];
  upgrades: string[];    // applied upgrade IDs
}

export interface UpgradeState {
  planes: PlaneUnlock[];
  upgrades: UpgradeSlot[];
  selectedPlane: string;
  loadout: LoadoutConfig;
}

export function createUpgradeState(): UpgradeState {
  return {
    planes: [
      { planeId: 'delta', unlocked: true, purchasePrice: 0 },
      { planeId: 'f16', unlocked: false, purchasePrice: 5000 },
      { planeId: 'mig', unlocked: false, purchasePrice: 3000 },
      { planeId: 'su27', unlocked: false, purchasePrice: 8000 },
    ],
    upgrades: [],
    selectedPlane: 'delta',
    loadout: {
      planeId: 'delta',
      weaponSlots: [
        { slot: 1, weaponId: 'cannon' },
        { slot: 2, weaponId: 'sidewinder' },
        { slot: 3, weaponId: 'sidewinder' },
        { slot: 4, weaponId: 'chaff' },
      ],
      upgrades: [],
    },
  };
}

const STORAGE_KEY = 'phly-upgrades';

export function loadUpgradeState(): UpgradeState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...createUpgradeState(), ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return createUpgradeState();
}

export function saveUpgradeState(state: UpgradeState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}
