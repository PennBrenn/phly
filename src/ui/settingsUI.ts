import {
  type Settings,
  type QualityPreset,
  saveSettings,
  applyPreset,
} from '@/core/settings';

export class SettingsUI {
  private container: HTMLDivElement;
  private visible = false;
  private settings: Settings;
  private onChange: (s: Settings) => void;

  constructor(settings: Settings, onChange: (s: Settings) => void) {
    this.settings = settings;
    this.onChange = onChange;
    this.container = document.createElement('div');
    this.container.id = 'settings-panel';
    this.injectStyles();
    this.buildDOM();
    document.getElementById('app')!.appendChild(this.container);

    window.addEventListener('keydown', (e) => {
      if (e.code === 'Escape') {
        this.toggle();
        e.preventDefault();
      }
    });
  }

  private injectStyles(): void {
    const style = document.createElement('style');
    style.textContent = `
      #settings-panel {
        position: fixed; top: 0; right: 0; bottom: 0;
        width: 320px;
        background: rgba(0,0,0,0.9);
        color: #fff;
        font-family: 'Courier New', monospace;
        font-size: 13px;
        padding: 24px;
        transform: translateX(100%);
        transition: transform 0.25s ease;
        z-index: 500;
        overflow-y: auto;
        pointer-events: auto;
      }
      #settings-panel.open { transform: translateX(0); }
      .settings-title { font-size: 18px; font-weight: bold; margin-bottom: 20px; letter-spacing: 2px; }
      .settings-section { margin-bottom: 16px; }
      .settings-section-title { font-size: 11px; opacity: 0.5; text-transform: uppercase; margin-bottom: 8px; letter-spacing: 1px; }
      .settings-row {
        display: flex; justify-content: space-between; align-items: center;
        margin-bottom: 8px;
      }
      .settings-row label { flex: 1; }
      .settings-btn {
        background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2);
        color: #fff; padding: 4px 12px; cursor: pointer; font-family: inherit; font-size: 12px;
        margin-left: 4px;
      }
      .settings-btn.active { background: rgba(255,255,255,0.3); border-color: #fff; }
      .settings-btn:hover { background: rgba(255,255,255,0.2); }
      .settings-toggle {
        width: 36px; height: 18px; border-radius: 9px;
        background: rgba(255,255,255,0.2); cursor: pointer;
        position: relative; transition: background 0.2s;
      }
      .settings-toggle.on { background: rgba(255,255,255,0.5); }
      .settings-toggle::after {
        content: ''; position: absolute; top: 2px; left: 2px;
        width: 14px; height: 14px; border-radius: 50%;
        background: #fff; transition: left 0.2s;
      }
      .settings-toggle.on::after { left: 20px; }
      .settings-slider {
        width: 120px; accent-color: #fff;
      }
      .settings-hint { font-size: 11px; opacity: 0.3; margin-top: 16px; text-align: center; }
      .debug-sliders { margin-top: 8px; }
      .debug-sliders .settings-row { margin-bottom: 4px; }
      .debug-sliders label { font-size: 11px; }
      .debug-val { font-size: 11px; min-width: 42px; text-align: right; opacity: 0.8; margin-left: 6px; }
    `;
    document.head.appendChild(style);
  }

  private buildDOM(): void {
    this.container.innerHTML = `
      <div class="settings-title">SETTINGS</div>

      <div class="settings-section">
        <div class="settings-section-title">Quality Preset</div>
        <div class="settings-row">
          <button class="settings-btn" data-preset="low">LOW</button>
          <button class="settings-btn" data-preset="medium">MED</button>
          <button class="settings-btn" data-preset="high">HIGH</button>
        </div>
      </div>

      <div class="settings-section">
        <div class="settings-section-title">Graphics</div>
        <div class="settings-row">
          <label>Shadows</label>
          <div class="settings-toggle" data-setting="shadows"></div>
        </div>
        <div class="settings-row">
          <label>Bloom</label>
          <div class="settings-toggle" data-setting="bloom"></div>
        </div>
        <div class="settings-row">
          <label>Fog Density</label>
          <input type="range" class="settings-slider" data-setting="fogDensity"
            min="0.000005" max="0.00015" step="0.000005">
        </div>
        <div class="settings-row">
          <label>Tree Density</label>
          <input type="range" class="settings-slider" data-setting="treeDensity"
            min="0" max="1" step="0.05">
        </div>
        <div class="settings-hint" style="margin-top:2px;margin-bottom:8px">Tree density applies on reload</div>
        <div class="settings-row">
          <label>Show FPS</label>
          <div class="settings-toggle" data-setting="showFPS"></div>
        </div>
      </div>

      <div class="settings-section">
        <div class="settings-section-title">Controls</div>
        <div class="settings-row">
          <label>Mouse Aim</label>
          <div class="settings-toggle" data-setting="useMouseAim"></div>
        </div>
        <div class="settings-row">
          <label>Mouse Sensitivity</label>
          <input type="range" class="settings-slider" data-setting="mouseSensitivity"
            min="0.1" max="3.0" step="0.1">
        </div>
        <div class="settings-row">
          <label>Invert Y</label>
          <div class="settings-toggle" data-setting="invertY"></div>
        </div>
      </div>

      <div class="settings-section">
        <div class="settings-section-title">Gameplay</div>
        <div class="settings-row">
          <label>Difficulty</label>
          <div style="display:flex;gap:4px">
            <button class="settings-btn" data-diff="easy">EASY</button>
            <button class="settings-btn" data-diff="normal">NORM</button>
            <button class="settings-btn" data-diff="hard">HARD</button>
            <button class="settings-btn" data-diff="ace">ACE</button>
          </div>
        </div>
        <div class="settings-row">
          <label>Seeker Lock Time</label>
          <input type="range" class="settings-slider" data-setting="seekerDuration"
            min="5" max="15" step="1">
          <span class="debug-val" data-val="seekerDuration">8</span>
        </div>
        <div class="settings-hint" style="margin-top:2px;margin-bottom:8px">Difficulty applies on next respawn</div>
      </div>

      <div class="settings-section">
        <div class="settings-section-title">Debug</div>
        <div class="settings-row">
          <label>Debug Mode</label>
          <div class="settings-toggle" data-setting="debugMode"></div>
        </div>
        <div class="debug-sliders" id="debug-sliders" style="display:none">
          <div class="settings-section-title">Model Offsets</div>
          <div class="settings-row">
            <label>X</label>
            <input type="range" class="settings-slider" data-setting="modelOffsetX" min="-50" max="50" step="0.5">
            <span class="debug-val" data-val="modelOffsetX">0</span>
          </div>
          <div class="settings-row">
            <label>Y</label>
            <input type="range" class="settings-slider" data-setting="modelOffsetY" min="-50" max="50" step="0.5">
            <span class="debug-val" data-val="modelOffsetY">0</span>
          </div>
          <div class="settings-row">
            <label>Z</label>
            <input type="range" class="settings-slider" data-setting="modelOffsetZ" min="-50" max="50" step="0.5">
            <span class="debug-val" data-val="modelOffsetZ">0</span>
          </div>
          <div class="settings-section-title">Model Rotation</div>
          <div class="settings-row">
            <label>RX</label>
            <input type="range" class="settings-slider" data-setting="modelRotX" min="-6.28" max="6.28" step="0.01">
            <span class="debug-val" data-val="modelRotX">0</span>
          </div>
          <div class="settings-row">
            <label>RY</label>
            <input type="range" class="settings-slider" data-setting="modelRotY" min="-6.28" max="6.28" step="0.01">
            <span class="debug-val" data-val="modelRotY">0</span>
          </div>
          <div class="settings-row">
            <label>RZ</label>
            <input type="range" class="settings-slider" data-setting="modelRotZ" min="-6.28" max="6.28" step="0.01">
            <span class="debug-val" data-val="modelRotZ">0</span>
          </div>
        </div>
      </div>

      <div class="settings-hint">Press ESC to close</div>
    `;

    this.bindEvents();
    this.syncUI();
  }

  private bindEvents(): void {
    // Preset buttons
    this.container.querySelectorAll('[data-preset]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const preset = (btn as HTMLElement).dataset.preset as QualityPreset;
        this.settings = applyPreset(this.settings, preset);
        this.save();
        this.syncUI();
      });
    });

    // Difficulty buttons
    this.container.querySelectorAll('[data-diff]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.settings.difficulty = (btn as HTMLElement).dataset.diff as Settings['difficulty'];
        this.save();
        this.syncUI();
      });
    });

    // Toggles
    this.container.querySelectorAll('.settings-toggle').forEach((el) => {
      el.addEventListener('click', () => {
        const key = (el as HTMLElement).dataset.setting as keyof Settings;
        (this.settings as unknown as Record<string, unknown>)[key] = !(this.settings as unknown as Record<string, unknown>)[key];
        this.save();
        this.syncUI();
      });
    });

    // Sliders
    this.container.querySelectorAll('.settings-slider').forEach((el) => {
      el.addEventListener('input', () => {
        const key = (el as HTMLInputElement).dataset.setting as keyof Settings;
        const val = parseFloat((el as HTMLInputElement).value);
        (this.settings as unknown as Record<string, unknown>)[key] = val;
        this.save();
        // Update live value display
        const valEl = this.container.querySelector(`[data-val="${key}"]`) as HTMLElement | null;
        if (valEl) valEl.textContent = val.toFixed(2);
      });
    });
  }

  private syncUI(): void {
    // Preset buttons
    this.container.querySelectorAll('[data-preset]').forEach((btn) => {
      const preset = (btn as HTMLElement).dataset.preset;
      btn.classList.toggle('active', preset === this.settings.quality);
    });

    // Difficulty buttons
    this.container.querySelectorAll('[data-diff]').forEach((btn) => {
      const diff = (btn as HTMLElement).dataset.diff;
      btn.classList.toggle('active', diff === this.settings.difficulty);
    });

    // Toggles
    this.container.querySelectorAll('.settings-toggle').forEach((el) => {
      const key = (el as HTMLElement).dataset.setting as keyof Settings;
      el.classList.toggle('on', !!(this.settings as unknown as Record<string, unknown>)[key]);
    });

    // Sliders
    this.container.querySelectorAll('.settings-slider').forEach((el) => {
      const key = (el as HTMLInputElement).dataset.setting as keyof Settings;
      const val = (this.settings as unknown as Record<string, unknown>)[key] as number;
      (el as HTMLInputElement).value = String(val);
      // Sync value display
      const valEl = this.container.querySelector(`[data-val="${key}"]`) as HTMLElement | null;
      if (valEl) valEl.textContent = val.toFixed(2);
    });

    // Debug sliders visibility
    const debugSliders = this.container.querySelector('#debug-sliders') as HTMLElement;
    if (debugSliders) {
      debugSliders.style.display = this.settings.debugMode ? 'block' : 'none';
    }
  }

  private save(): void {
    saveSettings(this.settings);
    this.onChange(this.settings);
  }

  toggle(): void {
    this.visible = !this.visible;
    this.container.classList.toggle('open', this.visible);
  }

  isVisible(): boolean {
    return this.visible;
  }

  getSettings(): Settings {
    return this.settings;
  }
}
