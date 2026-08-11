import type {
  AtmosphereState,
  CameraState,
  FractalId,
  MacroState,
  ViewAnchor,
} from './types';
import { DEFAULT_CAMERA } from './types';
import { getInstrument } from './instruments';

function ease(t: number): number {
  return t * t * (3 - 2 * t);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export interface MacroResult {
  camera: Partial<CameraState>;
  atmosphere: AtmosphereState;
  /** Detail iters driven by Depth dial — applied by the store. */
  iters: number;
}

/** Map Depth dial → iteration count. Depth at 1.0 always hits max Detail (64). */
export function macrosToIters(depth: number, fractalId: FractalId): number {
  const w = getInstrument(fractalId).macroWeights.depthIters;
  const d = ease(depth);
  // Weight pulls mid-dial up/down; endpoints stay 8 ↔ 64
  const t = Math.min(1, Math.pow(d, 1 / Math.max(w, 0.5)));
  return Math.round(lerp(8, 64, t) / 2) * 2;
}

export function applyMacros(
  macros: MacroState,
  fractalId: FractalId,
): MacroResult {
  const inst = getInstrument(fractalId);
  const w = inst.macroWeights;
  const p = ease(macros.pulse);
  const d = ease(macros.depth);
  const dr = ease(macros.drift);
  const v = ease(macros.void);

  // Pulse = shape only (power + bailout + brightness). No warp.
  const powerT = Math.min(1, p * w.pulsePower);
  const bailT = Math.min(1, p * w.pulseBailout);

  // Drift = sole owner of phason/warp + colour shift
  const cxRaw = (dr - 0.5) * w.driftWarpX * 2.4;
  const cyRaw = (dr - 0.5) * w.driftWarpY * 2.4;

  const camera: Partial<CameraState> = {
    power: lerp(2.5, 14, powerT),
    bailout: lerp(1.15, 5.5, bailT),
    bright: lerp(0.45, 2.6, p * w.pulseBright),
    cx: Math.max(-1.2, Math.min(1.2, cxRaw)),
    cy: Math.max(-1.2, Math.min(1.2, cyRaw)),
    glow: lerp(0, 1, dr * w.driftGlow),
    // Zoom stays under view/orbit control — Depth no longer yanks framing
    zoom: lerp(1.5, 8, d * w.depthZoom + v * 0.15),
  };

/** Map Void dial — keep fog from ever crushing the scene to black. */
  const atmosphere: AtmosphereState = {
    fov: lerp(0.95, 2.0, v * w.voidFov),
    fog: lerp(0.15, 0.85, v * w.voidFog),
    gamma: lerp(0.45, 0.72, v * w.voidGamma),
    vignette: lerp(0.35, 1.4, v * w.voidVignette),
  };

  return {
    camera,
    atmosphere,
    iters: macrosToIters(macros.depth, fractalId),
  };
}

/** Build macro baseline from dials, preserving user-controlled view orientation. */
export function buildMacroBaseline(
  macros: MacroState,
  fractalId: FractalId,
  view: ViewAnchor,
): { baseline: CameraState; atmosphere: AtmosphereState; iters: number } {
  const { camera, atmosphere, iters } = applyMacros(macros, fractalId);
  const baseline: CameraState = {
    ...DEFAULT_CAMERA,
    ...camera,
    rotX: view.rotX,
    rotY: view.rotY,
    panX: view.panX,
    panY: view.panY,
    zoom: view.zoom,
  };
  return { baseline, atmosphere, iters };
}

export function applyMacrosToTarget(
  macros: MacroState,
  fractalId: FractalId,
  tgt: CameraState,
  preserveView = true,
): MacroResult {
  const result = applyMacros(macros, fractalId);
  const rotX = preserveView ? tgt.rotX : DEFAULT_CAMERA.rotX;
  const rotY = preserveView ? tgt.rotY : DEFAULT_CAMERA.rotY;
  const panX = preserveView ? tgt.panX : DEFAULT_CAMERA.panX;
  const panY = preserveView ? tgt.panY : DEFAULT_CAMERA.panY;
  // Keep fractal/snapshot framing — Depth must not yank zoom every Express frame
  const zoom = preserveView ? tgt.zoom : (result.camera.zoom ?? tgt.zoom);

  Object.assign(tgt, result.camera, { rotX, rotY, panX, panY, zoom });
  return result;
}
