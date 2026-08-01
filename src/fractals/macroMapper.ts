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

  // cx/cy: centred at 0 when all macros are at default (0.5).
  // pulse and drift each contribute a signed offset from 0.
  const cxRaw = (p - 0.5) * w.pulseWarpX * 2.0 + (dr - 0.5) * w.driftWarpX * 2.0;
  const cyRaw = (p - 0.5) * w.pulseWarpY * 2.0 + (dr - 0.5) * w.driftWarpY * 2.0;

  const camera: Partial<CameraState> = {
    power: lerp(3, 14, p * w.pulsePower + d * w.depthPower * 0.3),
    bailout: lerp(1.2, 5.5, p * w.pulseBailout + d * 0.2),
    bright: lerp(0.4, 2.5, p * w.pulseBright),
    cx: Math.max(-1.2, Math.min(1.2, cxRaw)),
    cy: Math.max(-1.2, Math.min(1.2, cyRaw)),
    glow: lerp(0, 1, dr * w.driftGlow + p * 0.3),
    zoom: lerp(1.5, 8, d * w.depthZoom + v * 0.2),
  };

  const atmosphere: AtmosphereState = {
    fov: lerp(1.0, 2.2, v * w.voidFov + 0.5 * (1 - v)),
    fog: lerp(0.25, 1.5, v * w.voidFog),
    gamma: lerp(0.45, 0.75, v * w.voidGamma),
    vignette: lerp(0.5, 1.8, v * w.voidVignette),
  };

  return { camera, atmosphere };
}

/** Build macro baseline from dials, preserving user-controlled view orientation. */
export function buildMacroBaseline(
  macros: MacroState,
  fractalId: FractalId,
  view: ViewAnchor,
): { baseline: CameraState; atmosphere: AtmosphereState } {
  const { camera, atmosphere } = applyMacros(macros, fractalId);
  const baseline: CameraState = {
    ...DEFAULT_CAMERA,
    ...camera,
    rotX: view.rotX,
    rotY: view.rotY,
    panX: view.panX,
    panY: view.panY,
    zoom: view.zoom,
  };
  return { baseline, atmosphere };
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
