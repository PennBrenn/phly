/**
 * Level Editor — top-down drag-and-drop mission builder.
 *
 * Future: /builder route, orthographic camera, place enemies/waypoints,
 * set bounds, export mission JSON. Separate entry point from game.
 */

export interface EditorEntity {
  id: string;
  type: 'air_enemy' | 'ground_enemy' | 'waypoint' | 'player_spawn';
  vehicleId: string;
  position: { x: number; y: number; z: number };
  properties: Record<string, unknown>;
}

export interface EditorState {
  missionId: string;
  missionName: string;
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number; ceiling: number };
  entities: EditorEntity[];
  selectedEntity: string | null;
  terrainSeed: number;
}

export function createEditorState(): EditorState {
  return {
    missionId: 'custom_1',
    missionName: 'Custom Mission',
    bounds: { minX: -20000, maxX: 20000, minZ: -20000, maxZ: 20000, ceiling: 6000 },
    entities: [],
    selectedEntity: null,
    terrainSeed: Math.floor(Math.random() * 99999),
  };
}

/** Export editor state as a mission JSON string. */
export function exportMissionJson(state: EditorState): string {
  const mission = {
    id: state.missionId,
    name: state.missionName,
    description: 'Custom mission',
    terrainSeed: state.terrainSeed,
    bounds: { ...state.bounds, warningMargin: 500 },
    playerSpawn: {
      position: { x: 0, y: 2500, z: 0 },
      rotation: { x: 0, y: 0, z: 0, w: 1 },
      speed: 90,
    },
    airEnemies: state.entities
      .filter(e => e.type === 'air_enemy')
      .map((e, i) => ({
        vehicleId: e.vehicleId,
        position: e.position,
        patrolIndex: i % 4,
      })),
    groundEnemies: state.entities
      .filter(e => e.type === 'ground_enemy')
      .map(e => ({
        vehicleId: e.vehicleId,
        position: e.position,
        moving: e.properties.moving ?? false,
        patrolRadius: e.properties.patrolRadius ?? 0,
      })),
    difficulty: {
      easy: { airCount: 2, groundCount: 2, enemyHealthMul: 0.7, enemyManeuverMul: 0.6, enemyFireRateMul: 0.5 },
      normal: { airCount: 4, groundCount: 4, enemyHealthMul: 1.0, enemyManeuverMul: 1.0, enemyFireRateMul: 1.0 },
      hard: { airCount: 6, groundCount: 4, enemyHealthMul: 1.5, enemyManeuverMul: 1.3, enemyFireRateMul: 1.5 },
      ace: { airCount: 8, groundCount: 6, enemyHealthMul: 2.0, enemyManeuverMul: 1.6, enemyFireRateMul: 2.0 },
    },
  };
  return JSON.stringify(mission, null, 2);
}

export class LevelEditorUI {
  private _visible = false;

  show(): void {
    // TODO: build editor DOM with canvas overlay, entity palette, properties panel
    this._visible = true;
    console.log('[LevelEditor] Showing editor');
  }

  hide(): void {
    this._visible = false;
  }

  isVisible(): boolean { return this._visible; }
}
