import * as THREE from 'three';
import type { GameState } from '@/state/gameState';

const MAX_ENEMY_MARKERS = 8;
const CROSSHAIR_AHEAD = 300; // project this far ahead of the plane

export class HUD {
  private speedEl!: HTMLSpanElement;
  private altEl!: HTMLSpanElement;
  private throttleBarEl!: HTMLDivElement;
  private stallWarning!: HTMLDivElement;
  private modeIndicator!: HTMLSpanElement;
  private healthBarEl!: HTMLDivElement;
  private ammoEl!: HTMLSpanElement;
  private crosshairEl!: HTMLDivElement;
  private lockRingEl!: HTMLDivElement;
  private enemyMarkers: HTMLDivElement[] = [];
  private container!: HTMLDivElement;
  private weaponSlotsEl!: HTMLDivElement;
  private seekerBarEl!: HTMLDivElement;
  private seekerFillEl!: HTMLDivElement;
  private seekerLabelEl!: HTMLDivElement;
  private oobWarningEl!: HTMLDivElement;
  private chaffEl!: HTMLSpanElement;
  private mouseCursorEl!: HTMLDivElement;
  private abBarEl!: HTMLDivElement;
  private abFillEl!: HTMLDivElement;
  private gForceEl!: HTMLSpanElement;
  private missileRackEl!: HTMLDivElement;

  // Reuse vectors to avoid GC
  private _v3 = new THREE.Vector3();
  private _quat = new THREE.Quaternion();

  constructor() {
    this.injectStyles();
    this.buildDOM();
  }

  private injectStyles(): void {
    const style = document.createElement('style');
    style.textContent = `
      #hud {
        position: absolute;
        top: 0; left: 0; right: 0; bottom: 0;
        pointer-events: none;
        font-family: 'Courier New', monospace;
        color: #ffffff;
        z-index: 10;
      }
      .hud-left {
        position: absolute;
        bottom: 80px;
        left: 30px;
      }
      .hud-item {
        margin-bottom: 8px;
        font-size: 18px;
      }
      .hud-label {
        display: inline-block;
        width: 40px;
        opacity: 0.7;
        font-size: 12px;
      }
      .hud-value {
        font-size: 24px;
        font-weight: bold;
        min-width: 60px;
        display: inline-block;
        text-align: right;
      }
      .hud-unit {
        opacity: 0.5;
        font-size: 12px;
        margin-left: 4px;
      }
      .hud-right {
        position: absolute;
        bottom: 80px;
        right: 30px;
      }
      .hud-throttle {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .throttle-track {
        width: 12px;
        height: 100px;
        border: 1px solid rgba(255,255,255,0.35);
        position: relative;
        background: rgba(0,0,0,0.2);
      }
      .throttle-fill {
        position: absolute;
        bottom: 0;
        width: 100%;
        background: #ffffff;
        transition: height 0.1s;
      }
      .stall-warning {
        position: absolute;
        top: 55%;
        left: 50%;
        transform: translateX(-50%);
        font-size: 20px;
        color: #ff6666;
        animation: blink 0.5s infinite;
        display: none;
      }
      .stall-warning.active {
        display: block;
      }
      @keyframes blink {
        50% { opacity: 0.3; }
      }
      .hud-controls {
        position: absolute;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        font-size: 11px;
        opacity: 0.4;
        white-space: nowrap;
      }
      .hud-mode {
        position: absolute;
        top: 20px;
        right: 30px;
        font-size: 12px;
        opacity: 0.6;
      }
      .hud-health-bar {
        position: absolute;
        bottom: 60px;
        left: 30px;
        width: 140px;
        height: 6px;
        background: rgba(255,255,255,0.15);
        border-radius: 3px;
      }
      .hud-health-fill {
        height: 100%;
        background: #44cc44;
        border-radius: 3px;
        transition: width 0.2s, background 0.2s;
      }
      .hud-ammo {
        position: absolute;
        bottom: 80px;
        right: 80px;
        font-size: 14px;
        opacity: 0.7;
      }

      /* ── Weapon slots ──────────────────────────────────── */
      .hud-weapon-slots {
        position: absolute;
        bottom: 20px;
        right: 30px;
        display: flex;
        gap: 6px;
      }
      .hud-wslot {
        padding: 4px 8px;
        border: 1px solid rgba(255,255,255,0.2);
        font-size: 11px;
        text-align: center;
        min-width: 44px;
        opacity: 0.5;
      }
      .hud-wslot.active {
        border-color: #fff;
        opacity: 1;
        background: rgba(255,255,255,0.1);
      }
      .hud-wslot.empty { opacity: 0.2; }

      /* ── Seeker bar ─────────────────────────────────────── */
      .hud-seeker {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, 40px);
        width: 120px;
        text-align: center;
        display: none;
      }
      .hud-seeker.active { display: block; }
      .hud-seeker-track {
        width: 100%;
        height: 4px;
        background: rgba(255,255,255,0.15);
        border-radius: 2px;
        margin-top: 4px;
      }
      .hud-seeker-fill {
        height: 100%;
        background: #ff4444;
        border-radius: 2px;
        transition: width 0.1s, background 0.1s;
      }
      .hud-seeker-fill.locked { background: #44ff44; }
      .hud-seeker-label {
        font-size: 11px;
        letter-spacing: 1px;
      }

      /* ── OOB warning ────────────────────────────────────── */
      .hud-oob {
        position: absolute;
        top: 15%;
        left: 50%;
        transform: translateX(-50%);
        font-size: 22px;
        color: #ff6644;
        animation: blink 0.6s infinite;
        display: none;
        text-shadow: 0 0 10px rgba(255,100,0,0.5);
      }
      .hud-oob.active { display: block; }

      /* ── Chaff counter ──────────────────────────────────── */
      .hud-chaff {
        position: absolute;
        bottom: 100px;
        right: 80px;
        font-size: 12px;
        opacity: 0.6;
      }

      /* ── Mouse aim cursor ───────────────────────────────── */
      .hud-mouse-cursor {
        position: absolute;
        pointer-events: none;
        transform: translate(-50%, -50%);
        width: 16px; height: 16px;
        border: 1.5px solid rgba(255,255,255,0.5);
        border-radius: 50%;
        display: none;
      }
      .hud-mouse-cursor.visible { display: block; }

      /* ── Afterburner bar ──────────────────────────────────── */
      .hud-ab {
        position: absolute;
        bottom: 80px;
        right: 30px;
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .hud-ab-label {
        font-size: 11px;
        opacity: 0.6;
      }
      .hud-ab-track {
        width: 80px;
        height: 6px;
        background: rgba(255,255,255,0.12);
        border-radius: 3px;
      }
      .hud-ab-fill {
        height: 100%;
        background: #ff8800;
        border-radius: 3px;
        transition: width 0.1s, background 0.15s;
      }
      .hud-ab-fill.active {
        background: #ff4400;
        box-shadow: 0 0 6px rgba(255,68,0,0.6);
      }

      /* ── G-force ──────────────────────────────────────────── */
      .hud-gforce {
        position: absolute;
        bottom: 160px;
        left: 30px;
        font-size: 14px;
        opacity: 0.7;
      }
      .hud-gforce.high { color: #ff6644; }
      .hud-gforce.extreme { color: #ff2222; animation: blink 0.4s infinite; }

      /* ── Missile rack (bottom-right, individual slots) ────── */
      .hud-missile-rack {
        position: absolute;
        bottom: 50px;
        right: 30px;
        display: flex;
        flex-direction: column;
        gap: 3px;
        align-items: flex-end;
      }
      .hud-mrack-slot {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 3px 8px;
        border: 1px solid rgba(255,255,255,0.15);
        font-size: 11px;
        opacity: 0.5;
        min-width: 120px;
        justify-content: space-between;
      }
      .hud-mrack-slot.ready {
        border-color: rgba(100,200,100,0.4);
        opacity: 0.9;
      }
      .hud-mrack-slot.empty {
        border-color: rgba(255,60,60,0.2);
        opacity: 0.25;
        text-decoration: line-through;
      }
      .hud-mrack-slot.selected {
        border-color: #fff;
        opacity: 1;
        background: rgba(255,255,255,0.06);
      }
      .hud-mrack-name {
        letter-spacing: 0.5px;
      }
      .hud-mrack-ammo {
        font-weight: bold;
        min-width: 16px;
        text-align: right;
      }

      /* ── Dynamic crosshair ─────────────────────────────── */
      .hud-crosshair {
        position: absolute;
        pointer-events: none;
        transform: translate(-50%, -50%);
        text-align: center;
        transition: left 0.05s linear, top 0.05s linear;
      }
      .hud-crosshair-inner {
        width: 24px;
        height: 24px;
        position: relative;
      }
      /* four crosshair lines */
      .hud-crosshair-inner::before,
      .hud-crosshair-inner::after {
        content: '';
        position: absolute;
        background: rgba(255,255,255,0.7);
      }
      .hud-crosshair-inner::before {
        /* horizontal */
        width: 24px; height: 2px;
        top: 11px; left: 0;
      }
      .hud-crosshair-inner::after {
        /* vertical */
        width: 2px; height: 24px;
        top: 0; left: 11px;
      }
      .hud-crosshair-dot {
        position: absolute;
        width: 4px; height: 4px;
        background: #fff;
        border-radius: 50%;
        top: 10px; left: 10px;
      }

      /* ── Missile lock ring ─────────────────────────────── */
      .hud-lock-ring {
        position: absolute;
        pointer-events: none;
        transform: translate(-50%, -50%);
        width: 48px; height: 48px;
        border: 2px solid rgba(255, 60, 60, 0.9);
        border-radius: 50%;
        display: none;
        box-shadow: 0 0 8px rgba(255, 60, 60, 0.5);
      }
      .hud-lock-ring.locked {
        display: block;
        animation: lock-pulse 0.8s ease-in-out infinite;
      }
      @keyframes lock-pulse {
        0%, 100% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
        50% { transform: translate(-50%, -50%) scale(1.15); opacity: 0.7; }
      }

      /* ── Enemy markers ──────────────────────────────────── */
      .hud-enemy-marker {
        position: absolute;
        pointer-events: none;
        transform: translate(-50%, -50%);
        display: none;
        text-align: center;
      }
      .enemy-diamond {
        width: 14px; height: 14px;
        border: 2px solid #ff4444;
        transform: rotate(45deg);
        margin: 0 auto 3px auto;
        background: rgba(255, 68, 68, 0.15);
      }
      .enemy-diamond.engage {
        border-color: #ff8800;
        background: rgba(255, 136, 0, 0.15);
      }
      .enemy-diamond.fire {
        border-color: #ff2222;
        background: rgba(255, 34, 34, 0.3);
        animation: blink 0.4s infinite;
      }
      .enemy-diamond.destroyed {
        border-color: #666;
        background: rgba(100,100,100,0.15);
      }
      .enemy-info {
        font-size: 10px;
        white-space: nowrap;
        color: #ff6666;
        text-shadow: 0 0 4px rgba(0,0,0,0.8);
        letter-spacing: 0.5px;
      }
      .enemy-health-track {
        width: 30px;
        height: 3px;
        background: rgba(255,255,255,0.15);
        margin: 2px auto 0 auto;
        border-radius: 1px;
      }
      .enemy-health-fill {
        height: 100%;
        background: #ff4444;
        border-radius: 1px;
        transition: width 0.15s;
      }
    `;
    document.head.appendChild(style);
  }

  private buildDOM(): void {
    this.container = document.createElement('div');
    this.container.id = 'hud';
    this.container.innerHTML = `
      <div class="hud-left">
        <div class="hud-item">
          <span class="hud-label">SPD</span>
          <span class="hud-value" id="hud-speed">0</span>
          <span class="hud-unit">km/h</span>
        </div>
        <div class="hud-item">
          <span class="hud-label">ALT</span>
          <span class="hud-value" id="hud-alt">0</span>
          <span class="hud-unit">m</span>
        </div>
      </div>
      <div class="hud-right">
        <div class="hud-throttle">
          <span class="hud-label">THR</span>
          <div class="throttle-track">
            <div class="throttle-fill" id="hud-throttle"></div>
          </div>
        </div>
      </div>
      <div class="stall-warning" id="hud-stall">STALL</div>
      <div class="hud-mode" id="hud-mode">KEYBOARD</div>
      <div class="hud-health-bar">
        <div class="hud-health-fill" id="hud-health" style="width:100%"></div>
      </div>
      <div class="hud-ammo" id="hud-ammo">MSL: 4</div>
      <div class="hud-chaff" id="hud-chaff">CHAFF: 12</div>
      <div class="hud-gforce" id="hud-gforce">1.0G</div>
      <div class="hud-controls">
        <span>WASD: Pitch/Roll | Q/E: Yaw | R/F: Throttle | Shift: AB | Space: Seeker | X: Chaff | 1-4: Weapons</span>
      </div>
    `;

    document.getElementById('app')!.appendChild(this.container);

    this.speedEl = document.getElementById('hud-speed') as HTMLSpanElement;
    this.altEl = document.getElementById('hud-alt') as HTMLSpanElement;
    this.throttleBarEl = document.getElementById('hud-throttle') as HTMLDivElement;
    this.stallWarning = document.getElementById('hud-stall') as HTMLDivElement;
    this.modeIndicator = document.getElementById('hud-mode') as HTMLSpanElement;
    this.healthBarEl = document.getElementById('hud-health') as HTMLDivElement;
    this.ammoEl = document.getElementById('hud-ammo') as HTMLSpanElement;
    this.chaffEl = document.getElementById('hud-chaff') as HTMLSpanElement;
    this.gForceEl = document.getElementById('hud-gforce') as HTMLSpanElement;

    // Afterburner bar
    this.abBarEl = document.createElement('div');
    this.abBarEl.className = 'hud-ab';
    this.abBarEl.innerHTML = '<span class="hud-ab-label">AB</span><div class="hud-ab-track"><div class="hud-ab-fill" id="hud-ab-fill" style="width:100%"></div></div>';
    this.container.appendChild(this.abBarEl);
    this.abFillEl = this.abBarEl.querySelector('#hud-ab-fill') as HTMLDivElement;

    // Missile rack (individual slots, bottom-right)
    this.missileRackEl = document.createElement('div');
    this.missileRackEl.className = 'hud-missile-rack';
    this.container.appendChild(this.missileRackEl);

    // Weapon slots bar
    this.weaponSlotsEl = document.createElement('div');
    this.weaponSlotsEl.className = 'hud-weapon-slots';
    this.container.appendChild(this.weaponSlotsEl);

    // Seeker progress bar
    this.seekerBarEl = document.createElement('div');
    this.seekerBarEl.className = 'hud-seeker';
    this.seekerBarEl.innerHTML = '<div class="hud-seeker-label" id="hud-seeker-label">SEEKING</div><div class="hud-seeker-track"><div class="hud-seeker-fill" id="hud-seeker-fill"></div></div>';
    this.container.appendChild(this.seekerBarEl);
    this.seekerFillEl = this.seekerBarEl.querySelector('#hud-seeker-fill') as HTMLDivElement;
    this.seekerLabelEl = this.seekerBarEl.querySelector('#hud-seeker-label') as HTMLDivElement;

    // OOB warning
    this.oobWarningEl = document.createElement('div');
    this.oobWarningEl.className = 'hud-oob';
    this.oobWarningEl.textContent = 'RETURN TO COMBAT AREA';
    this.container.appendChild(this.oobWarningEl);

    // Mouse aim cursor
    this.mouseCursorEl = document.createElement('div');
    this.mouseCursorEl.className = 'hud-mouse-cursor';
    this.container.appendChild(this.mouseCursorEl);

    // Dynamic crosshair
    this.crosshairEl = document.createElement('div');
    this.crosshairEl.className = 'hud-crosshair';
    this.crosshairEl.innerHTML = '<div class="hud-crosshair-inner"><div class="hud-crosshair-dot"></div></div>';
    this.container.appendChild(this.crosshairEl);

    // Missile lock ring
    this.lockRingEl = document.createElement('div');
    this.lockRingEl.className = 'hud-lock-ring';
    this.container.appendChild(this.lockRingEl);

    // Enemy marker pool
    for (let i = 0; i < MAX_ENEMY_MARKERS; i++) {
      const marker = document.createElement('div');
      marker.className = 'hud-enemy-marker';
      marker.innerHTML = `
        <div class="enemy-diamond"></div>
        <div class="enemy-info"></div>
        <div class="enemy-health-track"><div class="enemy-health-fill"></div></div>
      `;
      this.container.appendChild(marker);
      this.enemyMarkers.push(marker);
    }
  }

  /** Project a world-space point to screen pixels. Returns null if behind camera. */
  private project(wx: number, wy: number, wz: number, camera: THREE.Camera): { x: number; y: number } | null {
    this._v3.set(wx, wy, wz);
    this._v3.project(camera);
    if (this._v3.z > 1) return null; // behind camera
    const hw = window.innerWidth * 0.5;
    const hh = window.innerHeight * 0.5;
    return {
      x: this._v3.x * hw + hw,
      y: -this._v3.y * hh + hh,
    };
  }

  update(state: GameState, camera: THREE.Camera): void {
    const player = state.player;
    const combat = state.combat;

    // ── Basic gauges ─────────────────────────────────────────────────────
    this.speedEl.textContent = Math.round(player.speed * 3.6).toString();
    this.altEl.textContent = Math.round(player.altitude).toString();
    this.throttleBarEl.style.height = `${player.throttle * 100}%`;
    this.stallWarning.className = player.isStalling
      ? 'stall-warning active'
      : 'stall-warning';
    this.modeIndicator.textContent = state.input.useMouseAim ? 'MOUSE AIM' : 'KEYBOARD';

    // Health bar
    const hp = Math.max(0, Math.min(100, player.health));
    this.healthBarEl.style.width = `${hp}%`;
    this.healthBarEl.style.background = hp > 50 ? '#44cc44' : hp > 25 ? '#ccaa22' : '#cc3333';

    // Missile ammo
    this.ammoEl.textContent = `MSL: ${combat.playerMissileAmmo}`;

    // Chaff counter
    this.chaffEl.textContent = `CHAFF: ${combat.chaff.ammo}`;

    // G-force
    const g = player.gForce;
    const gAbs = Math.abs(g);
    this.gForceEl.textContent = `${g.toFixed(1)}G`;
    this.gForceEl.className = 'hud-gforce' + (gAbs > 6 ? ' extreme' : gAbs > 4 ? ' high' : '');

    // Afterburner fuel bar
    const abPct = Math.round(player.afterburnerFuel * 100);
    this.abFillEl.style.width = `${abPct}%`;
    this.abFillEl.className = 'hud-ab-fill' + (player.afterburner ? ' active' : '');

    // ── Missile rack (individual slots bottom-right) ────────────────────
    const missileSlots = combat.weaponSlots.filter(ws => ws.weaponId !== 'cannon');
    if (this.missileRackEl.children.length !== missileSlots.length) {
      this.missileRackEl.innerHTML = '';
      for (const ws of missileSlots) {
        const el = document.createElement('div');
        el.className = 'hud-mrack-slot';
        el.innerHTML = `<span class="hud-mrack-name"></span><span class="hud-mrack-ammo"></span>`;
        el.dataset.slot = String(ws.slot);
        this.missileRackEl.appendChild(el);
      }
    }
    for (let i = 0; i < missileSlots.length; i++) {
      const ws = missileSlots[i];
      const el = this.missileRackEl.children[i] as HTMLDivElement;
      const nameEl = el.querySelector('.hud-mrack-name') as HTMLSpanElement;
      const ammoEl = el.querySelector('.hud-mrack-ammo') as HTMLSpanElement;
      // Capitalize weapon name nicely
      const displayName = ws.weaponId.charAt(0).toUpperCase() + ws.weaponId.slice(1);
      nameEl.textContent = `${ws.slot}: ${displayName}`;
      ammoEl.textContent = ws.ammo < 0 ? '∞' : String(ws.ammo);
      const isSelected = ws.slot === combat.selectedSlot;
      const isEmpty = ws.ammo === 0;
      el.className = 'hud-mrack-slot'
        + (isSelected ? ' selected' : '')
        + (isEmpty ? ' empty' : ws.ammo > 0 ? ' ready' : '');
    }

    // ── Weapon slots ──────────────────────────────────────────────────────
    const slots = combat.weaponSlots;
    // Rebuild slot divs if count changed
    if (this.weaponSlotsEl.children.length !== slots.length) {
      this.weaponSlotsEl.innerHTML = '';
      for (const ws of slots) {
        const el = document.createElement('div');
        el.className = 'hud-wslot';
        el.dataset.slot = String(ws.slot);
        this.weaponSlotsEl.appendChild(el);
      }
    }
    for (let i = 0; i < slots.length; i++) {
      const ws = slots[i];
      const el = this.weaponSlotsEl.children[i] as HTMLDivElement;
      const isActive = ws.slot === combat.selectedSlot;
      const ammoStr = ws.ammo < 0 ? '∞' : String(ws.ammo);
      el.textContent = `${ws.slot}: ${ws.weaponId.slice(0, 4).toUpperCase()} ${ammoStr}`;
      el.className = 'hud-wslot' + (isActive ? ' active' : '') + (ws.ammo === 0 ? ' empty' : '');
    }

    // ── Seeker progress ───────────────────────────────────────────────────
    const seeker = combat.seeker;
    if (seeker.active) {
      this.seekerBarEl.className = 'hud-seeker active';
      const pct = Math.min(100, (seeker.lockTimer / seeker.seekDuration) * 100);
      this.seekerFillEl.style.width = `${pct}%`;
      if (seeker.locked) {
        this.seekerFillEl.className = 'hud-seeker-fill locked';
        this.seekerLabelEl.textContent = 'LOCKED — CLICK TO FIRE';
        this.seekerLabelEl.style.color = '#44ff44';
      } else if (seeker.targetId >= 0) {
        this.seekerFillEl.className = 'hud-seeker-fill';
        this.seekerLabelEl.textContent = 'SEEKING...';
        this.seekerLabelEl.style.color = '#ff4444';
      } else {
        this.seekerFillEl.className = 'hud-seeker-fill';
        this.seekerLabelEl.textContent = 'NO TARGET';
        this.seekerLabelEl.style.color = '#888';
      }
    } else {
      this.seekerBarEl.className = 'hud-seeker';
    }

    // ── OOB warning ───────────────────────────────────────────────────────
    const oob = combat.oob;
    if (oob.isOOB) {
      const timeLeft = Math.max(0, oob.oobMaxTime - oob.oobTimer);
      this.oobWarningEl.className = 'hud-oob active';
      this.oobWarningEl.textContent = `RETURN TO COMBAT AREA (${Math.ceil(timeLeft)}s)`;
    } else {
      this.oobWarningEl.className = 'hud-oob';
    }

    // ── Mouse aim cursor ──────────────────────────────────────────────────
    if (state.input.useMouseAim) {
      this.mouseCursorEl.className = 'hud-mouse-cursor visible';
      const mx = (state.input.mouseX + 1) * 0.5 * window.innerWidth;
      const my = (state.input.mouseY + 1) * 0.5 * window.innerHeight;
      this.mouseCursorEl.style.left = `${mx}px`;
      this.mouseCursorEl.style.top = `${my}px`;
    } else {
      this.mouseCursorEl.className = 'hud-mouse-cursor';
    }

    // ── Dynamic crosshair (follows plane forward direction) ──────────────
    this._quat.set(
      player.rotation.x, player.rotation.y,
      player.rotation.z, player.rotation.w,
    );
    this._v3.set(0, 0, -1).applyQuaternion(this._quat); // forward
    const aimX = player.position.x + this._v3.x * CROSSHAIR_AHEAD;
    const aimY = player.position.y + this._v3.y * CROSSHAIR_AHEAD;
    const aimZ = player.position.z + this._v3.z * CROSSHAIR_AHEAD;
    const aimScreen = this.project(aimX, aimY, aimZ, camera);
    if (aimScreen) {
      this.crosshairEl.style.display = 'block';
      this.crosshairEl.style.left = `${aimScreen.x}px`;
      this.crosshairEl.style.top = `${aimScreen.y}px`;
    } else {
      this.crosshairEl.style.display = 'none';
    }

    // ── Missile lock ring ────────────────────────────────────────────────
    let lockTarget = -1;
    for (const m of combat.missiles) {
      if (m.active && m.targetId >= 0 && m.ownerId === 0) {
        lockTarget = m.targetId;
        break;
      }
    }
    if (lockTarget >= 0) {
      const target = combat.enemies.find(e => e.id === lockTarget && e.aiMode !== 'destroyed');
      if (target) {
        const pos = this.project(target.position.x, target.position.y, target.position.z, camera);
        if (pos) {
          this.lockRingEl.className = 'hud-lock-ring locked';
          this.lockRingEl.style.left = `${pos.x}px`;
          this.lockRingEl.style.top = `${pos.y}px`;
        } else {
          this.lockRingEl.className = 'hud-lock-ring';
        }
      } else {
        this.lockRingEl.className = 'hud-lock-ring';
      }
    } else {
      this.lockRingEl.className = 'hud-lock-ring';
    }

    // ── Enemy markers ────────────────────────────────────────────────────
    const enemies = combat.enemies;
    for (let i = 0; i < MAX_ENEMY_MARKERS; i++) {
      const marker = this.enemyMarkers[i];
      if (i >= enemies.length) {
        marker.style.display = 'none';
        continue;
      }
      const e = enemies[i];
      if (e.aiMode === 'destroyed' && e.destroyedTimer > 3) {
        marker.style.display = 'none';
        continue;
      }

      const pos = this.project(e.position.x, e.position.y, e.position.z, camera);
      if (!pos) {
        // Off-screen: show edge indicator
        marker.style.display = 'none';
        continue;
      }

      // Clamp to screen edges with margin
      const margin = 40;
      const cx = Math.max(margin, Math.min(window.innerWidth - margin, pos.x));
      const cy = Math.max(margin, Math.min(window.innerHeight - margin, pos.y));

      marker.style.display = 'block';
      marker.style.left = `${cx}px`;
      marker.style.top = `${cy}px`;

      // Diamond color by AI state
      const diamond = marker.querySelector('.enemy-diamond') as HTMLDivElement;
      diamond.className = 'enemy-diamond';
      if (e.aiMode === 'destroyed') diamond.classList.add('destroyed');
      else if (e.aiMode === 'fire') diamond.classList.add('fire');
      else if (e.aiMode === 'engage') diamond.classList.add('engage');

      // Distance label
      const dx = e.position.x - player.position.x;
      const dy = e.position.y - player.position.y;
      const dz = e.position.z - player.position.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      const infoEl = marker.querySelector('.enemy-info') as HTMLDivElement;
      if (dist > 1000) {
        infoEl.textContent = `${(dist / 1000).toFixed(1)}km`;
      } else {
        infoEl.textContent = `${Math.round(dist)}m`;
      }

      // Health bar
      const healthFill = marker.querySelector('.enemy-health-fill') as HTMLDivElement;
      const hpPct = Math.max(0, (e.health / e.maxHealth) * 100);
      healthFill.style.width = `${hpPct}%`;
      healthFill.style.background = hpPct > 50 ? '#44cc44' : hpPct > 25 ? '#ccaa22' : '#ff3333';
    }
  }
}
