import * as THREE from 'three';
import type { GameState } from '@/state/gameState';
import { lerp } from '@/utils/math';

// Chase cam: offset behind and above the plane in LOCAL space
const CHASE_BACK = 10;       // meters behind
const CHASE_UP = 3;          // meters above
// Smoothing — lower = more inertial lag (feels heavier)
const POS_SMOOTH = 4.5;      // position follow speed (softer)
const ROT_SMOOTH = 3.8;      // orientation follow speed (softer)

export class CameraController {
  public camera: THREE.PerspectiveCamera;

  // Smoothed state for chase cam
  private smoothPos = new THREE.Vector3();
  private smoothQuat = new THREE.Quaternion();
  private initialized = false;

  private baseFOV = 65;
  private maxFOV = 82;
  private maxSpeedForFOV = 250;

  // Camera shake
  private shakeIntensity = 0;
  private shakeDecay = 4.0; // how fast shake fades

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
    this.camera.fov = lerp(this.camera.fov, targetFOV, Math.min(dt * 3, 1));
    this.camera.updateProjectionMatrix();

    // Apply camera shake
    if (this.shakeIntensity > 0.01) {
      const sx = (Math.random() - 0.5) * 2 * this.shakeIntensity;
      const sy = (Math.random() - 0.5) * 2 * this.shakeIntensity;
      const sz = (Math.random() - 0.5) * 2 * this.shakeIntensity;
      this.camera.position.x += sx;
      this.camera.position.y += sy;
      this.camera.position.z += sz;
      this.shakeIntensity *= Math.max(0, 1 - this.shakeDecay * dt);
    }
  }

  /** Trigger camera shake with given intensity (meters of displacement). */
  shake(intensity: number): void {
    this.shakeIntensity = Math.max(this.shakeIntensity, intensity);
  }

  /** Reset camera tracking (e.g. after respawn teleport). */
  resetTracking(): void {
    this.initialized = false;
  }

  private updateChase(
    state: GameState,
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

    // NaN guard — snap back if quaternion/position becomes degenerate (extreme G-forces)
    if (isNaN(this.smoothQuat.x) || isNaN(this.smoothPos.x)) {
      this.smoothPos.copy(planePos);
      this.smoothQuat.copy(planeQuat);
    }
    // Renormalize quaternion to prevent drift
    this.smoothQuat.normalize();

    // Compute camera position: behind + above in the smoothed orientation frame
    const offset = new THREE.Vector3(0, CHASE_UP, CHASE_BACK);
    offset.applyQuaternion(this.smoothQuat);
    this.camera.position.copy(this.smoothPos).add(offset);

    // Look-at target: slightly ahead of the smoothed plane position
    const lookAhead = new THREE.Vector3(0, 0, -8);
    lookAhead.applyQuaternion(this.smoothQuat);
    const lookTarget = this.smoothPos.clone().add(lookAhead);

    // Free-look: mouse moves camera view across the full screen bounds
    if (state.input.useMouseAim) {
      const mx = state.input.mouseX; // -1..1
      const my = state.input.mouseY; // -1..1
      const camRight = new THREE.Vector3(1, 0, 0).applyQuaternion(this.smoothQuat);
      const camUp = new THREE.Vector3(0, 1, 0).applyQuaternion(this.smoothQuat);
      lookTarget.addScaledVector(camRight, mx * 25);
      lookTarget.addScaledVector(camUp, -my * 18);
    }

    this.camera.lookAt(lookTarget);

    // Apply a fraction of the plane's roll to the camera for immersion
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
