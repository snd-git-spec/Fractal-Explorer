import type { MacroState, PaletteIdx, RemixMode } from './types';
import { PALETTE_COUNT } from './types';
import { getInstrument } from './instruments';
import { applyMacrosToTarget } from './macroMapper';
import type { ExplorerStore } from '@/state/ExplorerStore';

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function pickPalette(): PaletteIdx {
  return Math.floor(Math.random() * PALETTE_COUNT) as PaletteIdx;
}

export function remixState(
  getState: () => ExplorerStore,
  setState: (partial: Partial<ExplorerStore>) => void,
  mode: RemixMode,
): void {
  const state = getState();
  const inst = getInstrument(state.fractalId);
  const ranges = inst.remixRanges;
  const spread = mode === 'wild' ? 1.0 : 0.55;

  const lerpRange = ([lo, hi]: [number, number]) => {
    const mid = (lo + hi) / 2;
    const half = ((hi - lo) / 2) * spread;
    return rand(mid - half, mid + half);
  };

  const macros: MacroState = {
    pulse: lerpRange(ranges.pulse),
    depth: lerpRange(ranges.depth),
    drift: lerpRange(ranges.drift),
    void: lerpRange(ranges.void),
  };

  const runtime = state.runtime;
  if (!state.lockViewOnRemix) {
    runtime.tgt.rotX = rand(-0.8, 0.8);
    runtime.tgt.rotY = rand(-1.5, 1.5);
    runtime.tgt.zoom = rand(2, 7);
  }

  const result = applyMacrosToTarget(macros, state.fractalId, runtime.tgt, state.lockViewOnRemix);

  setState({
    macros,
    atmosphere: result.atmosphere,
    paletteIdx: pickPalette(),
    macroBaseline: { ...runtime.tgt },
    snapshotLerpBoost: true,
  });
}
