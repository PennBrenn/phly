export class LoadingScreen {
  private container: HTMLDivElement;
  private barFill: HTMLDivElement;
  private label: HTMLSpanElement;

  constructor() {
    this.container = document.createElement('div');
    this.container.id = 'loading-screen';
    this.container.innerHTML = `
      <style>
        #loading-screen {
          position: fixed; inset: 0;
          background: linear-gradient(135deg, #050510 0%, #0a0a20 50%, #080818 100%);
          display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          z-index: 1000;
          font-family: 'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif;
          color: #fff;
          transition: opacity 0.6s ease;
        }
        #loading-screen.fade-out { opacity: 0; pointer-events: none; }
        .loading-title {
          font-size: 52px; font-weight: 800; margin-bottom: 44px; letter-spacing: 14px;
          background: linear-gradient(135deg, #ffffff 0%, #a0c4ff 50%, #ffffff 100%);
          -webkit-background-clip: text; -webkit-text-fill-color: transparent;
          background-clip: text;
          filter: drop-shadow(0 0 20px rgba(100,160,255,0.25));
        }
        .loading-bar-track {
          width: 280px; height: 3px;
          background: rgba(255,255,255,0.08);
          border-radius: 2px; overflow: hidden;
        }
        .loading-bar-fill {
          height: 100%; width: 0%;
          background: linear-gradient(90deg, rgba(80,140,255,0.8), rgba(160,200,255,0.9));
          border-radius: 2px;
          transition: width 0.25s ease;
          box-shadow: 0 0 8px rgba(80,140,255,0.3);
        }
        .loading-label {
          margin-top: 16px; font-size: 11px; opacity: 0.35;
          font-weight: 500; letter-spacing: 1px;
        }
      </style>
      <div class="loading-title">PHLY</div>
      <div class="loading-bar-track">
        <div class="loading-bar-fill" id="loading-bar-fill"></div>
      </div>
      <span class="loading-label" id="loading-label">Loading... 0%</span>
    `;
    document.body.appendChild(this.container);
    this.barFill = this.container.querySelector('#loading-bar-fill')!;
    this.label = this.container.querySelector('#loading-label')!;
  }

  setProgress(fraction: number): void {
    const pct = Math.round(fraction * 100);
    this.barFill.style.width = `${pct}%`;
    this.label.textContent = `Loading... ${pct}%`;
  }

  hide(): void {
    this.container.classList.add('fade-out');
    setTimeout(() => this.container.remove(), 500);
  }
}
