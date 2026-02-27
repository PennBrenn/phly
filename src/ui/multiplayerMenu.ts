/**
 * Multiplayer Menu — Host/Join UI overlay with username + room code lobby.
 * Uses direct callback-based approach (no promises) for bulletproof UI transitions.
 */

export interface MPCallbacks {
  onHost: (username: string) => void;
  onJoin: (code: string, username: string) => void;
  onBack: () => void;
  onCancel: () => void;
}

export class MultiplayerMenu {
  private container: HTMLDivElement;
  private _visible = false;
  private _callbacks: MPCallbacks | null = null;

  constructor() {
    this.container = document.createElement('div');
    this.container.id = 'mp-menu';
    this.injectStyles();
    document.body.appendChild(this.container);
    console.log('[MPMenu] Constructed, container appended to body');
  }

  private injectStyles(): void {
    if (document.getElementById('mp-styles')) return;
    const s = document.createElement('style');
    s.id = 'mp-styles';
    s.textContent = `
#mp-menu{position:fixed;inset:0;background:rgba(5,5,18,0.92);backdrop-filter:blur(8px);
  color:#fff;font-family:'Courier New',monospace;z-index:950;display:none;
  flex-direction:column;align-items:center;justify-content:center;overflow-y:auto;}
#mp-menu.open{display:flex;}
.mp-title{font-size:28px;font-weight:bold;letter-spacing:6px;margin-bottom:12px;
  text-shadow:0 0 30px rgba(100,160,255,0.3);}
.mp-subtitle{font-size:11px;letter-spacing:3px;opacity:0.35;margin-bottom:40px;text-transform:uppercase;}
.mp-card{width:340px;border:1px solid rgba(255,255,255,0.08);border-radius:8px;
  padding:24px;background:rgba(255,255,255,0.02);margin-bottom:16px;}
.mp-card-title{font-size:13px;font-weight:bold;letter-spacing:2px;margin-bottom:12px;opacity:0.7;}
.mp-card-desc{font-size:11px;opacity:0.35;margin-bottom:16px;line-height:1.6;}
.mp-btn{width:100%;padding:12px 0;text-align:center;border:1px solid rgba(100,160,255,0.4);
  background:rgba(100,160,255,0.08);color:#aaccff;font-family:inherit;font-size:13px;
  letter-spacing:2px;text-transform:uppercase;cursor:pointer;border-radius:4px;transition:all 0.15s;}
.mp-btn:hover{background:rgba(100,160,255,0.18);border-color:rgba(100,160,255,0.7);}
.mp-btn:disabled{opacity:0.3;cursor:not-allowed;border-color:rgba(255,255,255,0.1);}
.mp-btn:disabled:hover{background:rgba(100,160,255,0.08);}
.mp-input{width:100%;padding:10px 12px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.12);
  color:#fff;font-family:inherit;font-size:18px;letter-spacing:8px;text-align:center;text-transform:uppercase;
  border-radius:4px;margin-bottom:12px;box-sizing:border-box;}
.mp-input::placeholder{letter-spacing:2px;font-size:12px;opacity:0.3;text-transform:none;}
.mp-input:focus{outline:none;border-color:rgba(100,160,255,0.5);}
.mp-input-name{width:100%;padding:10px 12px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.12);
  color:#fff;font-family:inherit;font-size:14px;letter-spacing:2px;text-align:center;
  border-radius:4px;margin-bottom:16px;box-sizing:border-box;}
.mp-input-name::placeholder{letter-spacing:1px;font-size:12px;opacity:0.3;}
.mp-input-name:focus{outline:none;border-color:rgba(100,160,255,0.5);}
.mp-back{margin-top:24px;padding:8px 24px;border:1px solid rgba(255,255,255,0.12);background:none;
  color:rgba(255,255,255,0.5);font-family:inherit;font-size:12px;letter-spacing:1px;cursor:pointer;
  border-radius:3px;transition:all 0.15s;}
.mp-back:hover{color:#fff;border-color:rgba(255,255,255,0.4);}
.mp-status{font-size:11px;opacity:0.5;margin-top:8px;min-height:16px;text-align:center;}
.mp-status.error{color:#ff6666;opacity:0.8;}
.mp-room-code{font-size:42px;font-weight:bold;letter-spacing:12px;text-align:center;
  color:#aaccff;margin:20px 0;text-shadow:0 0 30px rgba(100,160,255,0.4);
  padding:16px;border:1px solid rgba(100,160,255,0.15);border-radius:8px;
  background:rgba(100,160,255,0.03);}
.mp-room-label{font-size:11px;letter-spacing:3px;opacity:0.4;text-align:center;text-transform:uppercase;margin-bottom:4px;}
.mp-waiting{font-size:12px;opacity:0.4;text-align:center;margin-top:16px;animation:mp-pulse 2s ease-in-out infinite;}
@keyframes mp-pulse{0%,100%{opacity:0.4}50%{opacity:0.8}}
    `;
    document.head.appendChild(s);
  }

  // ─── Public API ──────────────────────────────────────────────────────────────

  /** Show the multiplayer menu with host/join/back choices. */
  show(callbacks: MPCallbacks): void {
    console.log('[MPMenu] show() called');
    this._callbacks = callbacks;
    this._visible = true;
    this.renderChoices();
    this.container.classList.add('open');
    console.log('[MPMenu] show() done, classList:', this.container.className);
  }

  /** Transition to "Connecting to PeerJS..." immediately (sync, no async dependency). */
  showConnectingToBroker(): void {
    console.log('[MPMenu] showConnectingToBroker()');
    this._visible = true;
    this.container.classList.add('open');
    this.container.innerHTML = `
      <div class="mp-title">MULTIPLAYER</div>
      <div class="mp-subtitle">Setting Up</div>
      <div class="mp-card">
        <div class="mp-waiting">Connecting to server...</div>
      </div>
      <button class="mp-back" id="mp-cancel">Cancel</button>
    `;
    this.container.querySelector('#mp-cancel')!.addEventListener('click', () => {
      console.log('[MPMenu] Cancel clicked during broker connect');
      this._callbacks?.onCancel();
    });
  }

  /** Show the room code waiting screen (host got a code, waiting for client). */
  showHostWaiting(roomCode: string): void {
    console.log('[MPMenu] showHostWaiting() code:', roomCode);
    this._visible = true;
    this.container.classList.add('open');
    this.container.innerHTML = `
      <div class="mp-title">MULTIPLAYER</div>
      <div class="mp-subtitle">Hosting Game</div>
      <div class="mp-card">
        <div class="mp-room-label">Share this code with your friend</div>
        <div class="mp-room-code">${roomCode}</div>
        <div class="mp-waiting">Waiting for player to join...</div>
      </div>
      <button class="mp-back" id="mp-cancel">Cancel</button>
    `;
    this.container.querySelector('#mp-cancel')!.addEventListener('click', () => {
      console.log('[MPMenu] Cancel clicked during host wait');
      this._callbacks?.onCancel();
    });
    console.log('[MPMenu] showHostWaiting() done, classList:', this.container.className);
  }

  /** Show "Connecting to host..." (client is joining). */
  showJoining(): void {
    console.log('[MPMenu] showJoining()');
    this._visible = true;
    this.container.classList.add('open');
    this.container.innerHTML = `
      <div class="mp-title">MULTIPLAYER</div>
      <div class="mp-subtitle">Joining Game</div>
      <div class="mp-card">
        <div class="mp-waiting">Connecting to host...</div>
      </div>
      <button class="mp-back" id="mp-cancel">Cancel</button>
    `;
    this.container.querySelector('#mp-cancel')!.addEventListener('click', () => {
      console.log('[MPMenu] Cancel clicked during join');
      this._callbacks?.onCancel();
    });
  }

  /** Show "Waiting for host to select mission..." (client connected, waiting). */
  showWaitingForMission(): void {
    console.log('[MPMenu] showWaitingForMission()');
    this._visible = true;
    this.container.classList.add('open');
    this.container.innerHTML = `
      <div class="mp-title">MULTIPLAYER</div>
      <div class="mp-subtitle">Connected</div>
      <div class="mp-card">
        <div class="mp-waiting">Waiting for host to select mission...</div>
      </div>
      <button class="mp-back" id="mp-cancel">Cancel</button>
    `;
    this.container.querySelector('#mp-cancel')!.addEventListener('click', () => {
      console.log('[MPMenu] Cancel clicked during mission wait');
      this._callbacks?.onCancel();
    });
  }

  /** Show an error, then return to the choices screen. */
  showError(msg: string): void {
    console.log('[MPMenu] showError():', msg);
    this._visible = true;
    this.container.classList.add('open');
    this.renderChoices(msg);
  }

  hide(): void {
    console.log('[MPMenu] hide()');
    this._visible = false;
    this.container.classList.remove('open');
  }

  isVisible(): boolean { return this._visible; }

  // ─── Private ─────────────────────────────────────────────────────────────────

  private renderChoices(error?: string): void {
    const savedName = localStorage.getItem('phly-username') || '';
    this.container.innerHTML = `
      <div class="mp-title">MULTIPLAYER</div>
      <div class="mp-subtitle">Play with a friend</div>

      <div class="mp-card">
        <div class="mp-card-title">Callsign</div>
        <input class="mp-input-name" id="mp-name" type="text" maxlength="16"
          placeholder="Enter your name" value="${savedName}" autocomplete="off" spellcheck="false">
      </div>

      <div class="mp-card">
        <div class="mp-card-title">Host Game</div>
        <div class="mp-card-desc">Create a room and share the code with a friend.</div>
        <button class="mp-btn" id="mp-host">Create Room</button>
      </div>

      <div class="mp-card">
        <div class="mp-card-title">Join Game</div>
        <div class="mp-card-desc">Enter the 5-character room code from your friend.</div>
        <input class="mp-input" id="mp-code-input" type="text" maxlength="5"
          placeholder="ROOM CODE" autocomplete="off" spellcheck="false">
        <button class="mp-btn" id="mp-join">Join Room</button>
      </div>

      ${error ? `<div class="mp-status error">${error}</div>` : ''}
      <button class="mp-back" id="mp-back">Back</button>
    `;

    const nameInput = this.container.querySelector('#mp-name') as HTMLInputElement;

    const getUsername = (): string => {
      const name = nameInput.value.trim() || 'Pilot';
      localStorage.setItem('phly-username', name);
      return name;
    };

    this.container.querySelector('#mp-host')!.addEventListener('click', () => {
      console.log('[MPMenu] Create Room clicked');
      const username = getUsername();
      // IMMEDIATELY show connecting state (sync, before any async work)
      this.showConnectingToBroker();
      this._callbacks?.onHost(username);
    });

    this.container.querySelector('#mp-join')!.addEventListener('click', () => {
      const codeInput = this.container.querySelector('#mp-code-input') as HTMLInputElement;
      const code = codeInput.value.trim().toUpperCase();
      if (code.length < 5) {
        const existing = this.container.querySelector('.mp-status.error');
        if (existing) { existing.textContent = 'Code must be 5 characters'; }
        else {
          const el = document.createElement('div');
          el.className = 'mp-status error';
          el.textContent = 'Code must be 5 characters';
          this.container.querySelector('#mp-join')!.after(el);
        }
        return;
      }
      console.log('[MPMenu] Join Room clicked, code:', code);
      const username = getUsername();
      // IMMEDIATELY show joining state
      this.showJoining();
      this._callbacks?.onJoin(code, username);
    });

    this.container.querySelector('#mp-code-input')!.addEventListener('keydown', (e) => {
      if ((e as KeyboardEvent).key === 'Enter') {
        (this.container.querySelector('#mp-join') as HTMLElement).click();
      }
    });

    this.container.querySelector('#mp-back')!.addEventListener('click', () => {
      console.log('[MPMenu] Back clicked');
      this.hide();
      this._callbacks?.onBack();
    });
  }
}
