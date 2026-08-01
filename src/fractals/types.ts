export type FractalId =
  | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14;

export interface FractalMeta {
  id: FractalId;
  slug: string;
  name: string;
  label: string;
  equation: string;
}

export interface CameraState {
  rotX: number;
  rotY: number;
  zoom: number;
  panX: number;
  panY: number;
  power: number;
  bailout: number;
  cx: number;
  cy: number;
  glow: number;
  bright: number;
}

/** Spherical orbit state — camera sweeps pole-to-pole around fractal origin. */
export interface OrbitSeeds {
  zoomPhase: number;
  zoomFreqA: number;
  zoomFreqB: number;
  zoomFreqC: number;
  azOffset: number;
  elPhase: number;
  azRateScale: number;
  elRateScale: number;
}

export interface CameraOrbit {
  rotX: number;
  rotY: number;
  zoom: number;
  panX: number;
  panY: number;
  /** Continuous azimuth integration for 360° spin. */
  azimuth: number;
  seeds: OrbitSeeds;
}

const DEFAULT_SEEDS: OrbitSeeds = {
  zoomPhase: 0,
  zoomFreqA: 0.04,
  zoomFreqB: 0.019,
  zoomFreqC: 0.011,
  azOffset: 0,
  elPhase: 0,
  azRateScale: 1,
  elRateScale: 1,
};

export const DEFAULT_ORBIT: CameraOrbit = {
  rotX: 0,
  rotY: 0,
  zoom: 0,
  panX: 0,
  panY: 0,
  azimuth: 0,
  seeds: { ...DEFAULT_SEEDS },
};

export function seedOrbit(orbit: CameraOrbit): void {
  orbit.seeds = {
    zoomPhase: Math.random() * Math.PI * 2,
    zoomFreqA: 0.03 + Math.random() * 0.06,
    zoomFreqB: 0.015 + Math.random() * 0.04,
    zoomFreqC: 0.01 + Math.random() * 0.03,
    azOffset: Math.random() * Math.PI * 2,
    elPhase: Math.random() * Math.PI * 2,
    azRateScale: 0.65 + Math.random() * 0.85,
    elRateScale: 0.55 + Math.random() * 1.0,
  };
}

export function resetOrbit(orbit: CameraOrbit): void {
  orbit.rotX = 0;
  orbit.rotY = 0;
  orbit.zoom = 0;
  orbit.panX = 0;
  orbit.panY = 0;
  orbit.azimuth = 0;
  seedOrbit(orbit);
}

export interface ExplorerRuntimeState {
  cur: CameraState;
  tgt: CameraState;
  evolvePhase: number;
  morphPhase: number;
  orbitPhase: number;
  orbit: CameraOrbit;
}

export const DEFAULT_CAMERA: CameraState = {
  rotX: 0.2,
  rotY: 0.0,
  zoom: 2.2,
  panX: 0,
  panY: 0,
  power: 8,
  bailout: 2,
  cx: -0.2,
  cy: 0.8,
  glow: 0.0,
  bright: 1.35,
};

export function createRuntimeState(): ExplorerRuntimeState {
  const orbit = { ...DEFAULT_ORBIT, seeds: { ...DEFAULT_ORBIT.seeds } };
  seedOrbit(orbit);
  return {
    cur: { ...DEFAULT_CAMERA },
    tgt: { ...DEFAULT_CAMERA },
    evolvePhase: 0,
    morphPhase: 0,
    orbitPhase: 0,
    orbit,
  };
}

export const PALETTE_COUNT = 8;

/**
 * Colour profiles — 5-stop Hermite RGB paths in footer.glsl paletteAt.
 * Swatches = start / mid / end of each continuous journey (must match shader stops).
 */
export const PALETTES = [
  { id: 0, name: 'Hyper Cyan', mood: 'Sci-fi', swatch: ['#00d4ff', '#a078ff', '#ff40d0'] },
  { id: 1, name: 'Alien Acid', mood: 'Toxic', swatch: ['#c44dff', '#ff993f', '#a8ff2e'] },
  { id: 2, name: 'Solar Flare', mood: 'Plasma', swatch: ['#ff1a00', '#ff991a', '#fff2b3'] },
  { id: 3, name: 'Nebula Bleed', mood: 'Arty', swatch: ['#6b30ff', '#ff3d99', '#ffb040'] },
  { id: 4, name: 'Aurora Drift', mood: 'Spectrum', swatch: ['#2eff8c', '#30e0ff', '#b040ff'] },
  { id: 5, name: 'Prism Slash', mood: 'Hard', swatch: ['#00e8ff', '#ffe021', '#ff2040'] },
  { id: 6, name: 'Void Orchid', mood: 'Lush', swatch: ['#d140ff', '#ff6090', '#ffbf30'] },
  { id: 7, name: 'Ice Phantom', mood: 'Cold', swatch: ['#3061ff', '#90d1ff', '#ebe0ff'] },
] as const;

export const PALETTE_NAMES = PALETTES.map((p) => p.name);

export type PaletteIdx = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

export function clampPaletteIdx(n: number): PaletteIdx {
  const i = Math.floor(Number.isFinite(n) ? n : 0) % PALETTE_COUNT;
  return ((i + PALETTE_COUNT) % PALETTE_COUNT) as PaletteIdx;
}

export type UiMode = 'express' | 'lab';

export type RemixMode = 'gentle' | 'wild';

export interface MacroState {
  pulse: number;
  depth: number;
  drift: number;
  void: number;
}

export interface AtmosphereState {
  fov: number;
  fog: number;
  gamma: number;
  vignette: number;
}

export interface ViewAnchor {
  rotX: number;
  rotY: number;
  panX: number;
  panY: number;
  zoom: number;
}

export const DEFAULT_VIEW_ANCHOR: ViewAnchor = {
  rotX: DEFAULT_CAMERA.rotX,
  rotY: DEFAULT_CAMERA.rotY,
  panX: DEFAULT_CAMERA.panX,
  panY: DEFAULT_CAMERA.panY,
  zoom: DEFAULT_CAMERA.zoom,
};

export const DEFAULT_MACROS: MacroState = {
  pulse: 0.5,
  depth: 0.5,
  drift: 0.5,
  void: 0.5,
};

export const DEFAULT_ATMOSPHERE: AtmosphereState = {
  fov: 1.5,
  fog: 0.7,
  gamma: 0.55,
  vignette: 1.0,
};
