const STORAGE_KEY = 'phly-settings';

export type QualityPreset = 'low' | 'medium' | 'high';

export type DifficultyLevel = 'easy' | 'normal' | 'hard' | 'ace';

export interface Settings {
  // Graphics
  quality: QualityPreset;
  shadows: boolean;
  bloom: boolean;
  godRays: boolean;
  chromaticAberration: boolean;
  vignette: boolean;
  fxaa: boolean;
  fogDensity: number;
  treeDensity: number;
  showFPS: boolean;
  // Controls
  mouseSensitivity: number;
  useMouseAim: boolean;
  invertY: boolean;
  // Gameplay
  difficulty: DifficultyLevel;
  seekerDuration: number; // seconds to lock (5-15)
  // Debug
  debugMode: boolean;
  cheatInfCredits: boolean;
  cheatGodMode: boolean;
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
    godRays: false,
    chromaticAberration: false,
    vignette: true,
    fxaa: false,
    fogDensity: 0.00008,
  },
  medium: {
    shadows: true,
    bloom: false,
    godRays: true,
    chromaticAberration: false,
    vignette: true,
    fxaa: true,
    fogDensity: 0.00005,
  },
  high: {
    shadows: true,
    bloom: true,
    godRays: true,
    chromaticAberration: true,
    vignette: true,
    fxaa: true,
    fogDensity: 0.000025,
  },
};

function defaultSettings(): Settings {
  return {
    quality: 'high',
    shadows: true,
    bloom: true,
    godRays: true,
    chromaticAberration: true,
    vignette: true,
    fxaa: true,
    fogDensity: 0.000025,
    treeDensity: 0.7,
    showFPS: false,
    mouseSensitivity: 1.0,
    useMouseAim: false,
    invertY: false,
    difficulty: 'normal',
    seekerDuration: 8,
    debugMode: false,
    cheatInfCredits: false,
    cheatGodMode: false,
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
