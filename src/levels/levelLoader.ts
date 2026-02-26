/**
 * Level Loader — loads level/mission JSON and spawns entities into state.
 * 
 * Future: will support campaign progression, unlockable levels,
 * and dynamic mission generation.
 */

import type { GameState } from '@/state/gameState';
import type { MissionData } from '@/utils/dataLoader';

export interface LevelManifest {
  id: string;
  name: string;
  description: string;
  missionFile: string;  // path to mission JSON
  thumbnail?: string;   // preview image path
  unlocked: boolean;
  requiredScore?: number; // score needed to unlock
  order: number;          // display order in level select
}

/** Loads a level manifest listing all available levels. */
export async function loadLevelManifest(): Promise<LevelManifest[]> {
  // TODO: fetch from /data/levels/manifest.json
  return [
    {
      id: 'mission1',
      name: 'Valley Patrol',
      description: 'Engage enemy fighters and ground forces in the valley.',
      missionFile: '/missions/mission1.json',
      unlocked: true,
      order: 0,
    },
  ];
}

/** Applies mission data to game state (spawns, bounds, player position). */
export function applyMissionToState(
  _state: GameState,
  _mission: MissionData,
  _difficulty: string,
): void {
  // TODO: implement full mission application
  // This will replace the inline mission loading in App.ts
}
