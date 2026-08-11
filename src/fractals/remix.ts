import type { AtmosphereState, MacroState, PaletteIdx, RemixMode } from './types';
import { PALETTE_COUNT, resetOrbit } from './types';
import { getInstrument } from './instruments';
import { applyMacrosToTarget } from './macroMapper';
import type { ExplorerStore } from '@/state/ExplorerStore';

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function pickPalette(): PaletteIdx {
  return Math.floor(Math.random() * PALETTE_COUNT) as PaletteIdx;
}

function wildAtmosphere(from: AtmosphereState): AtmosphereState {
  return {
    fov: clamp(from.fov + rand(-0.35, 0.45), 1.15, 1.95),
    fog: clamp(from.fog + rand(-0.2, 0.25), 0.15, 0.65),
    gamma: clamp(from.gamma + rand(-0.12, 0.12), 0.45, 0.75),
    vignette: clamp(from.vignette + rand(-0.35, 0.4), 0.4, 1.25),
  };
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

export function remixState(
  getState: () => ExplorerStore,
  setState: (partial: Partial<ExplorerStore>) => void,
  mode: RemixMode,
): void {
  const state = getState();
  const wild = mode === 'wild';
  const inst = getInstrument(state.fractalId);
  const ranges = inst.remixRanges;
  const runtime = state.runtime;

  const pickMacro = ([lo, hi]: [number, number]) => {
    if (wild) return rand(0.08, 0.95);
    const mid = (lo + hi) / 2;
    const half = ((hi - lo) / 2) * 0.55;
    return rand(mid - half, mid + half);
  };

  const macros: MacroState = {
    pulse: pickMacro(ranges.pulse),
    depth: pickMacro(ranges.depth),
    drift: pickMacro(ranges.drift),
    void: pickMacro(ranges.void),
  };

  const freeView = wild || !state.lockViewOnRemix;
  if (freeView) {
    runtime.tgt.rotX = rand(-0.95, 0.95);
    runtime.tgt.rotY = rand(-Math.PI, Math.PI);
    const z0 = Math.max(0.6, state.viewAnchor.zoom || runtime.tgt.zoom || 2.5);
    runtime.tgt.zoom = wild
      ? rand(Math.max(0.45, z0 * 0.45), Math.min(10, z0 * 1.35 + 2.5))
      : rand(2, 7);
    runtime.tgt.panX = wild ? rand(-0.15, 0.15) : 0;
    runtime.tgt.panY = wild ? rand(-0.1, 0.1) : 0;
  }

  const result = applyMacrosToTarget(macros, state.fractalId, runtime.tgt, !freeView);

  if (wild) {
    runtime.tgt.power = rand(3.2, 14.5);
    runtime.tgt.bailout = rand(1.15, 5.6);
    runtime.tgt.cx = rand(-1.25, 1.25);
    runtime.tgt.cy = rand(-1.25, 1.25);
    // Push hue a long way from current so the fade reads as a tour, not a blink
    const dir = Math.random() > 0.5 ? 1 : -1;
    runtime.tgt.glow = Math.max(
      -0.05,
      Math.min(1.55, runtime.cur.glow + dir * rand(0.65, 1.25)),
    );
    runtime.tgt.bright = Math.max(
      0.75,
      Math.min(2.5, runtime.cur.bright + rand(-0.55, 0.7)),
    );

    // New camera path — don't scramble colour/morph clocks (that hard-cuts hue)
    resetOrbit(runtime.orbit);
    runtime.orbitPhase = rand(0, 20);
  }

  // Snap structure / camera instantly…
  const keepGlow = runtime.cur.glow;
  const keepBright = runtime.cur.bright;
  Object.assign(runtime.cur, runtime.tgt);
  if (wild) {
    // …but leave colour behind so glow/bright lerp → fade through hues
    runtime.cur.glow = keepGlow;
    runtime.cur.bright = keepBright;
  }

  const atmosphere = wild ? wildAtmosphere(state.atmosphere) : result.atmosphere;
  if (wild) {
    Object.assign(state.atmosphereBaseline, atmosphere);
  }

  const viewAnchor = freeView
    ? {
        rotX: runtime.tgt.rotX,
        rotY: runtime.tgt.rotY,
        panX: runtime.tgt.panX,
        panY: runtime.tgt.panY,
        zoom: runtime.tgt.zoom,
      }
    : state.viewAnchor;

  if (freeView) {
    Object.assign(state.viewAnchor, viewAnchor);
  }

  setState({
    macros,
    atmosphere,
    atmosphereBaseline: wild ? { ...atmosphere } : state.atmosphereBaseline,
    // Gentle may jump palette; Wild fades colour via glow instead of a hard swap
    paletteIdx: wild ? state.paletteIdx : pickPalette(),
    macroBaseline: { ...runtime.tgt },
    viewAnchor: { ...viewAnchor },
    snapshotLerpBoost: true,
    iters: result.iters,
  });
}
