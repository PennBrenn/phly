import type { GameState } from '@/state/gameState';
import type { MissionData } from '@/utils/dataLoader';
import { spawnEnemies, spawnGroundEnemy } from '@/simulation/ai/enemyAI';

export interface LevelManifest {
  id: string;
  name: string;
  description: string;
  biome?: string;
  missionFile: string;
  thumbnail?: string;
  unlocked: boolean;
  requiredScore?: number;
  order: number;
}

/** Loads a level manifest listing all available levels. */
export async function loadLevelManifest(): Promise<LevelManifest[]> {
  try {
    const resp = await fetch('/data/levels/manifest.json');
    if (resp.ok) {
      const levels = await resp.json();
      console.debug('[Debug][LevelLoader] Loaded manifest:', levels.length, 'levels');
      return levels;
    }
  } catch { /* fallback */ }
  console.debug('[Debug][LevelLoader] Using fallback manifest');
  return [
    { id: 'mission1', name: 'Valley Patrol', description: 'Default mission.', missionFile: '/missions/mission1.json', unlocked: true, order: 0 },
  ];
}

/** Applies mission data to game state (spawns, bounds, player position). */
export function applyMissionToState(
  state: GameState,
  mission: MissionData,
  difficulty: string,
): void {
  console.debug('[Debug][LevelLoader] Applying mission:', mission.id, 'difficulty:', difficulty);
  // Apply bounds
  state.bounds = { ...mission.bounds };

  // Apply player spawn
  state.player.position = { ...mission.playerSpawn.position };
  state.player.rotation = { ...mission.playerSpawn.rotation };
  state.player.velocity = { x: 0, y: 0, z: -mission.playerSpawn.speed };
  state.player.speed = mission.playerSpawn.speed;

  // Spawn air enemies
  const diffTuning = mission.difficulty[difficulty];
  const airCount = diffTuning?.airCount ?? 4;
  spawnEnemies(state, airCount);

  // Spawn ground enemies
  const groundCount = diffTuning?.groundCount ?? 2;
  for (let i = 0; i < Math.min(groundCount, mission.groundEnemies.length); i++) {
    const ge = mission.groundEnemies[i];
    spawnGroundEnemy(state, ge.position, ge.vehicleId, ge.moving, ge.patrolRadius);
  }
}
