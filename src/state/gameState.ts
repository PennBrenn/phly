import { type CombatState, createCombatState } from '@/state/combatState';

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface Quat {
  x: number;
  y: number;
  z: number;
  w: number;
}

export interface PlayerState {
  position: Vec3;
  rotation: Quat;
  velocity: Vec3;
  speed: number;
  altitude: number;
  throttle: number;
  health: number;
  isStalling: boolean;
  // Smoothed control surface deflections (lerp toward input)
  smoothPitch: number;
  smoothYaw: number;
  smoothRoll: number;
  gForce: number;
  isDead: boolean;
  crashTimer: number;
  // Afterburner / WEP
  afterburner: boolean;   // currently in afterburner
  afterburnerFuel: number; // 0-1 remaining fuel
}

export interface InputState {
  pitch: number;
  yaw: number;
  roll: number;
  throttleUp: boolean;
  throttleDown: boolean;
  fire: boolean;            // left mouse / selected weapon fire
  fireMissile: boolean;     // legacy (now fires selected slot weapon)
  seekerEngage: boolean;    // space = toggle seeker
  deployCountermeasure: boolean; // X key = chaff/flare
  afterburnerToggle: boolean;  // shift = afterburner
  selectSlot: number;       // 0 = no change, 1-5 = slot selection
  mouseX: number;
  mouseY: number;
  useMouseAim: boolean;
}

export interface CameraState {
  mode: 'chase' | 'cockpit';
}

export interface MissionBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  ceiling: number;
  warningMargin: number;
}

export interface RemotePlayerState {
  peerId: string;
  player: PlayerState;
  planeId: string;
  modelPath: string;
  playerName: string;
}

export interface GameState {
  player: PlayerState;
  input: InputState;
  camera: CameraState;
  combat: CombatState;
  bounds: MissionBounds;
  remotePlayers: RemotePlayerState[];
  time: {
    delta: number;
    elapsed: number;
  };
}

export function createGameState(): GameState {
  return {
    player: {
      position: { x: 0, y: 2500, z: 0 },
      rotation: { x: 0, y: 0, z: 0, w: 1 },
      velocity: { x: 0, y: 0, z: -90 },
      speed: 90,
      altitude: 2500,
      throttle: 1,
      health: 100,
      isStalling: false,
      smoothPitch: 0,
      smoothYaw: 0,
      smoothRoll: 0,
      gForce: 1,
      isDead: false,
      crashTimer: 0,
      afterburner: false,
      afterburnerFuel: 1.0,
    },
    input: {
      pitch: 0,
      yaw: 0,
      roll: 0,
      throttleUp: false,
      throttleDown: false,
      fire: false,
      fireMissile: false,
      seekerEngage: false,
      deployCountermeasure: false,
      afterburnerToggle: false,
      selectSlot: 0,
      mouseX: 0,
      mouseY: 0,
      useMouseAim: false,
    },
    combat: createCombatState(),
    remotePlayers: [],
    bounds: {
      minX: -8000,
      maxX: 8000,
      minZ: -8000,
      maxZ: 8000,
      ceiling: 6000,
      warningMargin: 500,
    },
    camera: {
      mode: 'chase',
    },
    time: {
      delta: 0,
      elapsed: 0,
    },
  };
}
