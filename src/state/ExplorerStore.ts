import { create } from 'zustand';
import { applyFractalPreset, snapCameraToView } from '@/fractals/presets';
import { applyMacrosToTarget, buildMacroBaseline } from '@/fractals/macroMapper';
import { getSnapshots, type FractalSnapshot } from '@/fractals/instruments';
import { getFractalSlug } from '@/fractals/registry';
import { remixState } from '@/fractals/remix';
import { decodeSeed, encodeSeed, getSeedFromUrl, setSeedInUrl } from '@/fractals/seeds';
import {
  startCanvasRecording,
  stopCanvasRecording,
} from '@/recorder/fractalRecorder';
import {
  createRuntimeState,
  DEFAULT_ATMOSPHERE,
  DEFAULT_CAMERA,
  DEFAULT_MACROS,
  DEFAULT_VIEW_ANCHOR,
  resetOrbit,
  type AtmosphereState,
  type CameraState,
  type ExplorerRuntimeState,
  type FractalId,
  type MacroState,
  type PaletteIdx,
  type RemixMode,
  type UiMode,
  type ViewAnchor,
  clampPaletteIdx,
} from '@/fractals/types';

export interface ExplorerStore {
  fractalId: FractalId;
  paletteIdx: PaletteIdx;
  autoEvolve: boolean;
  uiVisible: boolean;
  uiMode: UiMode;
  /** Whether the Express/Lab controls rail is open (toggle via EX/LAB buttons). */
  controlsOpen: boolean;
  iters: number;
  evolveSpeed: number;
  fps: string;
  macros: MacroState;
  atmosphere: AtmosphereState;
  atmosphereBaseline: AtmosphereState;
  macroBaseline: CameraState;
  viewAnchor: ViewAnchor;
  lockViewOnRemix: boolean;
  snapshotLerpBoost: boolean;
  isRecording: boolean;
  /** uiVisible value to restore after recording stops */
  uiVisibleBeforeRecord: boolean;
  runtime: ExplorerRuntimeState;
  setFractalId: (id: FractalId) => void;
  setPaletteIdx: (idx: PaletteIdx) => void;
  cyclePalette: () => void;
  setAutoEvolve: (v: boolean) => void;
  setUiVisible: (v: boolean) => void;
  toggleUiVisible: () => void;
  setUiMode: (mode: UiMode) => void;
  toggleUiMode: () => void;
  /** Open a mode, or close if that mode is already open. */
  toggleControlsMode: (mode: UiMode) => void;
  setControlsOpen: (open: boolean) => void;
  setIters: (v: number) => void;
  setEvolveSpeed: (v: number) => void;
  setFps: (fps: string) => void;
  setMacro: (key: keyof MacroState, value: number) => void;
  setMacros: (macros: MacroState) => void;
  syncMacrosFromCamera: () => void;
  setTargetParam: <K extends keyof CameraState>(key: K, value: CameraState[K]) => void;
  applySnapshot: (name: string) => void;
  remix: (mode: RemixMode) => void;
  toggleLockView: () => void;
  getSeed: () => string;
  copySeed: () => void;
  loadSeed: (seed: string) => boolean;
  loadSeedFromUrl: () => boolean;
  clearSnapshotLerpBoost: () => void;
  refreshMacroBaseline: () => void;
  setViewAnchor: (view: Partial<ViewAnchor>) => void;
  startRecording: () => void;
  stopRecording: () => void;
  getRuntime: () => ExplorerRuntimeState;
  getMacroBaseline: () => CameraState;
  getAtmosphereBaseline: () => AtmosphereState;
}

function applySnapshotToState(
  snapshot: FractalSnapshot,
  get: () => ExplorerStore,
  set: (partial: Partial<ExplorerStore>) => void,
): void {
  const runtime = get().runtime;

  // Fresh orbit/morph so snapshot pose is visible before evolve continues
  resetOrbit(runtime.orbit);
  runtime.orbitPhase = 0;
  runtime.morphPhase = 0;
  runtime.evolvePhase = 0;

  set({ macros: { ...snapshot.macros } });
  const result = applyMacrosToTarget(snapshot.macros, get().fractalId, runtime.tgt, true);

  if (snapshot.camera) {
    Object.assign(runtime.tgt, snapshot.camera);
    const anchor = get().viewAnchor;
    if (snapshot.camera.zoom !== undefined) anchor.zoom = snapshot.camera.zoom;
    if (snapshot.camera.rotX !== undefined) anchor.rotX = snapshot.camera.rotX;
    if (snapshot.camera.rotY !== undefined) anchor.rotY = snapshot.camera.rotY;
    if (snapshot.camera.panX !== undefined) anchor.panX = snapshot.camera.panX;
    if (snapshot.camera.panY !== undefined) anchor.panY = snapshot.camera.panY;
  }

  // Instant snap so snapshot framing is visible immediately
  Object.assign(runtime.cur, runtime.tgt);

  const atmosphere = snapshot.atmosphere
    ? { ...get().atmosphere, ...snapshot.atmosphere }
    : result.atmosphere;

  Object.assign(get().atmosphereBaseline, atmosphere);

  set({
    atmosphere,
    atmosphereBaseline: { ...atmosphere },
    paletteIdx: snapshot.palette ?? get().paletteIdx,
    macroBaseline: { ...runtime.tgt },
    snapshotLerpBoost: true,
  });
}

export const useExplorerStore = create<ExplorerStore>((set, get) => ({
  fractalId: 0,
  paletteIdx: 8,
  autoEvolve: true,
  uiVisible: true,
  uiMode: 'express',
  controlsOpen: false,
  iters: 64,
  evolveSpeed: 0.3,
  fps: '--',
  macros: { ...DEFAULT_MACROS },
  atmosphere: { ...DEFAULT_ATMOSPHERE },
  atmosphereBaseline: { ...DEFAULT_ATMOSPHERE },
  macroBaseline: { ...DEFAULT_CAMERA },
  viewAnchor: { ...DEFAULT_VIEW_ANCHOR },
  lockViewOnRemix: true,
  snapshotLerpBoost: false,
  isRecording: false,
  uiVisibleBeforeRecord: true,
  runtime: createRuntimeState(),

  setFractalId: (id) => {
    const runtime = get().runtime;
    resetOrbit(runtime.orbit);
    runtime.evolvePhase = 0;
    runtime.morphPhase = 0;
    runtime.orbitPhase = 0;

    const view = applyFractalPreset(runtime.tgt, id);
    const result = applyMacrosToTarget(get().macros, id, runtime.tgt, true);
    // Macros include a zoom channel — restore fractal framing so presets stick
    snapCameraToView(runtime.tgt, view);
    // Snap ALL params instantly — leftover evolve power/warp makes new fractals unreadable
    Object.assign(runtime.cur, runtime.tgt);

    Object.assign(get().atmosphereBaseline, result.atmosphere);

    // Mutate existing baseline in place first so any in-flight evolve frame
    // that already grabbed the reference picks up the new framing
    const prevBaseline = get().macroBaseline;
    Object.assign(prevBaseline, runtime.tgt);
    prevBaseline.zoom = view.zoom;
    prevBaseline.rotX = view.rotX;
    prevBaseline.rotY = view.rotY;
    prevBaseline.panX = 0;
    prevBaseline.panY = 0;
    runtime.tgt.zoom = view.zoom;
    runtime.cur.zoom = view.zoom;

    const anchor = { ...view };
    set({
      fractalId: id,
      atmosphere: result.atmosphere,
      viewAnchor: anchor,
      macroBaseline: { ...prevBaseline },
    });
  },

  setPaletteIdx: (idx) => set({ paletteIdx: clampPaletteIdx(idx) }),
  cyclePalette: () =>
    set((s) => ({ paletteIdx: clampPaletteIdx(s.paletteIdx + 1) })),

  setAutoEvolve: (v) => {
    const runtime = get().runtime;
    if (v) {
      // Resume from current view — no phase reset, no snap to collapsed params.
      const cur = runtime.cur;
      const baseline = { ...get().macroBaseline };
      Object.assign(baseline, {
        rotX: cur.rotX,
        rotY: cur.rotY,
        zoom: cur.zoom,
        panX: 0,
        panY: 0,
        power: cur.power,
        bailout: cur.bailout,
        cx: cur.cx,
        cy: cur.cy,
        glow: cur.glow,
        bright: cur.bright,
      });
      Object.assign(get().viewAnchor, {
        rotX: cur.rotX,
        rotY: cur.rotY,
        zoom: cur.zoom,
        panX: 0,
        panY: 0,
      });
      Object.assign(runtime.tgt, cur);
      set({ macroBaseline: baseline, autoEvolve: v });
    } else {
      set({ atmosphere: { ...get().atmosphereBaseline }, autoEvolve: v });
    }
  },

  setUiVisible: (v) => set({ uiVisible: v }),
  toggleUiVisible: () => set((s) => ({ uiVisible: !s.uiVisible })),
  setUiMode: (mode) => set({ uiMode: mode, controlsOpen: true }),
  toggleUiMode: () =>
    set((s) => ({
      uiMode: s.uiMode === 'express' ? 'lab' : 'express',
      controlsOpen: true,
    })),
  toggleControlsMode: (mode) =>
    set((s) => {
      if (s.controlsOpen && s.uiMode === mode) {
        return { controlsOpen: false };
      }
      return { uiMode: mode, controlsOpen: true };
    }),
  setControlsOpen: (open) => set({ controlsOpen: open }),

  setIters: (v) => set({ iters: v }),

  setEvolveSpeed: (v) => set({ evolveSpeed: v }),

  setFps: (fps) => set({ fps }),

  setMacro: (key, value) => {
    const macros = { ...get().macros, [key]: value };
    const view = get().viewAnchor;
    const { baseline, atmosphere } = buildMacroBaseline(macros, get().fractalId, view);

    if (get().autoEvolve) {
      set({ macros, macroBaseline: baseline });
      Object.assign(get().atmosphereBaseline, atmosphere);
      // Snap cur + tgt to new baseline immediately so the effect is visible at once
      // rather than waiting 5+ seconds for the slow TAU lerp to catch up.
      const snap = {
        power: baseline.power,
        bailout: baseline.bailout,
        cx: baseline.cx,
        cy: baseline.cy,
        glow: baseline.glow,
        bright: baseline.bright,
      };
      Object.assign(get().runtime.tgt, snap);
      Object.assign(get().runtime.cur, snap);
    } else {
      const result = applyMacrosToTarget(macros, get().fractalId, get().runtime.tgt, true);
      set({ macros, atmosphere: result.atmosphere, macroBaseline: { ...get().runtime.tgt } });
    }
  },

  setMacros: (macros) => {
    const view = get().viewAnchor;
    const { baseline, atmosphere } = buildMacroBaseline(macros, get().fractalId, view);

    if (get().autoEvolve) {
      set({ macros, macroBaseline: baseline });
      Object.assign(get().atmosphereBaseline, atmosphere);
      const snap = {
        power: baseline.power,
        bailout: baseline.bailout,
        cx: baseline.cx,
        cy: baseline.cy,
        glow: baseline.glow,
        bright: baseline.bright,
      };
      Object.assign(get().runtime.tgt, snap);
      Object.assign(get().runtime.cur, snap);
    } else {
      const result = applyMacrosToTarget(macros, get().fractalId, get().runtime.tgt, true);
      set({ macros, atmosphere: result.atmosphere, macroBaseline: { ...get().runtime.tgt } });
    }
  },

  refreshMacroBaseline: () => {
    const { baseline, atmosphere } = buildMacroBaseline(
      get().macros,
      get().fractalId,
      get().viewAnchor,
    );
    Object.assign(get().macroBaseline, baseline);
    Object.assign(get().atmosphereBaseline, atmosphere);
    if (!get().autoEvolve) {
      set({ atmosphere });
    }
  },

  setViewAnchor: (view) => {
    Object.assign(get().viewAnchor, view);
    const anchor = get().viewAnchor;
    const baseline = get().macroBaseline;
    // Only reseed orbit when orientation/pan changes — zoom tweaks must not jerk the path
    const orientationChange =
      view.rotX !== undefined ||
      view.rotY !== undefined ||
      view.panX !== undefined ||
      view.panY !== undefined;
    if (orientationChange) resetOrbit(get().runtime.orbit);
    if (view.rotX !== undefined) baseline.rotX = anchor.rotX;
    if (view.rotY !== undefined) baseline.rotY = anchor.rotY;
    if (view.panX !== undefined) baseline.panX = anchor.panX;
    if (view.panY !== undefined) baseline.panY = anchor.panY;
    if (view.zoom !== undefined) {
      baseline.zoom = anchor.zoom;
      get().runtime.tgt.zoom = anchor.zoom;
      get().runtime.cur.zoom = anchor.zoom;
    }
  },

  syncMacrosFromCamera: () => {
    set({ macroBaseline: { ...get().runtime.tgt } });
  },

  setTargetParam: (key, value) => {
    const runtime = get().runtime;
    runtime.tgt[key] = value;
    runtime.cur[key] = value;
    // Zoom is user-owned even during auto-evolve — keep baseline in sync so orbit breathes around it
    if (key === 'zoom') {
      get().viewAnchor.zoom = value;
      get().macroBaseline.zoom = value;
    } else if (get().uiMode === 'lab' && !get().autoEvolve) {
      set({ macroBaseline: { ...runtime.tgt } });
    } else if (get().autoEvolve) {
      get().macroBaseline[key] = value;
    }
    set({});
  },

  applySnapshot: (name) => {
    const snapshots = getSnapshots(get().fractalId);
    const snapshot = snapshots.find((s) => s.name === name);
    if (snapshot) applySnapshotToState(snapshot, get, set);
  },

  remix: (mode) => remixState(get, set, mode),

  toggleLockView: () => set((s) => ({ lockViewOnRemix: !s.lockViewOnRemix })),

  getSeed: () => encodeSeed({
    fractalId: get().fractalId,
    paletteIdx: get().paletteIdx,
    macros: get().macros,
    runtime: get().runtime,
    atmosphere: get().atmosphere,
    iters: get().iters,
    evolveSpeed: get().evolveSpeed,
  }),

  copySeed: () => {
    const seed = get().getSeed();
    setSeedInUrl(seed);
    void navigator.clipboard.writeText(`${window.location.origin}${window.location.pathname}#seed=${seed}`);
  },

  startRecording: () => {
    if (get().isRecording) return;
    void startCanvasRecording().then((result) => {
      if (!result.ok) {
        alert(result.error);
        return;
      }
      set({
        isRecording: true,
        uiVisibleBeforeRecord: get().uiVisible,
        uiVisible: false,
      });
    });
  },

  stopRecording: () => {
    if (!get().isRecording) return;
    const slug = getFractalSlug(get().fractalId);
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `fractal-${slug}-${stamp}`;
    const restoreUi = get().uiVisibleBeforeRecord;
    // Stop lockstep capture immediately; finalize/download can finish after.
    set({ isRecording: false, uiVisible: restoreUi });
    void stopCanvasRecording(filename).catch(() => {
      /* error already surfaced */
    });
  },

  loadSeed: (seed) => {
    const decoded = decodeSeed(seed);
    if (!decoded) return false;

    const runtime = get().runtime;
    if (decoded.fractalId !== undefined) applyFractalPreset(runtime.tgt, decoded.fractalId);
    if (decoded.camera) Object.assign(runtime.tgt, decoded.camera);
    if (decoded.macros) applyMacrosToTarget(decoded.macros, decoded.fractalId ?? get().fractalId, runtime.tgt, false);

    set({
      fractalId: decoded.fractalId ?? get().fractalId,
      paletteIdx: decoded.paletteIdx ?? get().paletteIdx,
      macros: decoded.macros ?? get().macros,
      atmosphere: decoded.atmosphere ?? get().atmosphere,
      iters: decoded.iters ?? get().iters,
      evolveSpeed: decoded.evolveSpeed ?? get().evolveSpeed,
      macroBaseline: { ...runtime.tgt },
      snapshotLerpBoost: true,
    });
    return true;
  },

  loadSeedFromUrl: () => {
    const seed = getSeedFromUrl();
    return seed ? get().loadSeed(seed) : false;
  },

  clearSnapshotLerpBoost: () => set({ snapshotLerpBoost: false }),

  getRuntime: () => get().runtime,

  getMacroBaseline: () => get().macroBaseline,

  getAtmosphereBaseline: () => get().atmosphereBaseline,
}));

export type ExplorerStoreApi = typeof useExplorerStore;

if (import.meta.env.DEV) {
  (window as unknown as { __explorerStore?: ExplorerStoreApi }).__explorerStore =
    useExplorerStore;
}

// Initialize express mode macros and per-fractal camera framing on first load
const initial = useExplorerStore.getState();
const initView = applyFractalPreset(initial.runtime.tgt, initial.fractalId);
const initResult = applyMacrosToTarget(initial.macros, initial.fractalId, initial.runtime.tgt, true);
snapCameraToView(initial.runtime.cur, initView);
useExplorerStore.setState({
  atmosphere: initResult.atmosphere,
  atmosphereBaseline: { ...initResult.atmosphere },
  viewAnchor: initView,
  macroBaseline: { ...initial.runtime.tgt },
});
