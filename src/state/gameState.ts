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
}

export interface InputState {
  pitch: number;
  yaw: number;
  roll: number;
  throttleUp: boolean;
  throttleDown: boolean;
  fire: boolean;
  mouseX: number;
  mouseY: number;
  useMouseAim: boolean;
}

export interface CameraState {
  mode: 'chase' | 'cockpit';
}

export interface GameState {
  player: PlayerState;
  input: InputState;
  camera: CameraState;
  time: {
    delta: number;
    elapsed: number;
  };
}

export function createGameState(): GameState {
  return {
    player: {
      position: { x: 0, y: 200, z: 0 },
      rotation: { x: 0, y: 0, z: 0, w: 1 },
      velocity: { x: 0, y: 0, z: -50 },
      speed: 50,
      altitude: 200,
      throttle: 0.5,
      health: 100,
      isStalling: false,
      smoothPitch: 0,
      smoothYaw: 0,
      smoothRoll: 0,
      gForce: 1,
    },
    input: {
      pitch: 0,
      yaw: 0,
      roll: 0,
      throttleUp: false,
      throttleDown: false,
      fire: false,
      mouseX: 0,
      mouseY: 0,
      useMouseAim: false,
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
