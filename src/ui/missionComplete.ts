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
      #mission-complete-ui{position:fixed;inset:0;background:rgba(0,0,0,0.85);backdrop-filter:blur(6px);
        color:#fff;font-family:'Courier New',monospace;z-index:860;display:none;
        flex-direction:column;align-items:center;justify-content:center;padding:30px;}
      #mission-complete-ui.open{display:flex;}
      .mc-result{font-size:36px;font-weight:bold;letter-spacing:6px;margin-bottom:8px;}
      .mc-result.win{color:#44ff88;text-shadow:0 0 30px rgba(68,255,136,0.3);}
      .mc-result.lose{color:#ff4444;text-shadow:0 0 30px rgba(255,68,68,0.3);}
      .mc-mission-name{font-size:14px;opacity:0.5;letter-spacing:2px;margin-bottom:30px;}
      .mc-grade{font-size:96px;font-weight:bold;margin-bottom:20px;line-height:1;}
      .mc-grade.S{color:#ffdd44;text-shadow:0 0 40px rgba(255,220,68,0.4);}
      .mc-grade.A{color:#44ff88;text-shadow:0 0 30px rgba(68,255,136,0.3);}
      .mc-grade.B{color:#44aaff;text-shadow:0 0 20px rgba(68,170,255,0.3);}
      .mc-grade.C{color:#aaaaaa;}
      .mc-grade.F{color:#ff4444;}
      .mc-stats{margin-bottom:24px;text-align:center;line-height:2;}
      .mc-stat{font-size:13px;opacity:0.7;}
      .mc-stat span{color:#ffdd44;font-weight:bold;}
      .mc-bonuses{margin-bottom:24px;font-size:11px;opacity:0.5;text-align:center;line-height:1.8;}
      .mc-btn{padding:12px 40px;border:1px solid rgba(255,255,255,0.3);background:rgba(255,255,255,0.05);
        color:#fff;font-family:inherit;font-size:16px;cursor:pointer;border-radius:4px;letter-spacing:3px;
        text-transform:uppercase;transition:all 0.15s;}
      .mc-btn:hover{background:rgba(255,255,255,0.12);border-color:rgba(255,255,255,0.6);}
    `;
    document.head.appendChild(s);
  }

  showWin(missionName: string, reward: MissionReward): void {
    this._visible = true;
    this.container.innerHTML = `
      <div class="mc-result win">MISSION COMPLETE</div>
      <div class="mc-mission-name">${missionName}</div>
      <div class="mc-grade ${reward.grade}">${reward.grade}</div>
      <div class="mc-stats">
        <div class="mc-stat">Credits earned: <span>+${reward.credits.toLocaleString()}</span></div>
        <div class="mc-stat">Score: <span>+${reward.score.toLocaleString()}</span></div>
      </div>
      ${reward.bonuses.length > 0 ? `<div class="mc-bonuses">${reward.bonuses.map(b => `${b.reason}: +${b.amount}`).join('<br>')}</div>` : ''}
      <button class="mc-btn" id="mc-continue">Continue</button>
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
      <div class="mc-result lose">MISSION FAILED</div>
      <div class="mc-mission-name">${missionName}</div>
      <div class="mc-grade F">F</div>
      <div class="mc-stats">
        <div class="mc-stat" style="opacity:0.5">No rewards earned</div>
      </div>
      <button class="mc-btn" id="mc-continue">Return to Menu</button>
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
