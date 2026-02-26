/**
 * Economy State — tracks player currency, scores, and progression.
 */

export interface EconomyState {
  credits: number;
  totalScore: number;
  missionsCompleted: number;
  killsAir: number;
  killsGround: number;
}

export type MissionGrade = 'S' | 'A' | 'B' | 'C' | 'F';

export interface MissionReward {
  credits: number;
  score: number;
  grade: MissionGrade;
  bonuses: { reason: string; amount: number }[];
}

export function createEconomyState(): EconomyState {
  return {
    credits: 500,
    totalScore: 0,
    missionsCompleted: 0,
    killsAir: 0,
    killsGround: 0,
  };
}

/** Grade based on time and damage taken. */
export function calculateGrade(
  timeSeconds: number,
  timeLimitSeconds: number,
  damageTaken: number,
  maxHealth: number,
): MissionGrade {
  const timeRatio = timeSeconds / timeLimitSeconds;
  const dmgRatio = damageTaken / maxHealth;
  const score = (1 - timeRatio * 0.5) * (1 - dmgRatio * 0.5);
  if (score >= 0.9) return 'S';
  if (score >= 0.75) return 'A';
  if (score >= 0.55) return 'B';
  if (score >= 0.3) return 'C';
  return 'F';
}

/** Calculate mission rewards based on performance. */
export function calculateReward(
  baseCredits: number,
  baseScore: number,
  airKills: number,
  groundKills: number,
  damageTaken: number,
  timeSeconds: number,
  timeLimitSeconds: number,
  maxHealth: number,
): MissionReward {
  const bonuses: { reason: string; amount: number }[] = [];

  let credits = baseCredits;
  let score = baseScore;

  // Kill bonuses
  const airBonus = airKills * 100;
  if (airBonus > 0) bonuses.push({ reason: `${airKills} air kills`, amount: airBonus });
  credits += airBonus;
  score += airKills * 200;

  const gndBonus = groundKills * 75;
  if (gndBonus > 0) bonuses.push({ reason: `${groundKills} ground kills`, amount: gndBonus });
  credits += gndBonus;
  score += groundKills * 150;

  // Speed bonus
  if (timeSeconds < timeLimitSeconds * 0.5) {
    const speedBonus = Math.round(baseCredits * 0.5);
    bonuses.push({ reason: 'Speed bonus', amount: speedBonus });
    credits += speedBonus;
  }

  // No-damage bonus
  if (damageTaken === 0) {
    const nodmg = Math.round(baseCredits * 0.3);
    bonuses.push({ reason: 'No damage taken', amount: nodmg });
    credits += nodmg;
  }

  const grade = calculateGrade(timeSeconds, timeLimitSeconds, damageTaken, maxHealth);

  return { credits, score, grade, bonuses };
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
