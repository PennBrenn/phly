/**
 * Progress State — tracks mission completion, grades, and unlocks.
 */

import type { MissionGrade } from '@/state/economyState';

export interface MissionProgress {
  missionId: string;
  completed: boolean;
  bestGrade: MissionGrade | null;
  bestTime: number; // seconds, 0 = not completed
  attempts: number;
}

export interface ProgressState {
  missions: MissionProgress[];
  unlockedMissionIds: string[];
}

export function createProgressState(): ProgressState {
  return {
    missions: [],
    unlockedMissionIds: ['mission1'],
  };
}

export function getMissionProgress(state: ProgressState, missionId: string): MissionProgress {
  let mp = state.missions.find(m => m.missionId === missionId);
  if (!mp) {
    mp = { missionId, completed: false, bestGrade: null, bestTime: 0, attempts: 0 };
    state.missions.push(mp);
  }
  return mp;
}

export function isMissionUnlocked(state: ProgressState, missionId: string): boolean {
  return state.unlockedMissionIds.includes(missionId);
}

const STORAGE_KEY = 'phly-progress';

export function loadProgress(): ProgressState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...createProgressState(), ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return createProgressState();
}

export function saveProgress(state: ProgressState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}
