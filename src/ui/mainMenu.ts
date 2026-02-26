export class MainMenu {
  private container: HTMLDivElement;
  private onStart: () => void;
  private _visible = true;

  constructor(onStart: () => void) {
    this.onStart = onStart;
    this.container = document.createElement('div');
    this.container.id = 'main-menu';
    this.container.innerHTML = `
      <style>
        #main-menu {
          position: fixed; inset: 0;
          background: rgba(8,8,18,0.6);
          display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          z-index: 900;
          font-family: 'Courier New', monospace;
          color: #fff;
          transition: opacity 0.4s;
          overflow: hidden;
        }
        #main-menu.hidden { opacity: 0; pointer-events: none; display: none; }

        .mm-title {
          font-size: 96px;
          font-weight: bold;
          letter-spacing: 24px;
          margin-bottom: 8px;
          text-shadow: 0 0 40px rgba(100,140,255,0.4), 0 0 80px rgba(100,140,255,0.15);
          animation: mm-title-glow 3s ease-in-out infinite;
        }
        @keyframes mm-title-glow {
          0%, 100% { text-shadow: 0 0 40px rgba(100,140,255,0.4), 0 0 80px rgba(100,140,255,0.15); }
          50% { text-shadow: 0 0 60px rgba(100,180,255,0.6), 0 0 120px rgba(100,140,255,0.25); }
        }

        .mm-subtitle {
          font-size: 14px;
          letter-spacing: 6px;
          opacity: 0.4;
          margin-bottom: 60px;
          text-transform: uppercase;
        }

        .mm-btn {
          display: block;
          width: 280px;
          padding: 14px 0;
          margin: 8px 0;
          border: 1px solid rgba(255,255,255,0.2);
          background: rgba(255,255,255,0.03);
          color: #fff;
          font-family: 'Courier New', monospace;
          font-size: 16px;
          letter-spacing: 3px;
          text-transform: uppercase;
          cursor: pointer;
          transition: all 0.2s;
          text-align: center;
        }
        .mm-btn:hover {
          background: rgba(255,255,255,0.1);
          border-color: rgba(255,255,255,0.5);
          text-shadow: 0 0 8px rgba(255,255,255,0.3);
        }
        .mm-btn:active {
          transform: scale(0.98);
        }
        .mm-btn.primary {
          border-color: rgba(100,180,255,0.5);
          background: rgba(100,140,255,0.1);
        }
        .mm-btn.primary:hover {
          background: rgba(100,140,255,0.2);
          border-color: rgba(100,180,255,0.8);
        }

        .mm-version {
          position: absolute;
          bottom: 20px;
          right: 30px;
          font-size: 11px;
          opacity: 0.3;
        }

        .mm-controls {
          position: absolute;
          bottom: 20px;
          left: 30px;
          font-size: 11px;
          opacity: 0.3;
          line-height: 1.8;
        }

        .mm-bg-grid {
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(rgba(100,140,255,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(100,140,255,0.03) 1px, transparent 1px);
          background-size: 60px 60px;
          pointer-events: none;
        }
      </style>
      <div class="mm-bg-grid"></div>
      <div class="mm-title">PHLY</div>
      <div class="mm-subtitle">Flight Combat</div>
      <button class="mm-btn primary" id="mm-start">Play</button>
      <button class="mm-btn" id="mm-multiplayer">Multiplayer</button>
      <button class="mm-btn" id="mm-settings">Settings</button>
      <div class="mm-controls">
        WASD: Pitch/Roll &nbsp;|&nbsp; Q/E: Yaw &nbsp;|&nbsp; R/F: Throttle<br>
        Space: Seeker &nbsp;|&nbsp; Click: Fire &nbsp;|&nbsp; Shift: Afterburner<br>
        X: Chaff &nbsp;|&nbsp; 1-4: Weapons &nbsp;|&nbsp; Tab: Camera
      </div>
      <div class="mm-version">v0.3.0</div>
    `;
    document.body.appendChild(this.container);

    this.container.querySelector('#mm-start')!.addEventListener('click', () => {
      this.hide();
      this.onStart();
    });
  }

  onSettingsClick(cb: () => void): void {
    this.container.querySelector('#mm-settings')!.addEventListener('click', cb);
  }

  onMultiplayerClick(cb: () => void): void {
    this.container.querySelector('#mm-multiplayer')!.addEventListener('click', () => {
      this.hide();
      cb();
    });
  }

  isVisible(): boolean {
    return this._visible;
  }

  show(): void {
    this._visible = true;
    this.container.classList.remove('hidden');
  }

  hide(): void {
    this._visible = false;
    this.container.classList.add('hidden');
  }
}
