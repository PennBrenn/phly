import type { GameState } from '@/state/gameState';

export class InputManager {
  private keys = new Set<string>();
  private mouseNormX = 0;
  private mouseNormY = 0;
  private mouseDown = false;
  private cameraTogglePressed = false;

  constructor() {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('mousemove', this.onMouseMove);
    window.addEventListener('mousedown', () => { this.mouseDown = true; });
    window.addEventListener('mouseup', () => { this.mouseDown = false; });
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    this.keys.add(e.code);

  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.code);
    if (e.code === 'Tab') this.cameraTogglePressed = false;
  };

  private onMouseMove = (e: MouseEvent): void => {
    this.mouseNormX = (e.clientX / window.innerWidth) * 2 - 1;
    this.mouseNormY = (e.clientY / window.innerHeight) * 2 - 1;
  };

  update(state: GameState): void {
    const input = state.input;

    // Pitch: W/Up = nose down, S/Down = nose up
    input.pitch = 0;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) input.pitch = -1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) input.pitch = 1;

    // Roll: A/Left = roll left, D/Right = roll right
    input.roll = 0;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) input.roll = -1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) input.roll = 1;

    // Yaw: Q = left, E = right
    input.yaw = 0;
    if (this.keys.has('KeyQ')) input.yaw = 1;
    if (this.keys.has('KeyE')) input.yaw = -1;

    // Throttle: R = up, F = down
    input.throttleUp = this.keys.has('KeyR');
    input.throttleDown = this.keys.has('KeyF');

    // Fire: left mouse button
    input.fire = this.mouseDown;

    // Mouse position (useMouseAim is set by app from settings)
    input.mouseX = this.mouseNormX;
    input.mouseY = this.mouseNormY;

    // Camera toggle (Tab) — fire once per press
    if (this.keys.has('Tab') && !this.cameraTogglePressed) {
      state.camera.mode = state.camera.mode === 'chase' ? 'cockpit' : 'chase';
      this.cameraTogglePressed = true;
    }
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('mousemove', this.onMouseMove);
  }
}
