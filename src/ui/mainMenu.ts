export class MainMenu {
  private container: HTMLDivElement;
  private onSingleplayer: () => void;
  private _visible = true;

  constructor(onSingleplayer: () => void) {
    this.onSingleplayer = onSingleplayer;
    this.container = document.createElement('div');
    this.container.id = 'main-menu';
    this.container.innerHTML = `
      <style>
        #main-menu {
          position: fixed; inset: 0;
          background: linear-gradient(135deg, rgba(6,6,20,0.75) 0%, rgba(10,15,35,0.65) 100%);
          display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          z-index: 900;
          font-family: 'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif;
          color: #fff;
          transition: opacity 0.5s ease;
          overflow: hidden;
        }
        #main-menu.hidden { opacity: 0; pointer-events: none; display: none; }

        .mm-title {
          font-size: 88px;
          font-weight: 800;
          letter-spacing: 20px;
          margin-bottom: 6px;
          background: linear-gradient(135deg, #ffffff 0%, #a0c4ff 50%, #ffffff 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          filter: drop-shadow(0 0 30px rgba(100,160,255,0.35));
          animation: mm-title-glow 4s ease-in-out infinite;
        }
        @keyframes mm-title-glow {
          0%, 100% { filter: drop-shadow(0 0 30px rgba(100,160,255,0.35)); }
          50% { filter: drop-shadow(0 0 50px rgba(100,180,255,0.55)); }
        }

        .mm-subtitle {
          font-size: 13px;
          letter-spacing: 8px;
          opacity: 0.35;
          margin-bottom: 52px;
          text-transform: uppercase;
          font-weight: 500;
        }

        .mm-btn-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
          width: 280px;
        }

        .mm-btn {
          display: block;
          width: 100%;
          padding: 13px 0;
          border: 1px solid rgba(255,255,255,0.1);
          background: rgba(255,255,255,0.04);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          color: #fff;
          font-family: inherit;
          font-size: 13px;
          font-weight: 600;
          letter-spacing: 2.5px;
          text-transform: uppercase;
          cursor: pointer;
          transition: all 0.25s ease;
          text-align: center;
          border-radius: 6px;
        }
        .mm-btn:hover {
          background: rgba(255,255,255,0.1);
          border-color: rgba(255,255,255,0.3);
          transform: translateY(-1px);
          box-shadow: 0 4px 20px rgba(0,0,0,0.3);
        }
        .mm-btn:active {
          transform: scale(0.98) translateY(0);
        }
        .mm-btn.primary {
          border-color: rgba(80,150,255,0.4);
          background: linear-gradient(135deg, rgba(60,120,255,0.15) 0%, rgba(80,140,255,0.08) 100%);
        }
        .mm-btn.primary:hover {
          background: linear-gradient(135deg, rgba(60,120,255,0.25) 0%, rgba(80,140,255,0.15) 100%);
          border-color: rgba(80,150,255,0.7);
          box-shadow: 0 4px 24px rgba(60,120,255,0.2);
        }

        .mm-version {
          position: absolute;
          bottom: 20px;
          right: 28px;
          font-size: 11px;
          opacity: 0.25;
          font-weight: 500;
        }

        .mm-controls {
          position: absolute;
          bottom: 20px;
          left: 28px;
          font-size: 10px;
          opacity: 0.25;
          line-height: 1.9;
          letter-spacing: 0.3px;
        }

        .mm-bg-grid {
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(rgba(100,140,255,0.025) 1px, transparent 1px),
            linear-gradient(90deg, rgba(100,140,255,0.025) 1px, transparent 1px);
          background-size: 60px 60px;
          pointer-events: none;
          animation: mm-grid-drift 20s linear infinite;
        }
        @keyframes mm-grid-drift {
          0% { transform: translate(0, 0); }
          100% { transform: translate(60px, 60px); }
        }

        .mm-glow-orb {
          position: absolute;
          border-radius: 50%;
          pointer-events: none;
          filter: blur(80px);
          opacity: 0.12;
        }
        .mm-glow-orb.orb1 {
          width: 500px; height: 500px;
          background: #4080ff;
          top: -100px; right: -100px;
          animation: mm-orb-float 8s ease-in-out infinite;
        }
        .mm-glow-orb.orb2 {
          width: 400px; height: 400px;
          background: #8040ff;
          bottom: -80px; left: -80px;
          animation: mm-orb-float 10s ease-in-out infinite reverse;
        }
        @keyframes mm-orb-float {
          0%, 100% { transform: translate(0, 0); }
          50% { transform: translate(30px, -20px); }
        }
      </style>
      <div class="mm-bg-grid"></div>
      <div class="mm-glow-orb orb1"></div>
      <div class="mm-glow-orb orb2"></div>
      <div class="mm-title">PHLY</div>
      <div class="mm-subtitle">Flight Combat</div>
      <div class="mm-btn-group">
        <button class="mm-btn primary" id="mm-singleplayer">Singleplayer</button>
        <button class="mm-btn" id="mm-multiplayer">Multiplayer</button>
        <button class="mm-btn" id="mm-loadout">Loadout</button>
        <button class="mm-btn" id="mm-settings">Settings</button>
        <button class="mm-btn" id="mm-builder">Level Editor</button>
      </div>
      <div class="mm-controls">
        WASD: Pitch/Roll &nbsp;|&nbsp; Q/E: Yaw &nbsp;|&nbsp; R/F: Throttle<br>
        Space: Seeker &nbsp;|&nbsp; Click: Fire &nbsp;|&nbsp; Shift: Afterburner<br>
        X: Chaff &nbsp;|&nbsp; 1-4: Weapons &nbsp;|&nbsp; Tab: Camera
      </div>
      <div class="mm-version">v0.4.0</div>
    `;
    document.body.appendChild(this.container);

    this.container.querySelector('#mm-singleplayer')!.addEventListener('click', () => {
      this.hide();
      this.onSingleplayer();
    });

    this.container.querySelector('#mm-builder')!.addEventListener('click', () => {
      window.location.href = '/builder/';
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

  onLoadoutClick(cb: () => void): void {
    this.container.querySelector('#mm-loadout')!.addEventListener('click', () => {
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
