import type { ExplorerRuntimeState } from '@/fractals/types';

// Manual follow — snappy enough that mouse/touch orbit does not feel lagged behind the pointer.
const LERP = 0.22;
const SNAPSHOT_LERP = 0.12;

/**
 * Time constants for frame-rate-independent exponential lerp during auto-evolve.
 * k = 1 - exp(-dt / TAU)  — same perceived speed at any frame rate.
 */
// Keep this short — a long tau makes post-drag resume look frozen while lag rebuilds.
const ROT_TAU   = 0.48;  // seconds — smooth global tour without whippy catch-up
const PARAM_TAU = 1.8;  // seconds — shape morph catches up
const COLOR_TAU = 4.5;  // seconds — hue eases slowly (git mapping feel)
const PAN_TAU   = 0.9;  // seconds — pan snaps back to centre

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpField(state: ExplorerRuntimeState, k: number, key: keyof ExplorerRuntimeState['cur']): void {
  state.cur[key] = lerp(state.cur[key], state.tgt[key], k) as never;
}

export function lerpCameraState(
  state: ExplorerRuntimeState,
  dt: number,
  snapshotBoost = false,
  autoEvolve = false,
  /** Optional shorter rotation tau (e.g. post-gesture resume). */
  rotTau = ROT_TAU,
): void {
  if (autoEvolve) {
    const rotK   = 1 - Math.exp(-dt / Math.max(0.15, rotTau));
    const paramK = 1 - Math.exp(-dt / PARAM_TAU);
    const colorK = 1 - Math.exp(-dt / COLOR_TAU);
    const panK   = 1 - Math.exp(-dt / PAN_TAU);   // pan snaps to centre fast
    lerpField(state, rotK,   'rotX');
    lerpField(state, rotK,   'rotY');
    // Zoom snaps — slow PARAM_TAU lerp left framing stuck inside the set after fractal switch
    state.cur.zoom = state.tgt.zoom;
    lerpField(state, panK,   'panX');  // fast snap to 0
    lerpField(state, panK,   'panY');  // fast snap to 0
    lerpField(state, paramK, 'power');
    lerpField(state, paramK, 'bailout');
    lerpField(state, paramK, 'cx');
    lerpField(state, paramK, 'cy');
    lerpField(state, colorK, 'glow');
    lerpField(state, colorK, 'bright');
    return;
  }
  const rate = snapshotBoost ? SNAPSHOT_LERP : LERP;
  const k = Math.min(1, rate + dt * (snapshotBoost ? 1.2 : 0.8));
  // Colour always eases slowly — Wild snaps shape but fades through hues
  const colorK = 1 - Math.exp(-dt / COLOR_TAU);
  lerpField(state, k, 'rotX');
  lerpField(state, k, 'rotY');
  lerpField(state, k, 'zoom');
  lerpField(state, k, 'panX');
  lerpField(state, k, 'panY');
  lerpField(state, k, 'power');
  lerpField(state, k, 'bailout');
  lerpField(state, k, 'cx');
  lerpField(state, k, 'cy');
  lerpField(state, colorK, 'glow');
  lerpField(state, colorK, 'bright');
}

export class FpsCounter {
  private frames = 0;
  private lastFpsTime = performance.now();

  tick(now: number, onFps: (fps: number) => void): void {
    this.frames++;
    if (now - this.lastFpsTime > 600) {
      const fps = Math.round((this.frames * 1000) / (now - this.lastFpsTime));
      onFps(fps);
      this.frames = 0;
      this.lastFpsTime = now;
    }
  }
}
