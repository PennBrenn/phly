// Settings UI for PHLY
const SettingsUI = {
  render() {
    const container = document.getElementById('settings-content');
    if (!container) return;

    let html = '<h2>SETTINGS</h2>';
    html += '<button class="menu-btn" id="settings-back" style="margin-bottom:20px;width:auto;padding:10px 24px">BACK</button>';

    const settings = [
      { key: 'graphics', label: 'Graphics Preset', type: 'select', options: ['low', 'medium', 'high', 'ultra'] },
      { key: 'renderDistance', label: 'Render Distance', type: 'select', options: ['2', '3', '4', '5'] },
      { key: 'shadowQuality', label: 'Shadow Quality', type: 'select', options: ['off', 'low', 'medium', 'high'] },
      { key: 'treeDensity', label: 'Tree Density', type: 'range', min: 0, max: 1, step: 0.1 },
      { key: 'postProcessing', label: 'Post-Processing', type: 'select', options: ['off', 'low', 'full'] },
      { key: 'particleQuality', label: 'Particle Quality', type: 'select', options: ['low', 'medium', 'high'] },
      { key: 'dayNightSpeed', label: 'Day/Night Speed', type: 'select', options: ['off', 'slow', 'normal', 'fast'] },
      { key: 'cloudDensity', label: 'Cloud Density', type: 'range', min: 0, max: 1, step: 0.1 },
      { key: 'controlScheme', label: 'Control Scheme', type: 'select', options: ['mouse', 'wasd'] },
      { key: 'mouseSensitivity', label: 'Mouse Sensitivity', type: 'range', min: 0.1, max: 3, step: 0.1 },
      { key: 'invertPitch', label: 'Invert Pitch', type: 'select', options: ['false', 'true'] },
      { key: 'fov', label: 'FOV', type: 'range', min: 60, max: 110, step: 5 },
      { key: 'hudScale', label: 'HUD Scale', type: 'range', min: 0.5, max: 1.5, step: 0.1 },
      { key: 'speedUnits', label: 'Speed Units', type: 'select', options: ['kmh', 'mph', 'knots'] },
      { key: 'altitudeUnits', label: 'Altitude Units', type: 'select', options: ['metres', 'feet'] },
      { key: 'volumeMaster', label: 'Volume (Master)', type: 'range', min: 0, max: 1, step: 0.05 },
      { key: 'volumeSFX', label: 'Volume (SFX)', type: 'range', min: 0, max: 1, step: 0.05 },
      { key: 'volumeMusic', label: 'Volume (Music)', type: 'range', min: 0, max: 1, step: 0.05 },
      { key: 'showRepairPreview', label: 'Show Repair Preview', type: 'select', options: ['true', 'false'] },
      { key: 'networkDebug', label: 'Network Debug', type: 'select', options: ['false', 'true'] },
      { key: 'debugMode', label: '⚙ DEBUG MODE (Inf $, Stats)', type: 'select', options: ['false', 'true'] },
    ];

    for (const s of settings) {
      const val = GAME_SETTINGS[s.key];
      html += '<div class="setting-row">';
      html += `<label>${s.label}</label>`;
      html += '<div style="display:flex;align-items:center;gap:8px">';

      if (s.type === 'select') {
        html += `<select data-key="${s.key}">`;
        for (const opt of s.options) {
          const selected = String(val) === opt ? 'selected' : '';
          html += `<option value="${opt}" ${selected}>${opt.charAt(0).toUpperCase() + opt.slice(1)}</option>`;
        }
        html += '</select>';
      } else if (s.type === 'range') {
        html += `<input type="range" data-key="${s.key}" min="${s.min}" max="${s.max}" step="${s.step}" value="${val}">`;
        html += `<span class="setting-val" data-val-key="${s.key}">${val}</span>`;
      }

      html += '</div></div>';
    }

    // Reset save button
    html += '<div style="margin-top:30px;border-top:1px solid rgba(255,255,255,0.1);padding-top:20px">';
    html += '<button class="menu-btn" id="settings-reset-save" style="width:auto;padding:10px 24px;border-color:rgba(244,67,54,0.4);color:#f44336">RESET SAVE DATA</button>';
    html += '</div>';

    container.innerHTML = html;
    this._bindEvents();
  },

  _bindEvents() {
    // Back button
    const backBtn = document.getElementById('settings-back');
    if (backBtn) {
      backBtn.addEventListener('click', () => {
        MenuSystem.hideSettings();
      });
    }

    // Selects
    const selects = document.querySelectorAll('#settings-content select');
    selects.forEach(sel => {
      sel.addEventListener('change', () => {
        const key = sel.dataset.key;
        let val = sel.value;
        if (val === 'true') val = true;
        else if (val === 'false') val = false;
        else if (!isNaN(Number(val)) && key !== 'controlScheme' && key !== 'speedUnits' && key !== 'altitudeUnits') {
          val = Number(val);
        }
        GAME_SETTINGS[key] = val;
        this._applySetting(key, val);
        this._saveSettings();
      });
    });

    // Ranges
    const ranges = document.querySelectorAll('#settings-content input[type=range]');
    ranges.forEach(range => {
      range.addEventListener('input', () => {
        const key = range.dataset.key;
        const val = parseFloat(range.value);
        GAME_SETTINGS[key] = val;
        const valDisplay = document.querySelector(`[data-val-key="${key}"]`);
        if (valDisplay) valDisplay.textContent = val.toFixed(2);
        this._applySetting(key, val);
        this._saveSettings();
      });
    });

    // Reset save
    const resetBtn = document.getElementById('settings-reset-save');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        if (confirm('This will reset ALL save data including money, upgrades, and missions. Are you sure?')) {
          localStorage.removeItem('phly_save');
          localStorage.removeItem('phly_missions');
          localStorage.removeItem('phly_settings');
          location.reload();
        }
      });
    }
  },

  _applySetting(key, val) {
    switch (key) {
      case 'controlScheme':
        InputSystem.controlScheme = val;
        break;
      case 'mouseSensitivity':
        InputSystem.sensitivity = val;
        break;
      case 'invertPitch':
        InputSystem.invertPitch = val;
        break;
      case 'fov':
        if (window.Game && Game.camera) Game.camera.fov = val;
        if (window.Game && Game.camera) Game.camera.updateProjectionMatrix();
        break;
      case 'volumeMaster':
      case 'volumeSFX':
      case 'volumeMusic':
        if (window.AudioSystem) {
          AudioSystem.setVolumes(
            GAME_SETTINGS.volumeMaster,
            GAME_SETTINGS.volumeSFX,
            GAME_SETTINGS.volumeMusic
          );
        }
        break;
      case 'debugMode':
        if (val === true || val === 'true') {
          Economy.balance = 9999999;
          Economy.save();
          console.log('[PHLY][Debug] Infinite money enabled');
        }
        break;
    }
    console.log(`[PHLY][Settings] ${key} = ${val}`);
  },

  _saveSettings() {
    localStorage.setItem('phly_settings', JSON.stringify(GAME_SETTINGS));
  },

  loadSettings() {
    const saved = localStorage.getItem('phly_settings');
    if (saved) {
      try {
        const data = JSON.parse(saved);
        Object.assign(GAME_SETTINGS, data);
        console.log('[PHLY][Settings] Loaded saved settings');
      } catch (e) {
        console.warn('[PHLY][Settings] Failed to load settings');
      }
    }
  },
};

window.SettingsUI = SettingsUI;
console.log('[PHLY] Settings UI loaded');
