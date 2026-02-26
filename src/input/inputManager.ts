import type { GameState } from '@/state/gameState';

export class InputManager {
  private keys = new Set<string>();
  private shiftHeld = false;
  private mouseNormX = 0;
  private mouseNormY = 0;
  private mouseDown = false;
  private useMouseAim = false;
  private cameraTogglePressed = false;
  private mouseTogglePressed = false;

  constructor() {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('mousemove', this.onMouseMove);
    window.addEventListener('mousedown', () => { this.mouseDown = true; });
    window.addEventListener('mouseup', () => { this.mouseDown = false; });
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    this.keys.add(e.code);
    if (e.key === 'Shift') {
      this.shiftHeld = true;
      console.log('[Input] Shift DOWN, shiftHeld =', this.shiftHeld);
    }

    // M toggle for mouse aim (fire once per press)
    if (e.code === 'KeyM' && !this.mouseTogglePressed) {
      this.useMouseAim = !this.useMouseAim;
      this.mouseTogglePressed = true;
    }
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.code);
    if (e.key === 'Shift') {
      this.shiftHeld = false;
      console.log('[Input] Shift UP, shiftHeld =', this.shiftHeld);
    }
    if (e.code === 'KeyM') this.mouseTogglePressed = false;
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

    // Throttle: Shift = up, Space = down
    input.throttleUp = this.shiftHeld;
    input.throttleDown = this.keys.has('Space');
    if (this.shiftHeld) console.log('[Input] Throttle UP should be true');

    // Fire: left mouse button
    input.fire = this.mouseDown;

    // Mouse
    input.mouseX = this.mouseNormX;
    input.mouseY = this.mouseNormY;
    input.useMouseAim = this.useMouseAim;

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
