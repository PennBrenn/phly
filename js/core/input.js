// Input System for PHLY
const InputSystem = {
  pitch: 0,
  roll: 0,
  yaw: 0,
  throttleDelta: 0,
  fireGun: false,
  fireOrdnance: false,
  switchSlot: false,
  afterburner: false,
  flares: false,
  chatOpen: false,
  hangarKey: false,
  settingsKey: false,
  minimapZoom: false,

  // Mouse state
  mouseX: 0,
  mouseY: 0,
  mouseDX: 0,
  mouseDY: 0,
  isPointerLocked: false,

  // Key state
  keys: {},
  keysJustPressed: {},

  // Settings
  sensitivity: 1.0,
  invertPitch: false,
  controlScheme: 'mouse',

  init() {
    this.sensitivity = GAME_SETTINGS.mouseSensitivity;
    this.invertPitch = GAME_SETTINGS.invertPitch;
    this.controlScheme = GAME_SETTINGS.controlScheme;

    document.addEventListener('keydown', (e) => this._onKeyDown(e));
    document.addEventListener('keyup', (e) => this._onKeyUp(e));
    document.addEventListener('mousemove', (e) => this._onMouseMove(e));
    document.addEventListener('mousedown', (e) => this._onMouseDown(e));
    document.addEventListener('mouseup', (e) => this._onMouseUp(e));
    document.addEventListener('wheel', (e) => this._onWheel(e));
    document.addEventListener('pointerlockchange', () => {
      this.isPointerLocked = !!document.pointerLockElement;
    });

    console.log('[PHLY][Input] Initialized, scheme:', this.controlScheme);
  },

  requestPointerLock() {
    const canvas = document.getElementById('game-canvas');
    if (canvas && !this.isPointerLocked) {
      canvas.requestPointerLock();
    }
  },

  _onKeyDown(e) {
    if (this.chatOpen && e.key !== 'Enter' && e.key !== 'Escape') return;
    this.keys[e.code] = true;
    this.keysJustPressed[e.code] = true;

    if (e.code === 'KeyT' && !this.chatOpen) {
      this.chatOpen = true;
      const chatInput = document.getElementById('chat-input');
      if (chatInput) { chatInput.style.display = 'block'; chatInput.focus(); }
      e.preventDefault();
    }
    if (e.code === 'Enter' && this.chatOpen) {
      this.chatOpen = false;
      const chatInput = document.getElementById('chat-input');
      if (chatInput) {
        if (chatInput.value.trim()) {
          HUD.addChatMessage('You', chatInput.value.trim());
        }
        chatInput.value = '';
        chatInput.style.display = 'none';
      }
    }
    if (e.code === 'Escape') {
      if (this.chatOpen) {
        this.chatOpen = false;
        const chatInput = document.getElementById('chat-input');
        if (chatInput) { chatInput.value = ''; chatInput.style.display = 'none'; }
      } else {
        this.settingsKey = true;
      }
    }
  },

  _onKeyUp(e) {
    this.keys[e.code] = false;
  },

  _onMouseMove(e) {
    if (!this.isPointerLocked) return;
    this.mouseDX = e.movementX * this.sensitivity * 0.002;
    this.mouseDY = e.movementY * this.sensitivity * 0.002;
  },

  _onMouseDown(e) {
    if (!this.isPointerLocked) {
      this.requestPointerLock();
      return;
    }
    if (e.button === 0) this.keys['MouseLeft'] = true;
    if (e.button === 1) this.keys['MouseMiddle'] = true;
    if (e.button === 2) this.keys['MouseRight'] = true;
  },

  _onMouseUp(e) {
    if (e.button === 0) this.keys['MouseLeft'] = false;
    if (e.button === 1) this.keys['MouseMiddle'] = false;
    if (e.button === 2) this.keys['MouseRight'] = false;
  },

  _onWheel(e) {
    if (this.controlScheme === 'mouse') {
      this.throttleDelta += e.deltaY > 0 ? -0.15 : 0.15;
    }
  },

  update(dt) {
    // Reset per-frame values
    this.fireGun = false;
    this.fireOrdnance = false;
    this.switchSlot = false;
    this.afterburner = false;
    this.flares = false;
    this.hangarKey = false;
    this.settingsKey = false;
    this.minimapZoom = false;

    if (this.controlScheme === 'mouse') {
      // Mouse mode: mouse controls pitch/roll
      this.pitch = this.invertPitch ? -this.mouseDY : this.mouseDY;
      this.roll = -this.mouseDX;
      this.yaw = 0;

      // Throttle with W/S or scroll
      if (this.keys['KeyW']) this.throttleDelta = 1;
      else if (this.keys['KeyS']) this.throttleDelta = -1;

      // Fire
      this.fireGun = this.keys['MouseLeft'] || this.keys['Space'];
      this.fireOrdnance = this.keys['MouseRight'] || this.keys['KeyF'];
      this.switchSlot = this.keysJustPressed['MouseMiddle'] || this.keysJustPressed['KeyQ'];
    } else {
      // WASD mode
      this.pitch = 0;
      if (this.keys['KeyW']) this.pitch = 1;
      if (this.keys['KeyS']) this.pitch = -1;
      if (this.invertPitch) this.pitch = -this.pitch;

      this.roll = 0;
      if (this.keys['KeyA']) this.roll = 1;
      if (this.keys['KeyD']) this.roll = -1;

      this.yaw = 0;

      // Throttle
      if (this.keys['ShiftLeft'] || this.keys['ShiftRight']) this.throttleDelta = 1;
      else if (this.keys['ControlLeft'] || this.keys['ControlRight']) this.throttleDelta = -1;
      else this.throttleDelta = 0;

      this.fireGun = this.keys['Space'];
      this.fireOrdnance = this.keys['KeyF'];
      this.switchSlot = this.keysJustPressed['KeyQ'];
    }

    // Common keys
    this.afterburner = this.keys['Tab'];
    this.flares = this.keysJustPressed['KeyX'];
    this.hangarKey = this.keysJustPressed['KeyH'];
    this.minimapZoom = this.keysJustPressed['KeyZ'];

    if (this.keysJustPressed['Escape']) {
      this.settingsKey = true;
    }

    // Clear per-frame states
    this.mouseDX = 0;
    this.mouseDY = 0;
    if (!this.keys['KeyW'] && !this.keys['KeyS'] && this.controlScheme === 'mouse') {
      this.throttleDelta *= 0.9;
    }
    this.keysJustPressed = {};
  },

  getState() {
    return {
      pitch: this.pitch,
      roll: this.roll,
      yaw: this.yaw,
      throttleDelta: this.throttleDelta,
      fireGun: this.fireGun,
      fireOrdnance: this.fireOrdnance,
      switchSlot: this.switchSlot,
      afterburner: this.afterburner,
      flares: this.flares,
      hangarKey: this.hangarKey,
      settingsKey: this.settingsKey,
      minimapZoom: this.minimapZoom,
    };
  },
};

window.InputSystem = InputSystem;
console.log('[PHLY][Input] Module loaded');
