// Game settings for PHLY
const GAME_SETTINGS = {
  graphics: 'medium',
  renderDistance: 3,
  shadowQuality: 'medium',
  treeDensity: 0.7,
  postProcessing: 'low',
  particleQuality: 'medium',
  dayNightSpeed: 'normal',
  cloudDensity: 0.6,
  controlScheme: 'mouse',
  mouseSensitivity: 1.0,
  invertPitch: false,
  fov: 80,
  hudScale: 1.0,
  speedUnits: 'kmh',
  altitudeUnits: 'metres',
  volumeMaster: 0.8,
  volumeSFX: 0.8,
  volumeMusic: 0.5,
  showRepairPreview: true,
  networkDebug: false,
  debugMode: false,
};

const CHUNK_SIZE = 2048;
const CHUNK_GRID = 128;
const CELL_SIZE = CHUNK_SIZE / CHUNK_GRID; // 16m

const RENDER_DISTANCES = { low: 2, medium: 3, high: 4, ultra: 5 };
const DAY_NIGHT_SPEEDS = { off: 0, slow: 2400, normal: 1200, fast: 600 }; // seconds for full cycle

// Lobby settings defaults
const LOBBY_DEFAULTS = {
  maxPlayers: 8,
  worldSeed: Math.floor(Math.random() * 999999),
  difficulty: 'medium',
  maxEnemies: 12,
  spawnRate: 3,
  friendlyFire: false,
  pvpRewardPct: 0.3,
  openLobby: false,
  dayNightCycle: 'normal',
  currencyMultiplier: 1.0,
};

// Kill streak multipliers
const STREAK_MULTIPLIERS = [
  { min: 1, max: 2, mult: 1.0 },
  { min: 3, max: 5, mult: 1.25 },
  { min: 6, max: 9, mult: 1.5 },
  { min: 10, max: 14, mult: 2.0 },
  { min: 15, max: Infinity, mult: 2.5 },
];

function getStreakMultiplier(streak) {
  for (const s of STREAK_MULTIPLIERS) {
    if (streak >= s.min && streak <= s.max) return s.mult;
  }
  return 1.0;
}

// Repair costs
const REPAIR_COSTS = {
  rearm: { baseCost: 50, pctLoadout: 0, time: 12 },
  light: { baseCost: 200, pctLoadout: 0.05, time: 8, hpMin: 0.6 },
  moderate: { baseCost: 600, pctLoadout: 0.12, time: 25, hpMin: 0.3 },
  heavy: { baseCost: 1400, pctLoadout: 0.22, time: 60, hpMin: 0.01 },
  crashed: { baseCost: 2500, pctLoadout: 0.30, time: 120, hpMin: 0 },
};

function getRepairCost(hpPct, loadoutValue) {
  if (hpPct >= 1.0) return { level: 'rearm', cost: 50, time: 12 };
  if (hpPct >= 0.6) return { level: 'light', cost: 200 + Math.floor(loadoutValue * 0.05), time: 20 };
  if (hpPct >= 0.3) return { level: 'moderate', cost: 600 + Math.floor(loadoutValue * 0.12), time: 37 };
  if (hpPct > 0) return { level: 'heavy', cost: 1400 + Math.floor(loadoutValue * 0.22), time: 72 };
  return { level: 'crashed', cost: 2500 + Math.floor(loadoutValue * 0.30), time: 132 };
}

function getCrashPenalty(lastEnemyBaseReward) {
  return Math.max(500, Math.floor(lastEnemyBaseReward * 1.5));
}

window.GAME_SETTINGS = GAME_SETTINGS;
window.CHUNK_SIZE = CHUNK_SIZE;
window.CHUNK_GRID = CHUNK_GRID;
window.CELL_SIZE = CELL_SIZE;
window.RENDER_DISTANCES = RENDER_DISTANCES;
window.DAY_NIGHT_SPEEDS = DAY_NIGHT_SPEEDS;
window.LOBBY_DEFAULTS = LOBBY_DEFAULTS;
window.STREAK_MULTIPLIERS = STREAK_MULTIPLIERS;
window.getStreakMultiplier = getStreakMultiplier;
window.REPAIR_COSTS = REPAIR_COSTS;
window.getRepairCost = getRepairCost;
window.getCrashPenalty = getCrashPenalty;
console.log('[PHLY] Settings config loaded');
