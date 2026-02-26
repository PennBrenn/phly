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
          background: #000;
          display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          z-index: 1000;
          font-family: 'Courier New', monospace;
          color: #fff;
          transition: opacity 0.4s;
        }
        #loading-screen.fade-out { opacity: 0; pointer-events: none; }
        .loading-title { font-size: 48px; font-weight: bold; margin-bottom: 40px; letter-spacing: 8px; }
        .loading-bar-track {
          width: 320px; height: 4px;
          background: rgba(255,255,255,0.15);
          border-radius: 2px; overflow: hidden;
        }
        .loading-bar-fill {
          height: 100%; width: 0%;
          background: #fff;
          transition: width 0.2s;
        }
        .loading-label { margin-top: 16px; font-size: 13px; opacity: 0.6; }
      </style>
      <div class="loading-title">PHLY</div>
      <div class="loading-bar-track">
        <div class="loading-bar-fill" id="loading-bar-fill"></div>
      </div>
      <span class="loading-label" id="loading-label">Loading Assets... 0%</span>
    `;
    document.body.appendChild(this.container);
    this.barFill = this.container.querySelector('#loading-bar-fill')!;
    this.label = this.container.querySelector('#loading-label')!;
  }

  setProgress(fraction: number): void {
    const pct = Math.round(fraction * 100);
    this.barFill.style.width = `${pct}%`;
    this.label.textContent = `Loading Assets... ${pct}%`;
  }

  hide(): void {
    this.container.classList.add('fade-out');
    setTimeout(() => this.container.remove(), 500);
  }
}
