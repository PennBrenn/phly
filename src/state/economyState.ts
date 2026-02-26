/**
 * Economy State — tracks player currency, scores, and progression.
 *
 * Future: earned from missions, spent on upgrades and plane unlocks.
 */

export interface EconomyState {
  credits: number;         // primary currency
  totalScore: number;      // lifetime score
  missionsCompleted: number;
  killsAir: number;
  killsGround: number;
}

export interface MissionReward {
  credits: number;
  score: number;
  bonuses: { reason: string; amount: number }[];
}

export function createEconomyState(): EconomyState {
  return {
    credits: 0,
    totalScore: 0,
    missionsCompleted: 0,
    killsAir: 0,
    killsGround: 0,
  };
}

/** Calculate mission rewards based on performance. */
export function calculateReward(
  _kills: number,
  _groundKills: number,
  _damageTaken: number,
  _timeSeconds: number,
): MissionReward {
  // TODO: implement reward formula
  return { credits: 0, score: 0, bonuses: [] };
}

const STORAGE_KEY = 'phly-economy';

export function loadEconomy(): EconomyState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...createEconomyState(), ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return createEconomyState();
}

export function saveEconomy(state: EconomyState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}
