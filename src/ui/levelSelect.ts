import type { LevelManifest } from '@/levels/levelLoader';
import type { ProgressState } from '@/state/progressState';

export interface LevelSelectCallbacks {
  onSelectLevel: (levelId: string) => void;
  onBack: () => void;
}

export class LevelSelectUI {
  private container: HTMLDivElement;
  private _visible = false;

  constructor(
    private _levels: LevelManifest[],
    private _progress: ProgressState,
    private _callbacks: LevelSelectCallbacks,
  ) {
    this.container = document.createElement('div');
    this.container.id = 'level-select-ui';
    this.injectStyles();
    document.body.appendChild(this.container);
  }

  private injectStyles(): void {
    if (document.getElementById('lvlsel-styles')) return;
    const s = document.createElement('style');
    s.id = 'lvlsel-styles';
    s.textContent = `
      #level-select-ui{position:fixed;inset:0;background:rgba(5,5,15,0.95);backdrop-filter:blur(6px);
        color:#fff;font-family:'Courier New',monospace;z-index:900;display:none;
        flex-direction:column;align-items:center;justify-content:center;padding:30px;}
      #level-select-ui.open{display:flex;}
      .ls-title{font-size:24px;font-weight:bold;letter-spacing:4px;margin-bottom:30px;}
      .ls-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:16px;width:100%;max-width:900px;}
      .ls-card{border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:20px;cursor:pointer;
        background:rgba(255,255,255,0.02);transition:all 0.2s;position:relative;}
      .ls-card:hover{background:rgba(255,255,255,0.06);border-color:rgba(255,255,255,0.3);}
      .ls-card.locked{opacity:0.35;cursor:not-allowed;}
      .ls-card .ls-name{font-size:16px;font-weight:bold;margin-bottom:4px;letter-spacing:1px;}
      .ls-card .ls-biome{font-size:10px;text-transform:uppercase;opacity:0.4;letter-spacing:2px;margin-bottom:8px;}
      .ls-card .ls-desc{font-size:11px;opacity:0.6;line-height:1.5;margin-bottom:10px;}
      .ls-card .ls-grade{position:absolute;top:16px;right:16px;font-size:24px;font-weight:bold;opacity:0.3;}
      .ls-card .ls-grade.has-grade{opacity:0.8;color:#44ff88;}
      .ls-card .ls-lock{font-size:10px;color:#ff6644;margin-top:6px;}
      .ls-back{margin-top:24px;padding:10px 30px;border:1px solid rgba(255,255,255,0.2);background:rgba(255,255,255,0.04);
        color:#fff;font-family:inherit;font-size:14px;cursor:pointer;border-radius:4px;letter-spacing:2px;text-transform:uppercase;}
      .ls-back:hover{background:rgba(255,255,255,0.1);}
    `;
    document.head.appendChild(s);
  }

  show(): void {
    this._visible = true;
    this.render();
    this.container.classList.add('open');
  }

  hide(): void {
    this._visible = false;
    this.container.classList.remove('open');
  }

  isVisible(): boolean { return this._visible; }

  updateLevels(levels: LevelManifest[]): void {
    this._levels = levels;
    if (this._visible) this.render();
  }

  updateProgress(progress: ProgressState): void {
    this._progress = progress;
    if (this._visible) this.render();
  }

  private render(): void {
    const sorted = [...this._levels].sort((a, b) => a.order - b.order);
    let html = '<div class="ls-title">SELECT MISSION</div><div class="ls-grid">';
    for (const lvl of sorted) {
      const unlocked = this._progress.unlockedMissionIds.includes(lvl.id);
      const mp = this._progress.missions.find(m => m.missionId === lvl.id);
      const grade = mp?.bestGrade ?? null;
      html += `<div class="ls-card ${unlocked ? '' : 'locked'}" data-level="${lvl.id}">
        <div class="ls-grade ${grade ? 'has-grade' : ''}">${grade ?? '-'}</div>
        <div class="ls-name">${lvl.name}</div>
        <div class="ls-biome">${lvl.biome ?? 'unknown'}</div>
        <div class="ls-desc">${lvl.description}</div>
        ${!unlocked
          ? `<div class="ls-lock">Requires ${(lvl.requiredScore ?? 0).toLocaleString()} score to unlock</div>`
          : mp?.completed
            ? `<div style="font-size:10px;color:#44ff88">COMPLETED — Best: ${grade}</div>`
            : `<div style="font-size:10px;opacity:0.4">NOT COMPLETED</div>`}
      </div>`;
    }
    html += '</div><button class="ls-back" id="ls-back">Back</button>';
    this.container.innerHTML = html;

    this.container.querySelectorAll('.ls-card').forEach(card => {
      card.addEventListener('click', () => {
        const id = (card as HTMLElement).dataset.level!;
        if (this._progress.unlockedMissionIds.includes(id)) {
          this.hide();
          this._callbacks.onSelectLevel(id);
        }
      });
    });

    this.container.querySelector('#ls-back')!.addEventListener('click', () => {
      this.hide();
      this._callbacks.onBack();
    });
  }
}
