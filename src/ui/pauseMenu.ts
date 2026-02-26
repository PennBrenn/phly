export class PauseMenu {
  private container: HTMLDivElement;
  private _visible = false;

  private onResume: () => void;
  private onSettings: () => void;
  private onMainMenu: () => void;

  constructor(callbacks: {
    onResume: () => void;
    onSettings: () => void;
    onMainMenu: () => void;
  }) {
    this.onResume = callbacks.onResume;
    this.onSettings = callbacks.onSettings;
    this.onMainMenu = callbacks.onMainMenu;

    this.container = document.createElement('div');
    this.container.id = 'pause-menu';
    this.container.innerHTML = `
      <style>
        #pause-menu {
          position: fixed; inset: 0;
          background: rgba(0,0,0,0.7);
          backdrop-filter: blur(4px);
          display: none;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          z-index: 910;
          font-family: 'Courier New', monospace;
          color: #fff;
        }
        #pause-menu.open { display: flex; }
        .pause-title {
          font-size: 32px;
          font-weight: bold;
          letter-spacing: 6px;
          margin-bottom: 40px;
          opacity: 0.9;
        }
        .pause-btn {
          display: block;
          width: 240px;
          padding: 12px 0;
          margin: 6px 0;
          border: 1px solid rgba(255,255,255,0.2);
          background: rgba(255,255,255,0.04);
          color: #fff;
          font-family: 'Courier New', monospace;
          font-size: 14px;
          letter-spacing: 2px;
          text-transform: uppercase;
          cursor: pointer;
          transition: all 0.15s;
          text-align: center;
          border-radius: 3px;
        }
        .pause-btn:hover {
          background: rgba(255,255,255,0.1);
          border-color: rgba(255,255,255,0.5);
        }
        .pause-btn.danger {
          border-color: rgba(255,80,80,0.3);
          color: rgba(255,120,120,0.9);
        }
        .pause-btn.danger:hover {
          background: rgba(255,60,60,0.15);
          border-color: rgba(255,80,80,0.6);
        }
        .pause-hint {
          margin-top: 24px;
          font-size: 11px;
          opacity: 0.3;
        }
      </style>
      <div class="pause-title">PAUSED</div>
      <button class="pause-btn" id="pause-resume">Resume</button>
      <button class="pause-btn" id="pause-settings">Settings</button>
      <button class="pause-btn danger" id="pause-mainmenu">Return to Menu</button>
      <div class="pause-hint">ESC to resume</div>
    `;
    document.body.appendChild(this.container);

    this.container.querySelector('#pause-resume')!.addEventListener('click', () => {
      this.hide();
      this.onResume();
    });
    this.container.querySelector('#pause-settings')!.addEventListener('click', () => {
      this.onSettings();
    });
    this.container.querySelector('#pause-mainmenu')!.addEventListener('click', () => {
      this.hide();
      this.onMainMenu();
    });
  }

  show(): void {
    this._visible = true;
    this.container.classList.add('open');
  }

  hide(): void {
    this._visible = false;
    this.container.classList.remove('open');
  }

  isVisible(): boolean {
    return this._visible;
  }
}
