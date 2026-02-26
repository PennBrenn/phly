export class HUD {
  private speedEl!: HTMLSpanElement;
  private altEl!: HTMLSpanElement;
  private throttleBarEl!: HTMLDivElement;
  private stallWarning!: HTMLDivElement;
  private modeIndicator!: HTMLSpanElement;

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
      .hud-center {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        text-align: center;
      }
      .crosshair {
        font-size: 24px;
        opacity: 0.6;
      }
      .stall-warning {
        margin-top: 20px;
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
    `;
    document.head.appendChild(style);
  }

  private buildDOM(): void {
    const container = document.createElement('div');
    container.id = 'hud';
    container.innerHTML = `
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
      <div class="hud-center">
        <div class="crosshair">+</div>
        <div class="stall-warning" id="hud-stall">STALL</div>
      </div>
      <div class="hud-mode" id="hud-mode">KEYBOARD</div>
      <div class="hud-controls">
        <span>WASD: Pitch/Roll | Q/E: Yaw | Shift/Space: Throttle | M: Mouse Aim | Tab: Camera</span>
      </div>
    `;

    document.getElementById('app')!.appendChild(container);

    this.speedEl = document.getElementById('hud-speed') as HTMLSpanElement;
    this.altEl = document.getElementById('hud-alt') as HTMLSpanElement;
    this.throttleBarEl = document.getElementById('hud-throttle') as HTMLDivElement;
    this.stallWarning = document.getElementById('hud-stall') as HTMLDivElement;
    this.modeIndicator = document.getElementById('hud-mode') as HTMLSpanElement;
  }

  update(
    speed: number,
    altitude: number,
    throttle: number,
    isStalling: boolean,
    useMouseAim: boolean,
  ): void {
    this.speedEl.textContent = Math.round(speed * 3.6).toString();
    this.altEl.textContent = Math.round(altitude).toString();
    this.throttleBarEl.style.height = `${throttle * 100}%`;
    this.stallWarning.className = isStalling
      ? 'stall-warning active'
      : 'stall-warning';
    this.modeIndicator.textContent = useMouseAim ? 'MOUSE AIM' : 'KEYBOARD';
  }
}
