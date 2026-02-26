/**
 * Multiplayer Menu — Host/Join UI overlay.
 */

export type MPMenuResult =
  | { action: 'host' }
  | { action: 'join'; code: string }
  | { action: 'back' };

export class MultiplayerMenu {
  private container: HTMLDivElement;
  private _visible = false;
  private _resolve: ((r: MPMenuResult) => void) | null = null;

  constructor() {
    this.container = document.createElement('div');
    this.container.id = 'mp-menu';
    this.injectStyles();
    document.body.appendChild(this.container);
  }

  private injectStyles(): void {
    if (document.getElementById('mp-styles')) return;
    const s = document.createElement('style');
    s.id = 'mp-styles';
    s.textContent = `
#mp-menu{position:fixed;inset:0;background:rgba(5,5,18,0.92);backdrop-filter:blur(8px);
  color:#fff;font-family:'Courier New',monospace;z-index:880;display:none;
  flex-direction:column;align-items:center;justify-content:center;}
#mp-menu.open{display:flex;}
.mp-title{font-size:24px;font-weight:bold;letter-spacing:4px;margin-bottom:40px;}
.mp-card{width:320px;border:1px solid rgba(255,255,255,0.08);border-radius:8px;
  padding:24px;background:rgba(255,255,255,0.02);margin-bottom:16px;}
.mp-card-title{font-size:14px;font-weight:bold;letter-spacing:2px;margin-bottom:12px;opacity:0.8;}
.mp-card-desc{font-size:11px;opacity:0.4;margin-bottom:16px;line-height:1.5;}
.mp-btn{width:100%;padding:10px 0;text-align:center;border:1px solid rgba(100,160,255,0.4);
  background:rgba(100,160,255,0.08);color:#aaccff;font-family:inherit;font-size:13px;
  letter-spacing:2px;text-transform:uppercase;cursor:pointer;border-radius:4px;transition:all 0.15s;}
.mp-btn:hover{background:rgba(100,160,255,0.18);border-color:rgba(100,160,255,0.7);}
.mp-input{width:100%;padding:10px 12px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.12);
  color:#fff;font-family:inherit;font-size:18px;letter-spacing:8px;text-align:center;text-transform:uppercase;
  border-radius:4px;margin-bottom:12px;box-sizing:border-box;}
.mp-input::placeholder{letter-spacing:2px;font-size:12px;opacity:0.3;}
.mp-input:focus{outline:none;border-color:rgba(100,160,255,0.5);}
.mp-back{margin-top:24px;padding:8px 24px;border:1px solid rgba(255,255,255,0.12);background:none;
  color:rgba(255,255,255,0.5);font-family:inherit;font-size:12px;letter-spacing:1px;cursor:pointer;
  border-radius:3px;transition:all 0.15s;}
.mp-back:hover{color:#fff;border-color:rgba(255,255,255,0.4);}
.mp-status{font-size:11px;opacity:0.4;margin-top:8px;min-height:16px;text-align:center;}
.mp-room-code{font-size:36px;font-weight:bold;letter-spacing:10px;text-align:center;
  color:#aaccff;margin:16px 0;text-shadow:0 0 20px rgba(100,160,255,0.3);}
.mp-waiting{font-size:12px;opacity:0.4;text-align:center;animation:mp-pulse 2s ease-in-out infinite;}
@keyframes mp-pulse{0%,100%{opacity:0.4}50%{opacity:0.8}}
    `;
    document.head.appendChild(s);
  }

  /** Show menu and return a promise that resolves when user picks an action. */
  prompt(): Promise<MPMenuResult> {
    return new Promise((resolve) => {
      this._resolve = resolve;
      this._visible = true;
      this.renderChoices();
      this.container.classList.add('open');
    });
  }

  /** Show the "waiting for player" screen after hosting. */
  showHostWaiting(roomCode: string): void {
    this.container.innerHTML = `
      <div class="mp-title">MULTIPLAYER</div>
      <div class="mp-card">
        <div class="mp-card-title">Room Code</div>
        <div class="mp-room-code">${roomCode}</div>
        <div class="mp-waiting">Waiting for player to join...</div>
      </div>
      <button class="mp-back" id="mp-cancel">Cancel</button>
    `;
    this.container.querySelector('#mp-cancel')!.addEventListener('click', () => {
      this.close({ action: 'back' });
    });
  }

  /** Show connecting status. */
  showConnecting(): void {
    this.container.innerHTML = `
      <div class="mp-title">MULTIPLAYER</div>
      <div class="mp-card">
        <div class="mp-waiting">Connecting to host...</div>
      </div>
    `;
  }

  /** Show an error then return to choices. */
  showError(msg: string): void {
    this.renderChoices(msg);
  }

  hide(): void {
    this._visible = false;
    this.container.classList.remove('open');
  }

  isVisible(): boolean { return this._visible; }

  private close(result: MPMenuResult): void {
    this.hide();
    if (this._resolve) {
      this._resolve(result);
      this._resolve = null;
    }
  }

  private renderChoices(error?: string): void {
    this.container.innerHTML = `
      <div class="mp-title">MULTIPLAYER</div>
      <div class="mp-card">
        <div class="mp-card-title">Host Game</div>
        <div class="mp-card-desc">Create a room and invite a friend with the room code.</div>
        <button class="mp-btn" id="mp-host">Create Room</button>
      </div>
      <div class="mp-card">
        <div class="mp-card-title">Join Game</div>
        <div class="mp-card-desc">Enter the 5-character room code from your friend.</div>
        <input class="mp-input" id="mp-code-input" type="text" maxlength="5" placeholder="ROOM CODE" autocomplete="off" spellcheck="false">
        <button class="mp-btn" id="mp-join">Join Room</button>
        <div class="mp-status" id="mp-status">${error ?? ''}</div>
      </div>
      <button class="mp-back" id="mp-back">Back</button>
    `;

    this.container.querySelector('#mp-host')!.addEventListener('click', () => {
      this.close({ action: 'host' });
    });

    this.container.querySelector('#mp-join')!.addEventListener('click', () => {
      const input = this.container.querySelector('#mp-code-input') as HTMLInputElement;
      const code = input.value.trim().toUpperCase();
      if (code.length < 5) {
        const status = this.container.querySelector('#mp-status')!;
        status.textContent = 'Code must be 5 characters';
        return;
      }
      this.close({ action: 'join', code });
    });

    // Enter key on input
    this.container.querySelector('#mp-code-input')!.addEventListener('keydown', (e) => {
      if ((e as KeyboardEvent).key === 'Enter') {
        (this.container.querySelector('#mp-join') as HTMLElement).click();
      }
    });

    this.container.querySelector('#mp-back')!.addEventListener('click', () => {
      this.close({ action: 'back' });
    });
  }
}
