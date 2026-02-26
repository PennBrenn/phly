const STORAGE_KEY = 'phly-settings';

export type QualityPreset = 'low' | 'medium' | 'high';

export interface Settings {
  quality: QualityPreset;
  shadows: boolean;
  bloom: boolean;
  fogDensity: number;
  mouseSensitivity: number;
  useMouseAim: boolean;
  treeDensity: number;
  debugMode: boolean;
  // Model debug offsets
  modelOffsetX: number;
  modelOffsetY: number;
  modelOffsetZ: number;
  modelRotX: number;
  modelRotY: number;
  modelRotZ: number;
}

const PRESETS: Record<QualityPreset, Partial<Settings>> = {
  low: {
    shadows: false,
    bloom: false,
    fogDensity: 0.00008,
  },
  medium: {
    shadows: true,
    bloom: false,
    fogDensity: 0.00005,
  },
  high: {
    shadows: true,
    bloom: true,
    fogDensity: 0.000025,
  },
};

function defaultSettings(): Settings {
  return {
    quality: 'high',
    shadows: true,
    bloom: true,
    fogDensity: 0.000025,
    mouseSensitivity: 1.0,
    useMouseAim: false,
    treeDensity: 0.7,
    debugMode: false,
    modelOffsetX: 0,
    modelOffsetY: 0,
    modelOffsetZ: 0,
    modelRotX: 0,
    modelRotY: 0,
    modelRotZ: 0,
  };
}

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return { ...defaultSettings(), ...JSON.parse(raw) };
    }
  } catch {
    // ignore parse errors
  }
  return defaultSettings();
}

export function saveSettings(s: Settings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

export function applyPreset(s: Settings, preset: QualityPreset): Settings {
  return { ...s, quality: preset, ...PRESETS[preset] };
}

export { PRESETS };
