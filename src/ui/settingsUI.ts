import {
  type Settings,
  type QualityPreset,
  saveSettings,
  applyPreset,
} from '@/core/settings';

export interface DebugCallbacks {
  onUnlockAll: () => void;
  onResetProgress: () => void;
  onSkipMission: () => void;
}

export class SettingsUI {
  private container: HTMLDivElement;
  private visible = false;
  private settings: Settings;
  private onChange: (s: Settings) => void;
  private onClose: (() => void) | null = null;
  private debugCallbacks: DebugCallbacks | null = null;

  constructor(settings: Settings, onChange: (s: Settings) => void) {
    this.settings = settings;
    this.onChange = onChange;
    this.container = document.createElement('div');
    this.container.id = 'settings-panel';
    this.injectStyles();
    this.buildDOM();
    document.body.appendChild(this.container);
  }

  /** Register a callback for when the close button is clicked. */
  setOnClose(cb: () => void): void {
    this.onClose = cb;
  }

  /** Register debug action callbacks. */
  setDebugCallbacks(cb: DebugCallbacks): void {
    this.debugCallbacks = cb;
    this.bindDebugButtons();
  }

  private injectStyles(): void {
    const style = document.createElement('style');
    style.textContent = `
      #settings-panel {
        position: fixed; inset: 0;
        background: rgba(0,0,0,0.85);
        backdrop-filter: blur(8px);
        color: #fff;
        font-family: 'Courier New', monospace;
        font-size: 13px;
        z-index: 970;
        display: none;
        justify-content: center;
        align-items: flex-start;
        padding: 40px 20px;
        overflow-y: auto;
      }
      #settings-panel.open { display: flex; }
      .settings-inner {
        width: 100%; max-width: 480px;
        background: rgba(20,20,35,0.95);
        border: 1px solid rgba(255,255,255,0.1);
        border-radius: 8px;
        padding: 32px;
      }
      .settings-header {
        display: flex; justify-content: space-between; align-items: center;
        margin-bottom: 24px;
      }
      .settings-title { font-size: 20px; font-weight: bold; letter-spacing: 3px; }
      .settings-close {
        background: none; border: 1px solid rgba(255,255,255,0.2);
        color: #fff; font-size: 18px; width: 32px; height: 32px;
        cursor: pointer; border-radius: 4px; font-family: inherit;
        transition: all 0.15s;
      }
      .settings-close:hover { background: rgba(255,255,255,0.1); border-color: rgba(255,255,255,0.5); }
      .settings-section { margin-bottom: 20px; }
      .settings-section-title {
        font-size: 11px; opacity: 0.45; text-transform: uppercase;
        margin-bottom: 10px; letter-spacing: 1.5px;
        border-bottom: 1px solid rgba(255,255,255,0.06);
        padding-bottom: 6px;
      }
      .settings-row {
        display: flex; justify-content: space-between; align-items: center;
        margin-bottom: 10px; min-height: 28px;
      }
      .settings-row label { flex: 1; opacity: 0.85; }
      .settings-btn {
        background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.15);
        color: #fff; padding: 5px 14px; cursor: pointer; font-family: inherit; font-size: 12px;
        margin-left: 4px; border-radius: 3px; transition: all 0.15s;
      }
      .settings-btn.active { background: rgba(100,160,255,0.25); border-color: rgba(100,160,255,0.6); color: #aad4ff; }
      .settings-btn:hover { background: rgba(255,255,255,0.12); }
      .settings-toggle {
        width: 38px; height: 20px; border-radius: 10px;
        background: rgba(255,255,255,0.15); cursor: pointer;
        position: relative; transition: background 0.2s;
        flex-shrink: 0;
      }
      .settings-toggle.on { background: rgba(100,160,255,0.5); }
      .settings-toggle::after {
        content: ''; position: absolute; top: 3px; left: 3px;
        width: 14px; height: 14px; border-radius: 50%;
        background: #fff; transition: left 0.2s;
      }
      .settings-toggle.on::after { left: 21px; }
      .settings-slider {
        width: 130px; accent-color: #6090cc;
      }
      .settings-hint { font-size: 11px; opacity: 0.25; margin-top: 4px; margin-bottom: 10px; }
      .debug-sliders { margin-top: 8px; }
      .debug-sliders .settings-row { margin-bottom: 4px; }
      .debug-sliders label { font-size: 11px; }
      .debug-val { font-size: 11px; min-width: 42px; text-align: right; opacity: 0.7; margin-left: 6px; }
    `;
    document.head.appendChild(style);
  }

  private buildDOM(): void {
    this.container.innerHTML = `
      <div class="settings-inner">
        <div class="settings-header">
          <div class="settings-title">SETTINGS</div>
          <button class="settings-close" id="settings-close-btn">&times;</button>
        </div>

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
            <label>God Rays</label>
            <div class="settings-toggle" data-setting="godRays"></div>
          </div>
          <div class="settings-row">
            <label>Chromatic Aberration</label>
            <div class="settings-toggle" data-setting="chromaticAberration"></div>
          </div>
          <div class="settings-row">
            <label>Vignette</label>
            <div class="settings-toggle" data-setting="vignette"></div>
          </div>
          <div class="settings-row">
            <label>FXAA</label>
            <div class="settings-toggle" data-setting="fxaa"></div>
          </div>
          <div class="settings-row">
            <label>Fog Density</label>
            <input type="range" class="settings-slider" data-setting="fogDensity"
              min="0.000005" max="0.00015" step="0.000005">
          </div>
          <div class="settings-row">
            <label>Tree Density</label>
            <input type="range" class="settings-slider" data-setting="treeDensity"
              min="0" max="2" step="0.05">
            <span class="debug-val" data-val="treeDensity">0.70</span>
          </div>
          <div class="settings-hint">Tree density applies on reload (max 2x = ~5000 trees)</div>
          <div class="settings-row">
            <label>Cloud Density</label>
            <input type="range" class="settings-slider" data-setting="cloudDensity"
              min="0" max="1" step="0.05">
            <span class="debug-val" data-val="cloudDensity">0.50</span>
          </div>
          <div class="settings-hint">Cloud density updates in real-time</div>
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
            <label>Seeker Window</label>
            <input type="range" class="settings-slider" data-setting="seekerDuration"
              min="5" max="15" step="1">
            <span class="debug-val" data-val="seekerDuration">8</span>
          </div>
          <div class="settings-hint">Difficulty applies on next respawn</div>
        </div>

        <div class="settings-section">
          <div class="settings-section-title">Data Management</div>
          <div class="settings-row">
            <button class="settings-btn" id="settings-export-data" style="flex:1">Export Save Data</button>
          </div>
          <div class="settings-row">
            <button class="settings-btn" id="settings-import-data" style="flex:1">Import Save Data</button>
            <input type="file" id="settings-import-file" accept=".phly" style="display:none">
          </div>
          <div class="settings-hint">Export creates an encrypted .phly file. Import will overwrite all current data.</div>
          <div class="settings-row">
            <button class="settings-btn" id="settings-reset-all" style="flex:1;border-color:rgba(255,80,80,0.4);color:rgba(255,120,120,0.9)">Reset All Data</button>
          </div>
          <div class="settings-hint">Permanently deletes all progress, credits, and settings.</div>
        </div>

        <div class="settings-section">
          <div class="settings-section-title">Debug</div>
          <div class="settings-row">
            <label>Debug Mode</label>
            <div class="settings-toggle" data-setting="debugMode" id="debug-mode-toggle"></div>
          </div>
          <div class="settings-hint" id="debug-hint" style="display:none;color:#ff8866">Warning: Disabling debug mode will clear all save data!</div>
          <div class="debug-sliders" id="debug-sliders" style="display:none">
            <div class="settings-section-title">Cheats</div>
            <div class="settings-row">
              <label>Inf Credits</label>
              <div class="settings-toggle" data-setting="cheatInfCredits"></div>
            </div>
            <div class="settings-row">
              <label>God Mode</label>
              <div class="settings-toggle" data-setting="cheatGodMode"></div>
            </div>
            <div class="settings-row">
              <label>Unlock All</label>
              <button class="settings-btn" id="dbg-unlock-all">UNLOCK</button>
            </div>
            <div class="settings-row">
              <label>Reset Progress</label>
              <button class="settings-btn" id="dbg-reset-progress" style="border-color:rgba(255,80,80,0.4);color:rgba(255,120,120,0.9)">RESET</button>
            </div>
            <div class="settings-row">
              <label>Skip Mission</label>
              <button class="settings-btn" id="dbg-skip-mission">SKIP</button>
            </div>
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
      </div>
    `;

    // Close button
    this.container.querySelector('#settings-close-btn')!.addEventListener('click', () => {
      this.hide();
      if (this.onClose) this.onClose();
    });

    // Click outside inner to close
    this.container.addEventListener('click', (e) => {
      if (e.target === this.container) {
        this.hide();
        if (this.onClose) this.onClose();
      }
    });

    this.bindEvents();
    this.bindDataManagement();
    this.bindDebugModeToggle();
    this.syncUI();
  }

  private bindDataManagement(): void {
    // Export
    this.container.querySelector('#settings-export-data')?.addEventListener('click', () => {
      const data: Record<string, string | null> = {};
      const keys = ['phly-settings', 'phly-economy', 'phly-upgrades', 'phly-progress', 'phly-username'];
      for (const k of keys) data[k] = localStorage.getItem(k);
      const json = JSON.stringify(data);
      // Simple XOR-based obfuscation (not crypto-strength, but prevents casual editing)
      const key = 'PHLY2026';
      let encoded = '';
      for (let i = 0; i < json.length; i++) {
        encoded += String.fromCharCode(json.charCodeAt(i) ^ key.charCodeAt(i % key.length));
      }
      const blob = new Blob([btoa(encoded)], { type: 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `phly-save-${Date.now()}.phly`;
      a.click();
      URL.revokeObjectURL(url);
    });

    // Import
    const fileInput = this.container.querySelector('#settings-import-file') as HTMLInputElement;
    this.container.querySelector('#settings-import-data')?.addEventListener('click', () => {
      fileInput?.click();
    });
    fileInput?.addEventListener('change', () => {
      const file = fileInput.files?.[0];
      if (!file) return;
      if (!confirm('This will OVERWRITE all your current save data. Continue?')) {
        fileInput.value = '';
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const raw = atob(reader.result as string);
          const key = 'PHLY2026';
          let decoded = '';
          for (let i = 0; i < raw.length; i++) {
            decoded += String.fromCharCode(raw.charCodeAt(i) ^ key.charCodeAt(i % key.length));
          }
          const data = JSON.parse(decoded) as Record<string, string | null>;
          for (const [k, v] of Object.entries(data)) {
            if (v !== null) localStorage.setItem(k, v);
            else localStorage.removeItem(k);
          }
          alert('Save data imported! The page will now reload.');
          window.location.reload();
        } catch {
          alert('Failed to import save data. The file may be corrupted.');
        }
        fileInput.value = '';
      };
      reader.readAsText(file);
    });

    // Reset all
    this.container.querySelector('#settings-reset-all')?.addEventListener('click', () => {
      if (!confirm('This will permanently DELETE all progress, credits, unlocks, and settings. Are you sure?')) return;
      if (!confirm('Are you really sure? This cannot be undone!')) return;
      localStorage.removeItem('phly-settings');
      localStorage.removeItem('phly-economy');
      localStorage.removeItem('phly-upgrades');
      localStorage.removeItem('phly-progress');
      localStorage.removeItem('phly-username');
      window.location.reload();
    });
  }

  private bindDebugModeToggle(): void {
    const toggle = this.container.querySelector('#debug-mode-toggle');
    const hint = this.container.querySelector('#debug-hint') as HTMLElement;
    if (!toggle || !hint) return;

    // Override the generic toggle handler for debugMode specifically
    toggle.addEventListener('click', (e) => {
      e.stopPropagation(); // prevent the generic toggle handler
      if (this.settings.debugMode) {
        // Turning OFF debug mode — warn and clear data
        if (!confirm('Disabling debug mode will CLEAR ALL save data (progress, credits, unlocks). Continue?')) return;
        this.settings.debugMode = false;
        this.save();
        localStorage.removeItem('phly-economy');
        localStorage.removeItem('phly-upgrades');
        localStorage.removeItem('phly-progress');
        window.location.reload();
      } else {
        // Turning ON debug mode
        this.settings.debugMode = true;
        this.save();
        this.syncUI();
      }
    }, true); // capture phase to fire before the generic handler

    // Show warning hint when debug mode is on
    if (this.settings.debugMode) hint.style.display = 'block';
  }

  private bindDebugButtons(): void {
    const btnUnlock = this.container.querySelector('#dbg-unlock-all');
    btnUnlock?.addEventListener('click', () => {
      this.debugCallbacks?.onUnlockAll();
    });
    const btnReset = this.container.querySelector('#dbg-reset-progress');
    btnReset?.addEventListener('click', () => {
      if (confirm('Reset ALL progress and credits?')) {
        this.debugCallbacks?.onResetProgress();
      }
    });
    const btnSkip = this.container.querySelector('#dbg-skip-mission');
    btnSkip?.addEventListener('click', () => {
      this.debugCallbacks?.onSkipMission();
      this.hide();
      if (this.onClose) this.onClose();
    });
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
    const debugHint = this.container.querySelector('#debug-hint') as HTMLElement;
    if (debugHint) {
      debugHint.style.display = this.settings.debugMode ? 'block' : 'none';
    }
  }

  private save(): void {
    saveSettings(this.settings);
    this.onChange(this.settings);
  }

  show(): void {
    this.visible = true;
    this.container.classList.add('open');
    this.syncUI();
  }

  hide(): void {
    this.visible = false;
    this.container.classList.remove('open');
  }

  toggle(): void {
    if (this.visible) this.hide();
    else this.show();
  }

  isVisible(): boolean {
    return this.visible;
  }

  getSettings(): Settings {
    return this.settings;
  }
}
