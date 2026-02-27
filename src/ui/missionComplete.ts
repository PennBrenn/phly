import type { MissionReward } from '@/state/economyState';

export class MissionCompleteUI {
  private container: HTMLDivElement;
  private _visible = false;

  constructor(private onContinue: () => void) {
    this.container = document.createElement('div');
    this.container.id = 'mission-complete-ui';
    this.injectStyles();
    document.body.appendChild(this.container);
  }

  private injectStyles(): void {
    if (document.getElementById('mc-styles')) return;
    const s = document.createElement('style');
    s.id = 'mc-styles';
    s.textContent = `
      #mission-complete-ui{position:fixed;inset:0;background:rgba(0,0,0,0.8);backdrop-filter:blur(12px);
        -webkit-backdrop-filter:blur(12px);
        color:#fff;font-family:'Inter','Segoe UI',system-ui,-apple-system,sans-serif;z-index:910;display:none;
        flex-direction:column;align-items:center;justify-content:center;padding:30px;}
      #mission-complete-ui.open{display:flex;}
      .mc-card{background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);
        border-radius:16px;padding:40px 60px;text-align:center;max-width:400px;
        backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);
        animation:mc-slide-in 0.4s ease-out;}
      @keyframes mc-slide-in{from{opacity:0;transform:translateY(20px) scale(0.97);}to{opacity:1;transform:none;}}
      .mc-result{font-size:14px;font-weight:700;letter-spacing:4px;margin-bottom:4px;text-transform:uppercase;}
      .mc-result.win{color:#3ade88;}
      .mc-result.lose{color:#ff4455;}
      .mc-mission-name{font-size:12px;opacity:0.4;letter-spacing:2px;margin-bottom:28px;font-weight:500;}
      .mc-grade{font-size:80px;font-weight:800;margin-bottom:24px;line-height:1;
        animation:mc-grade-pop 0.5s ease-out 0.2s both;}
      @keyframes mc-grade-pop{from{opacity:0;transform:scale(0.5);}to{opacity:1;transform:scale(1);}}
      .mc-grade.S{background:linear-gradient(135deg,#ffdd44,#ffaa00);-webkit-background-clip:text;
        -webkit-text-fill-color:transparent;filter:drop-shadow(0 0 30px rgba(255,200,0,0.4));}
      .mc-grade.A{color:#3ade88;filter:drop-shadow(0 0 20px rgba(58,222,136,0.3));}
      .mc-grade.B{color:#60b0ff;filter:drop-shadow(0 0 15px rgba(96,176,255,0.25));}
      .mc-grade.C{color:#999;}
      .mc-grade.F{color:#ff4455;filter:drop-shadow(0 0 15px rgba(255,68,85,0.3));}
      .mc-divider{width:60px;height:1px;background:rgba(255,255,255,0.1);margin:0 auto 20px auto;}
      .mc-stats{margin-bottom:20px;text-align:center;}
      .mc-stat{font-size:13px;opacity:0.6;margin-bottom:10px;font-weight:500;}
      .mc-stat span{color:#ffcc33;font-weight:700;font-variant-numeric:tabular-nums;}
      .mc-bonuses{margin-bottom:20px;font-size:11px;opacity:0.4;text-align:center;line-height:1.8;font-weight:500;}
      .mc-btn{padding:12px 44px;border:1px solid rgba(255,255,255,0.15);
        background:rgba(255,255,255,0.06);backdrop-filter:blur(8px);
        color:#fff;font-family:inherit;font-size:13px;font-weight:600;cursor:pointer;border-radius:8px;
        letter-spacing:2px;text-transform:uppercase;transition:all 0.2s ease;margin-top:8px;}
      .mc-btn:hover{background:rgba(255,255,255,0.12);border-color:rgba(255,255,255,0.35);
        transform:translateY(-1px);box-shadow:0 4px 16px rgba(0,0,0,0.3);}
      .mc-btn:active{transform:scale(0.98);}
    `;
    document.head.appendChild(s);
  }

  showWin(missionName: string, reward: MissionReward): void {
    this._visible = true;
    this.container.innerHTML = `
      <div class="mc-card">
        <div class="mc-result win">MISSION COMPLETE</div>
        <div class="mc-mission-name">${missionName}</div>
        <div class="mc-grade ${reward.grade}">${reward.grade}</div>
        <div class="mc-divider"></div>
        <div class="mc-stats">
          <div class="mc-stat">Credits earned: <span>+${reward.credits.toLocaleString()}</span></div>
          <div class="mc-stat">Score: <span>+${reward.score.toLocaleString()}</span></div>
        </div>
        ${reward.bonuses.length > 0 ? `<div class="mc-bonuses">${reward.bonuses.map(b => `${b.reason}: +${b.amount}`).join('<br>')}</div>` : ''}
        <button class="mc-btn" id="mc-continue">Continue</button>
      </div>
    `;
    this.container.classList.add('open');
    this.container.querySelector('#mc-continue')!.addEventListener('click', () => {
      this.hide();
      this.onContinue();
    });
  }

  showLose(missionName: string): void {
    this._visible = true;
    this.container.innerHTML = `
      <div class="mc-card">
        <div class="mc-result lose">MISSION FAILED</div>
        <div class="mc-mission-name">${missionName}</div>
        <div class="mc-grade F">F</div>
        <div class="mc-divider"></div>
        <div class="mc-stats">
          <div class="mc-stat" style="opacity:0.4">No rewards earned</div>
        </div>
        <button class="mc-btn" id="mc-continue">Return to Menu</button>
      </div>
    `;
    this.container.classList.add('open');
    this.container.querySelector('#mc-continue')!.addEventListener('click', () => {
      this.hide();
      this.onContinue();
    });
  }

  hide(): void {
    this._visible = false;
    this.container.classList.remove('open');
  }

  isVisible(): boolean { return this._visible; }
}
