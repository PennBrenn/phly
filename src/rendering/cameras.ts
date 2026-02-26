import * as THREE from 'three';
import type { GameState } from '@/state/gameState';
import { lerp } from '@/utils/math';

// Chase cam: offset behind and above the plane in LOCAL space
const CHASE_BACK = 22;       // meters behind
const CHASE_UP = 6;          // meters above
// Smoothing — lower = more inertial lag (feels heavier)
const POS_SMOOTH = 6;        // position follow speed
const ROT_SMOOTH = 5;        // orientation follow speed

export class CameraController {
  public camera: THREE.PerspectiveCamera;

  // Smoothed state for chase cam
  private smoothPos = new THREE.Vector3();
  private smoothQuat = new THREE.Quaternion();
  private initialized = false;

  private baseFOV = 65;
  private maxFOV = 82;
  private maxSpeedForFOV = 250;

  constructor(aspect: number) {
    this.camera = new THREE.PerspectiveCamera(this.baseFOV, aspect, 2, 50000);
  }

  update(state: GameState, playerGroup: THREE.Group): void {
    const dt = Math.min(state.time.delta, 0.05);

    if (state.camera.mode === 'chase') {
      this.updateChase(state, playerGroup, dt);
    } else {
      this.updateCockpit(playerGroup);
    }

    // Dynamic FOV based on speed
    const speedRatio = Math.min(state.player.speed / this.maxSpeedForFOV, 1);
    const targetFOV = this.baseFOV + (this.maxFOV - this.baseFOV) * speedRatio * speedRatio;
    this.camera.fov = lerp(this.camera.fov, targetFOV, Math.min(dt * 4, 1));
    this.camera.updateProjectionMatrix();
  }

  private updateChase(
    _state: GameState,
    playerGroup: THREE.Group,
    dt: number,
  ): void {
    const planePos = playerGroup.position;
    const planeQuat = playerGroup.quaternion;

    // Snap on first frame
    if (!this.initialized) {
      this.smoothPos.copy(planePos);
      this.smoothQuat.copy(planeQuat);
      this.initialized = true;
    }

    // Smoothly follow the plane's position and orientation
    // The lag here creates the "feel" — during turns the camera trails behind,
    // during rolls you see the horizon tilt with a slight delay.
    const posAlpha = Math.min(dt * POS_SMOOTH, 1);
    const rotAlpha = Math.min(dt * ROT_SMOOTH, 1);
    this.smoothPos.lerp(planePos, posAlpha);
    this.smoothQuat.slerp(planeQuat, rotAlpha);

    // Compute camera position: behind + above in the smoothed orientation frame
    const offset = new THREE.Vector3(0, CHASE_UP, CHASE_BACK);
    offset.applyQuaternion(this.smoothQuat);
    this.camera.position.copy(this.smoothPos).add(offset);

    // Look-at target: slightly ahead of the smoothed plane position
    const lookAhead = new THREE.Vector3(0, 0, -12);
    lookAhead.applyQuaternion(this.smoothQuat);
    const lookTarget = this.smoothPos.clone().add(lookAhead);
    this.camera.lookAt(lookTarget);

    // Apply a fraction of the plane's roll to the camera for immersion
    // Extract the plane's up vector in world space and use it to set camera up
    const planeUp = new THREE.Vector3(0, 1, 0).applyQuaternion(this.smoothQuat);
    this.camera.up.lerp(planeUp, rotAlpha);
  }

  private updateCockpit(playerGroup: THREE.Group): void {
    const cockpitOffset = new THREE.Vector3(0, 0.6, -1.8)
      .applyQuaternion(playerGroup.quaternion);

    this.camera.position.set(
      playerGroup.position.x + cockpitOffset.x,
      playerGroup.position.y + cockpitOffset.y,
      playerGroup.position.z + cockpitOffset.z,
    );

    const lookDir = new THREE.Vector3(0, 0, -30).applyQuaternion(playerGroup.quaternion);
    this.camera.lookAt(
      this.camera.position.x + lookDir.x,
      this.camera.position.y + lookDir.y,
      this.camera.position.z + lookDir.z,
    );

    const planeUp = new THREE.Vector3(0, 1, 0).applyQuaternion(playerGroup.quaternion);
    this.camera.up.copy(planeUp);
  }

  resize(aspect: number): void {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }
}
