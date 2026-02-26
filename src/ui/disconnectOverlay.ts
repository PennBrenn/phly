/**
 * Disconnect Overlay — shown when the remote player drops out.
 */

export class DisconnectOverlay {
  private container: HTMLDivElement;
  private _visible = false;

  constructor(private onContinue: () => void, private onQuit: () => void) {
    this.container = document.createElement('div');
    this.container.id = 'dc-overlay';
    this.injectStyles();
    document.body.appendChild(this.container);
  }

  private injectStyles(): void {
    if (document.getElementById('dc-styles')) return;
    const s = document.createElement('style');
    s.id = 'dc-styles';
    s.textContent = `
#dc-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.8);backdrop-filter:blur(6px);
  color:#fff;font-family:'Courier New',monospace;z-index:920;display:none;
  flex-direction:column;align-items:center;justify-content:center;}
#dc-overlay.open{display:flex;}
.dc-title{font-size:24px;font-weight:bold;letter-spacing:4px;margin-bottom:8px;color:#ff8844;}
.dc-sub{font-size:12px;opacity:0.5;margin-bottom:32px;}
.dc-btn{width:220px;padding:10px 0;text-align:center;border:1px solid rgba(255,255,255,0.15);
  background:rgba(255,255,255,0.03);color:#fff;font-family:inherit;font-size:13px;
  letter-spacing:2px;text-transform:uppercase;cursor:pointer;border-radius:4px;
  margin-bottom:8px;transition:all 0.15s;}
.dc-btn:hover{background:rgba(255,255,255,0.08);border-color:rgba(255,255,255,0.4);}
.dc-btn.primary{border-color:rgba(100,160,255,0.4);background:rgba(100,160,255,0.08);}
.dc-btn.primary:hover{background:rgba(100,160,255,0.18);}
    `;
    document.head.appendChild(s);
  }

  show(): void {
    this._visible = true;
    this.container.innerHTML = `
      <div class="dc-title">PLAYER DISCONNECTED</div>
      <div class="dc-sub">The other player has left the game.</div>
      <button class="dc-btn primary" id="dc-continue">Continue Solo</button>
      <button class="dc-btn" id="dc-quit">Return to Menu</button>
    `;
    this.container.classList.add('open');

    this.container.querySelector('#dc-continue')!.addEventListener('click', () => {
      this.hide();
      this.onContinue();
    });
    this.container.querySelector('#dc-quit')!.addEventListener('click', () => {
      this.hide();
      this.onQuit();
    });
  }

  hide(): void {
    this._visible = false;
    this.container.classList.remove('open');
  }

  isVisible(): boolean { return this._visible; }
}
