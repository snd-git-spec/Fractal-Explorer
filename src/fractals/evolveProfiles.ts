import type {
  AtmosphereState,
  CameraOrbit,
  CameraState,
  PaletteIdx,
} from './types';
import { ZOOM_MIN } from './types';
import { getEvolveMorph } from './evolveMorph';
import type { FractalId } from './types';

export interface EvolveContext {
  tgt: CameraState;
  baseline: CameraState;
  atmosphereBaseline: AtmosphereState;
  evolvePhase: number;
  morphPhase: number;
  dt: number;
  evolveSpeed: number;
  paletteIdx: PaletteIdx;
  iters: number;
  fractalId: FractalId;
  /** When true, morph continues but satellite camera is left alone. */
  holdView?: boolean;
}

export interface CameraPathContext {
  tgt: CameraState;
  baseline: CameraState;
  orbit: CameraOrbit;
  orbitPhase: number;
  dt: number;
  fractalId: FractalId;
  /** User is dragging — path clock runs but offsets follow the hand. */
  holdView?: boolean;
}

export interface EvolveResult {
  phase: number;
  morphPhase: number;
  atmosphere: AtmosphereState;
  paletteIdx: PaletteIdx;
  iters: number;
}

/** Fractals whose detail fills the frame so the same yaw rate reads as a blur. */
const DENSE_ORBIT_IDS: ReadonlySet<FractalId> = new Set<FractalId>([
  4, // Apollonian
  7, // Pseudo-Kleinian
  8, // Kleinian IFS
  11, // Amazing Surf
  12, // Kleinian
  14, // Kali
  16, // Penrose — close zoom makes the same yaw feel rushed
]);

/** Keep screen-space motion calm: closer zoom + dense packings need slower turns. */
function orbitPace(fractalId: FractalId, zoom: number): number {
  // Slow global tour — full sphere, unhurried
  const byZoom = clamp(zoom / 3.2, 0.35, 0.65);
  if (fractalId === 5) return byZoom * 0.55;
  if (fractalId === 16) return byZoom * 0.28; // Penrose — close φ-caverns read motion hot
  if (fractalId === 17) return byZoom * 0.38; // hyperbolic FOV reads motion hot
  if (fractalId === 18) return byZoom * 0.22; // Tidefold — close dive reads motion hot; slow grand tour
  if (fractalId === 15 || DENSE_ORBIT_IDS.has(fractalId)) {
    return byZoom * 0.42;
  }
  return byZoom * 0.5;
}

/** Phase clock for colour / atmosphere. */
const PHASE_RATE = 0.7;

/** Shape morph wave frequency — fast enough to read as living form. */
const MORPH_FREQ = 1.85;
const MORPH_FREQ2 = 1.05;

/**
 * Free sphere journey — wall-clock integration of longitude + latitude.
 * Dual-frequency latitude + continuous yaw → dense global covering (not a local skim).
 */
const GOLDEN = 0.6180339887;
/** Second incommensurate rate — fills longitude/latitude without repeating a belt. */
const SILVER = 0.4142135623;

/** Pitch clamp — near true poles (±~85°). */
const POLE_MAX = 1.48;

/** Lens roll rate in rad per path-second (~3 min per full turn at default evolve speed). */
const LENS_SPIN_RATE = 0.075;

/** Latitude amplitude — 1.0 = full pole-to-pole sweep on every fractal. */
const LAT_AMP = 1.0;

/** Per-fractal zoom shell only — path latitude/longitude stay global. */
interface ZoomShell {
  zMinMul: number;
  zMaxMul: number;
  zoomAmpMul: number;
}

const DEFAULT_ZOOM_SHELL: ZoomShell = {
  zMinMul: 0.35,
  zMaxMul: 2.4,
  zoomAmpMul: 1,
};

/** Dense / interior fractals — keep camera outside walls; do not shrink the sphere tour. */
const ZOOM_SHELL: Partial<Record<FractalId, ZoomShell>> = {
  7: { zMinMul: 0.82, zMaxMul: 1.32, zoomAmpMul: 0.26 },
  8: { zMinMul: 0.88, zMaxMul: 1.22, zoomAmpMul: 0.2 },
  12: { zMinMul: 0.8, zMaxMul: 1.38, zoomAmpMul: 0.28 },
  13: { zMinMul: 0.72, zMaxMul: 1.45, zoomAmpMul: 0.32 },
};

function getZoomShell(fractalId: FractalId): ZoomShell {
  return ZOOM_SHELL[fractalId] ?? DEFAULT_ZOOM_SHELL;
}

/** @deprecated use syncOrbitFromGesture */
export function syncSphereOrbitToPitch(
  orbit: CameraOrbit,
  rotX: number,
  rotY = 0,
): void {
  syncOrbitFromGesture(orbit, { rotX, rotY });
}

interface EvolveBehavior {
  intensity: number;
  paramAmp: number;
  colorAmp: number;
  detailSwing: number;
}

/** Tempered morph; colourAmp high so hue dynamics stay alive. */
const EVOLVE_CYCLE: EvolveBehavior[] = [
  { intensity: 0.7, paramAmp: 0.75, colorAmp: 1.25, detailSwing: 3.0 },
  { intensity: 0.85, paramAmp: 0.9, colorAmp: 1.45, detailSwing: 4.0 },
  { intensity: 0.95, paramAmp: 1.0, colorAmp: 1.6, detailSwing: 4.5 },
  { intensity: 0.8, paramAmp: 0.85, colorAmp: 1.35, detailSwing: 3.5 },
];

/** Fixed cruise for the camera tour so evolve phases never change its speed. */
const CAMERA_BEHAVIOR = EVOLVE_CYCLE[2];

const CYCLE_SEGMENT = 16;

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function smoothstep(t: number): number {
  const x = clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpBehavior(a: EvolveBehavior, b: EvolveBehavior, t: number): EvolveBehavior {
  return {
    intensity: lerp(a.intensity, b.intensity, t),
    paramAmp: lerp(a.paramAmp, b.paramAmp, t),
    colorAmp: lerp(a.colorAmp, b.colorAmp, t),
    detailSwing: lerp(a.detailSwing, b.detailSwing, t),
  };
}

function resolveEvolveBehavior(phase: number): EvolveBehavior {
  const cycleLen = CYCLE_SEGMENT * EVOLVE_CYCLE.length;
  const cycleT = ((phase % cycleLen) + cycleLen) % cycleLen / CYCLE_SEGMENT;
  const idx = Math.floor(cycleT) % EVOLVE_CYCLE.length;
  const nextIdx = (idx + 1) % EVOLVE_CYCLE.length;
  const t = smoothstep(cycleT - idx);
  return lerpBehavior(EVOLVE_CYCLE[idx], EVOLVE_CYCLE[nextIdx], t);
}

function softPitch(raw: number): number {
  return POLE_MAX * Math.tanh(raw / POLE_MAX);
}

function softPitchVel(raw: number, rawVel: number): number {
  const th = Math.tanh(raw / POLE_MAX);
  return (1 - th * th) * rawVel;
}

/** Wall-clock cruise rates (rad/sec). Density/zoom pacing applied via orbitPace(dt). */
function sphereRates(
  seeds: CameraOrbit['seeds'],
  beh: EvolveBehavior,
  fractalId: FractalId,
  pathTime: number,
): { spin: number; elOmega: number; zoomOmega: number; zoomAmp: number } {
  const i = beh.intensity;
  let spin =
    lerp(0.034, 0.056, i) *
    (0.9 + 0.3 * seeds.azRateScale) *
    (1 + 0.04 * Math.sin(pathTime * 0.045 + seeds.azOffset));
  if (fractalId === 13) spin *= 1.25;
  const elOmega =
    spin *
    GOLDEN *
    1.12 *
    (0.85 + 0.3 * seeds.elRateScale) *
    (1 + 0.04 * Math.sin(pathTime * 0.033 * GOLDEN + seeds.azOffset));

  // Wide distance breathe — shell dive / pull-back (fraction of baseline)
  let zoomOmega = lerp(0.035, 0.06, i);
  let zoomAmp = 0.32 + i * 0.12;

  // Dodeca: stronger scale-shell dive through nested generations
  if (fractalId === 5) {
    zoomOmega = lerp(0.07, 0.11, i);
    zoomAmp = 0.55 + i * 0.15;
  }

  return { spin, elOmega, zoomOmega, zoomAmp };
}

/** Quasi-ergodic path on S² — same global tour for every fractal. */
function spherePathAt(
  t: number,
  seeds: CameraOrbit['seeds'],
  lonBase: number,
  yawRate: number,
): { lon: number; rotX: number; yawVel: number; pitchVel: number } {
  const w1 = yawRate;
  const w2 = yawRate * GOLDEN * (0.88 + 0.24 * seeds.elRateScale);
  const w3 = yawRate * (1 + SILVER) * (0.82 + 0.2 * seeds.azRateScale);

  const lonWeave = lonWeaveAt(t, seeds, w1);
  const lon = lonBase + w1 * t + lonWeave;

  const latArg1 = w2 * t + seeds.elPhase;
  const latArg2 = w3 * t + seeds.azOffset;
  const latArg3 = w2 * GOLDEN * 2.4 * t + seeds.elPhase * 0.55 + 2.1;
  const latArg4 = w3 * SILVER * 3.1 * t + seeds.azOffset * 0.72 + 0.85;
  const lat = clamp(
    0.38 * Math.sin(latArg1) +
      0.3 * Math.sin(latArg2) +
      0.18 * Math.sin(latArg3) +
      0.14 * Math.sin(latArg4),
    -1,
    1,
  );

  const latRaw = POLE_MAX * LAT_AMP * lat;
  const latVelRaw = POLE_MAX * LAT_AMP * (
    0.38 * w2 * Math.cos(latArg1) +
    0.3 * w3 * Math.cos(latArg2) +
    0.18 * w2 * GOLDEN * 2.4 * Math.cos(latArg3) +
    0.14 * w3 * SILVER * 3.1 * Math.cos(latArg4)
  );

  const rotX = softPitch(latRaw);
  const yawVel =
    w1 +
    0.38 * w2 * Math.cos(w2 * t + seeds.elPhase) +
    0.26 * w3 * Math.cos(w3 * t + seeds.azOffset * 0.41 + 1.05);
  const pitchVel = softPitchVel(latRaw, latVelRaw);

  return { lon, rotX, yawVel, pitchVel };
}

function lonWeaveAt(
  t: number,
  seeds: CameraOrbit['seeds'],
  yawRate: number,
): number {
  const w2 = yawRate * GOLDEN * (0.88 + 0.24 * seeds.elRateScale);
  const w3 = yawRate * (1 + SILVER) * (0.82 + 0.2 * seeds.azRateScale);
  return (
    0.38 * Math.sin(w2 * t + seeds.elPhase) +
    0.26 * Math.sin(w3 * t + seeds.azOffset * 0.41 + 1.05) +
    0.14 * Math.sin(w2 * GOLDEN * 1.9 * t + seeds.elPhase * 0.65 + 2.2)
  );
}

function pathRollAt(
  pathTime: number,
  yawRate: number,
  seeds: CameraOrbit['seeds'],
  fractalId: FractalId,
): { roll: number; rollVel: number } {
  const amp = fractalId === 13 ? 1.3 : 1.0;
  // Continuous one-way lens spin (spinning top) — φ-Cavern's path clock runs at 0.55×, so compensate
  const spinDir = seeds.elPhase > Math.PI ? 1 : -1;
  const spinRate = spinDir * LENS_SPIN_RATE * (fractalId === 16 ? 1 / 0.55 : 1);
  const wR = yawRate * 0.58 * (0.88 + 0.22 * seeds.elRateScale);
  const wR2 = wR * GOLDEN * 1.35;
  const wR3 = wR * SILVER * 2.2;
  const a1 = wR * pathTime + seeds.elPhase;
  const a2 = wR2 * pathTime + seeds.azOffset * 0.6;
  const a3 = wR3 * pathTime + seeds.elPhase * 0.45 + 1.1;
  const roll = spinRate * pathTime + amp * (
    0.32 * Math.sin(a1) +
    0.2 * Math.sin(a2) +
    0.14 * Math.sin(a3)
  );
  const rollVel = spinRate + amp * (
    0.32 * wR * Math.cos(a1) +
    0.2 * wR2 * Math.cos(a2) +
    0.14 * wR3 * Math.cos(a3)
  );
  return { roll, rollVel };
}

/** Align orbit offsets so path + offset matches the current view pose. */
export function syncOrbitOffsetsFromPose(
  orbit: CameraOrbit,
  pose: { rotX: number; rotY: number; rotZ?: number },
  fractalId: FractalId,
  pathTime: number,
): void {
  const { spin: yawRate } = sphereRates(orbit.seeds, CAMERA_BEHAVIOR, fractalId, pathTime);
  const path = spherePathAt(pathTime, orbit.seeds, orbit.azimuth, yawRate);
  const { roll } = pathRollAt(pathTime, yawRate, orbit.seeds, fractalId);
  orbit.lonOffset = pose.rotY - path.lon;
  orbit.latOffset = pose.rotX - path.rotX;
  orbit.rollOffset = (pose.rotZ ?? 0) - roll;
}

/** @deprecated use syncOrbitOffsetsFromPose */
export function syncOrbitFromGesture(
  orbit: CameraOrbit,
  pose: { rotX: number; rotY: number; rotZ?: number },
  fractalId: FractalId = 0,
  pathTime = 0,
): void {
  orbit.zoom = 0;
  orbit.panX = 0;
  orbit.panY = 0;
  orbit.roll = pose.rotZ ?? 0;
  orbit.yawVel = 0;
  orbit.pitchVel = 0;
  syncOrbitOffsetsFromPose(orbit, pose, fractalId, pathTime);
}

/**
 * Parametric global sphere — longitude + latitude from path clock (orbitPhase).
 * Pace scaling applies to zoom only.
 */
function advanceFreeSphereOrbit(
  orbit: CameraOrbit,
  _movDt: number,
  zoomDt: number,
  pathTime: number,
  beh: EvolveBehavior,
  fractalId: FractalId,
  baselineZoom = 2.2,
): void {
  const { spin: yawRate, zoomOmega, zoomAmp } = sphereRates(
    orbit.seeds,
    beh,
    fractalId,
    pathTime,
  );
  const zoomShell = getZoomShell(fractalId);
  const breatheAmp = zoomAmp * zoomShell.zoomAmpMul;

  const { lon, rotX, yawVel, pitchVel } = spherePathAt(
    pathTime,
    orbit.seeds,
    orbit.azimuth,
    yawRate,
  );

  orbit.rotY = lon;
  orbit.rotX = rotX;
  const { roll, rollVel } = pathRollAt(pathTime, yawRate, orbit.seeds, fractalId);
  orbit.roll = roll;
  orbit.yawVel = yawVel;
  orbit.pitchVel = pitchVel;
  orbit.rollVel = rollVel;

  if (zoomDt > 0) {
    orbit.seeds.zoomPhase += zoomDt * zoomOmega;

    const zPh = orbit.seeds.zoomPhase;
    const zoomWave =
      Math.sin(zPh) * breatheAmp * 0.42 +
      Math.sin(zPh * 1.618 + 0.7) * breatheAmp * 0.24 +
      Math.sin(zPh * 0.37 + 1.9) * breatheAmp * 0.1;
    const zoomTarget = baselineZoom * zoomWave;
    orbit.zoom += (zoomTarget - orbit.zoom) * (1 - Math.exp(-zoomDt * 0.45));
  }

  orbit.panX = 0;
  orbit.panY = 0;
}

function evolveAtmosphere(
  baseline: AtmosphereState,
  p: number,
  beh: EvolveBehavior,
  fractalId: FractalId,
): AtmosphereState {
  const a = beh.colorAmp;
  const f = 0.48;
  const crisp = fractalId === 17;
  return {
    fov: clamp(
      baseline.fov +
        Math.sin(p * f) * 0.1 * a +
        Math.cos(p * f * 0.618 + 1) * 0.06 * a,
      1.5,
      crisp ? 1.7 : 2.05,
    ),
    fog: clamp(
      baseline.fog +
        Math.sin(p * f * 0.9 + 0.5) * (crisp ? 0.08 : 0.18) * a +
        Math.cos(p * f * 0.55) * (crisp ? 0.04 : 0.1) * a,
      crisp ? 0.1 : 0.12,
      crisp ? 0.42 : 0.7,
    ),
    gamma: clamp(
      baseline.gamma +
        Math.sin(p * f * 0.7 + 1.1) * 0.12 * a +
        Math.cos(p * f * 0.44 + 2.3) * 0.08 * a,
      crisp ? 0.48 : 0.42,
      crisp ? 0.68 : 0.78,
    ),
    vignette: clamp(
      baseline.vignette +
        Math.cos(p * f * 0.6) * 0.25 * a +
        Math.sin(p * f * 0.38 + 1.8) * 0.12 * a,
      0.35,
      crisp ? 1.1 : 1.35,
    ),
  };
}

function evolvePalette(baseline: PaletteIdx, _p: number, _beh: EvolveBehavior): PaletteIdx {
  // Palette stays fixed during auto-evolve — discrete palette switches cause instant colour jumps
  // that cannot be crossfaded in the shader. Rich colour variation comes from the wide glow
  // (colorShift) swing below, which cycles through the full hue range continuously.
  return baseline;
}

function morphFractalShape(
  tgt: CameraState,
  baseline: CameraState,
  morphP: number,
  beh: EvolveBehavior,
  fractalId: FractalId,
): void {
  const morph = getEvolveMorph(fractalId);
  const a = beh.paramAmp;

  // In-band morphs centred on the baseline (= active mode), so modes stay distinct while moving.
  // Clamps are each shader's safe band; swings are sized to keep a mode recognisable.
  const base = (v: number, fallback: number) => (Number.isFinite(v) ? v : fallback);

  if (fractalId === 0) {
    const amp = 0.75 + 0.25 * a;
    const ph = morphP * 1.05;
    tgt.power = clamp(
      base(baseline.power, 8) +
        Math.sin(ph) * 1.7 * amp +
        Math.sin(ph * 0.618 + 1.2) * 0.8 * amp +
        Math.sin(ph * 1.41 + 2.4) * 0.45 * amp,
      2.5,
      14,
    );
    tgt.bailout = clamp(
      base(baseline.bailout, 2.4) +
        Math.sin(ph * 0.73 + 0.5) * 0.5 * amp +
        Math.cos(ph * 1.12 + 1.8) * 0.3 * amp,
      1.2,
      5,
    );
    tgt.cx = clamp(
      base(baseline.cx, 0) +
        Math.sin(ph * 0.55 + 0.3) * 0.36 * amp +
        Math.cos(ph * 0.91 + 1.7) * 0.2 * amp,
      -1.1,
      1.1,
    );
    tgt.cy = clamp(
      base(baseline.cy, 0) +
        Math.sin(ph * 0.48 + 2.1) * 0.35 * amp +
        Math.sin(ph * 1.05 + 0.6) * 0.19 * amp,
      -1.1,
      1.1,
    );
    return;
  }

  // Dodeca: Power ↔ Scale (~1.88–2.22), bailout ↔ Size, cx/cy ↔ Stretch/Spin.
  if (fractalId === 5) {
    const amp = 0.72 + 0.28 * a;
    const ph = morphP * 0.95;
    tgt.power = clamp(
      base(baseline.power, 8.5) +
        Math.sin(ph) * 0.95 * amp +
        Math.sin(ph * 0.618 + 1.15) * 0.5 * amp +
        Math.sin(ph * 1.27 + 2.3) * 0.27 * amp,
      4,
      14,
    );
    tgt.bailout = clamp(
      base(baseline.bailout, 2.75) +
        Math.sin(ph * 0.73 + 0.45) * 0.42 * amp +
        Math.cos(ph * 1.05 + 1.7) * 0.24 * amp,
      1.5,
      5,
    );
    tgt.cx = clamp(
      base(baseline.cx, 0) +
        Math.sin(ph * 0.55 + 0.25) * 0.25 * amp +
        Math.cos(ph * 0.91 + 1.55) * 0.14 * amp,
      -1.1,
      1.1,
    );
    tgt.cy = clamp(
      base(baseline.cy, 0) +
        Math.sin(ph * 0.48 + 2.0) * 0.24 * amp +
        Math.sin(ph * 1.02 + 0.55) * 0.13 * amp,
      -1.1,
      1.1,
    );
    return;
  }

  // Pseudo-Kleinian: shader maps the full dial range into its safe architectural band
  if (fractalId === 7) {
    const amp = 0.55 + 0.25 * a;
    const ph = morphP * 0.85;
    tgt.power = clamp(
      base(baseline.power, 6.5) + Math.sin(ph) * 1.1 * amp + Math.sin(ph * 0.55 + 1.1) * 0.55 * amp,
      2.5,
      14.5,
    );
    tgt.bailout = clamp(
      base(baseline.bailout, 2.3) + Math.sin(ph * 0.7 + 0.4) * 0.42 * amp + Math.cos(ph * 1.05 + 1.5) * 0.24 * amp,
      1,
      6,
    );
    tgt.cx = clamp(
      base(baseline.cx, 0) + Math.sin(ph * 0.42 + 0.2) * 0.27 * amp + Math.cos(ph * 0.8 + 1.3) * 0.13 * amp,
      -0.85,
      0.85,
    );
    tgt.cy = clamp(
      base(baseline.cy, 0) + Math.sin(ph * 0.38 + 1.7) * 0.25 * amp + Math.sin(ph * 0.9 + 0.5) * 0.12 * amp,
      -0.85,
      0.85,
    );
    return;
  }

  // Kleinian: sparse grand band (vast voids, monumental ribs)
  if (fractalId === 12) {
    const amp = 0.55 + 0.25 * a;
    const ph = morphP * 0.75;
    tgt.power = clamp(
      base(baseline.power, 8.5) +
        Math.sin(ph) * 1.1 * amp +
        Math.sin(ph * 0.618 + 1.0) * 0.55 * amp +
        Math.sin(ph * 1.15 + 2.0) * 0.27 * amp,
      2.5,
      14.5,
    );
    tgt.bailout = clamp(
      base(baseline.bailout, 2.8) +
        Math.sin(ph * 0.65 + 0.4) * 0.4 * amp +
        Math.cos(ph * 0.95 + 1.35) * 0.21 * amp,
      1,
      6,
    );
    tgt.cx = clamp(
      base(baseline.cx, 0) + Math.sin(ph * 0.4 + 0.2) * 0.23 * amp + Math.cos(ph * 0.78 + 1.3) * 0.12 * amp,
      -0.9,
      0.9,
    );
    tgt.cy = clamp(
      base(baseline.cy, 0) + Math.sin(ph * 0.36 + 1.7) * 0.21 * amp + Math.sin(ph * 0.9 + 0.5) * 0.11 * amp,
      -0.9,
      0.9,
    );
    return;
  }

  // Penrose: gentle crawl around baseline — inversion + per-iteration twist turn wide swings into chaos
  if (fractalId === 16) {
    const amp = 0.35 + 0.15 * a;
    const ph = morphP * 0.6;
    const baseP = Number.isFinite(baseline.power) ? baseline.power : 8;
    const baseB = Number.isFinite(baseline.bailout) ? baseline.bailout : 2;
    const baseX = Number.isFinite(baseline.cx) ? baseline.cx : 0;
    const baseY = Number.isFinite(baseline.cy) ? baseline.cy : 0;
    tgt.power = clamp(
      baseP + Math.sin(ph) * 1.2 * amp + Math.sin(ph * 0.618 + 1.1) * 0.6 * amp,
      3,
      14,
    );
    tgt.bailout = clamp(
      baseB + Math.sin(ph * 0.55 + 0.4) * 0.5 * amp + Math.cos(ph * 0.9 + 1.3) * 0.25 * amp,
      1,
      6,
    );
    tgt.cx = clamp(
      baseX + Math.sin(ph * 0.35 + 0.2) * 0.3 * amp + Math.cos(ph * 0.6 + 1.2) * 0.15 * amp,
      -1.15,
      1.15,
    );
    tgt.cy = clamp(
      baseY + Math.sin(ph * 0.3 + 1.6) * 0.3 * amp + Math.sin(ph * 0.65 + 0.5) * 0.15 * amp,
      -1.15,
      1.15,
    );
    return;
  }

  // Tidefold: slow in-band crawl around the tuned Surf / Gap / Twist defaults
  if (fractalId === 18) {
    const amp = 0.4 + 0.2 * a;
    const ph = morphP * 0.48;
    const baseP = Number.isFinite(baseline.power) ? baseline.power : 12.5;
    const baseB = Number.isFinite(baseline.bailout) ? baseline.bailout : 3.22;
    const baseX = Number.isFinite(baseline.cx) ? baseline.cx : 0.28;
    const baseY = Number.isFinite(baseline.cy) ? baseline.cy : 0.25;
    tgt.power = clamp(
      baseP +
        Math.sin(ph) * 1.1 * amp +
        Math.sin(ph * 0.618 + 1.1) * 0.55 * amp +
        Math.sin(ph * 1.2 + 2.0) * 0.3 * amp,
      8.0,
      14.0,
    );
    tgt.bailout = clamp(
      baseB +
        Math.sin(ph * 0.55 + 0.4) * 0.45 * amp +
        Math.cos(ph * 0.9 + 1.3) * 0.28 * amp,
      2.2,
      4.2,
    );
    tgt.cx = clamp(
      baseX +
        Math.sin(ph * 0.32 + 0.15) * 0.28 * amp +
        Math.cos(ph * 0.58 + 1.2) * 0.16 * amp,
      -0.4,
      0.85,
    );
    tgt.cy = clamp(
      baseY +
        Math.sin(ph * 0.3 + 1.6) * 0.32 * amp +
        Math.sin(ph * 0.7 + 0.5) * 0.18 * amp,
      -0.5,
      0.85,
    );
    return;
  }

  const w1 = Math.sin(morphP * MORPH_FREQ);
  const w2 = Math.sin(morphP * MORPH_FREQ * 0.618 + 1.1);
  const w3 = Math.cos(morphP * MORPH_FREQ * 0.85 + 0.5);
  const w4 = Math.sin(morphP * MORPH_FREQ2 + 2.0);
  const w5 = Math.cos(morphP * MORPH_FREQ2 * 0.73 + 0.9);
  const w6 = Math.sin(morphP * MORPH_FREQ * 0.381 + 3.2);

  if (morph.power) {
    const rel = (w1 * 0.55 + w2 * 0.35 + w4 * 0.25 + w6 * 0.18) * 0.85 * a * morph.powerMul;
    const abs = (w3 * 2.4 + w5 * 1.5 + w6 * 1.0) * a * morph.powerMul * 0.4;
    tgt.power = clamp(
      baseline.power * (1 + rel) + abs,
      Math.max(2.5, baseline.power * 0.55),
      Math.min(15.5, baseline.power * 1.65),
    );
  } else {
    tgt.power = baseline.power;
  }

  if (morph.bailout) {
    const rel = (w3 * 0.55 + w2 * 0.4 + w5 * 0.3) * 0.65 * a * morph.bailoutMul;
    const abs = (w4 * 1.2 + w6 * 0.8) * a * morph.bailoutMul * 0.45;
    tgt.bailout = clamp(
      baseline.bailout * (1 + rel) + abs,
      Math.max(1.05, baseline.bailout * 0.55),
      Math.min(6.2, baseline.bailout * 1.75),
    );
  } else {
    tgt.bailout = baseline.bailout;
  }

  if (morph.warp) {
    const wx =
      (w1 * 0.6 + w3 * 0.4 + w4 * 0.35 + w6 * 0.22) * 1.15 * a * morph.warpMul +
      w5 * 0.5 * a * morph.warpMul;
    const wy =
      (w2 * 0.6 + w1 * 0.35 + w5 * 0.4 + w6 * 0.2) * 1.15 * a * morph.warpMul +
      w4 * 0.45 * a * morph.warpMul;
    tgt.cx = clamp(baseline.cx + wx, -1.15, 1.15);
    tgt.cy = clamp(baseline.cy + wy, -1.15, 1.15);
  } else {
    tgt.cx = baseline.cx;
    tgt.cy = baseline.cy;
  }
}

function morphDetail(
  iters: number,
  morphP: number,
  beh: EvolveBehavior,
  fractalId: FractalId,
): number {
  const morph = getEvolveMorph(fractalId);
  // Slowed + tempered on purpose: `iters` gets truncated to an int in every fractal's
  // GLSL loop, so every time this float crosses an integer the whole surface (hit
  // point, normal, AO, orbit trap) re-snaps. Fewer, slower crossings = far fewer jumps.
  const slowP = morphP * 0.45;
  const wave =
    Math.sin(slowP * 0.95) * beh.detailSwing +
    Math.cos(slowP * 0.62 + 0.8) * beh.detailSwing * 0.6 +
    Math.sin(slowP * 0.38 + 1.4) * beh.detailSwing * 0.35;
  return clamp(
    iters + wave * beh.paramAmp * 0.32 * morph.detailMul,
    Math.max(4, iters - 6),
    64,
  );
}

function morphColor(
  tgt: CameraState,
  baseline: CameraState,
  p: number,
  morphP: number,
  beh: EvolveBehavior,
  fractalId: FractalId,
): void {
  const a = beh.colorAmp;
  // Wide, shape-led hue tour — surfaces keep moving through the palette
  const clock = morphP * 1.05 + p * 0.35;
  const tourRate = fractalId === 5 ? 0.48 : fractalId === 12 ? 0.22 : fractalId === 16 ? 0.16 : 0.28;
  const tour = ((clock * tourRate) % 2 + 2) % 2;
  const saw = tour < 1 ? tour * 2 - 1 : 3 - tour * 2;
  tgt.glow = clamp(
    baseline.glow +
      saw * 1.15 * a +
      Math.sin(clock * 0.52) * 0.45 * a +
      Math.cos(clock * 0.31 + 1.4) * 0.32 * a +
      Math.sin(clock * 0.17 + morphP * 0.55) * 0.28 * a +
      Math.sin(clock * 0.09 + 2.1) * 0.18 * a,
    -0.2,
    2.4,
  );
  const brightWave =
    Math.sin(clock * 0.36 + 0.6) * 0.65 * a +
    Math.cos(clock * 0.22 + 1.4) * 0.38 * a +
    Math.sin(clock * 0.14 + 2.8) * 0.22 * a;
  tgt.bright = clamp(baseline.bright + brightWave, 0.6, 3.2);
}

/** Wall-clock path speed — independent of Evolve on/off and Evolve Speed. */
const CAMERA_PATH_RATE = 0.46;

/** Camera tour — runs every frame whether or not the fractal shape is evolving. */
export function updateCameraPath(ctx: CameraPathContext): number {
  const { tgt, baseline, orbit, dt, fractalId } = ctx;
  const pace = orbitPace(fractalId, baseline.zoom);
  const pathDt = dt * CAMERA_PATH_RATE * (fractalId === 16 ? 0.55 : 1);
  const zoomDt = pathDt * pace;
  const orbitP = ctx.orbitPhase + pathDt;

  advanceFreeSphereOrbit(
    orbit,
    pathDt,
    ctx.holdView ? 0 : zoomDt,
    orbitP,
    CAMERA_BEHAVIOR,
    fractalId,
    baseline.zoom,
  );

  if (ctx.holdView) {
    syncOrbitOffsetsFromPose(
      orbit,
      { rotX: tgt.rotX, rotY: tgt.rotY, rotZ: tgt.rotZ },
      fractalId,
      orbitP,
    );
  } else {
    const zoomShell = getZoomShell(fractalId);
    tgt.rotY = orbit.rotY + orbit.lonOffset;
    tgt.rotX = softPitch(orbit.rotX + orbit.latOffset);
    tgt.rotZ = orbit.roll + orbit.rollOffset;
    const zMin = Math.max(ZOOM_MIN, baseline.zoom * zoomShell.zMinMul);
    const zMax = Math.max(
      zMin + 0.25,
      baseline.zoom * (fractalId === 5 ? 3.0 : zoomShell.zMaxMul),
    );
    tgt.zoom = clamp(baseline.zoom + orbit.zoom, zMin, zMax);
    tgt.panX = 0;
    tgt.panY = 0;
  }

  return orbitP;
}

/** Fractal shape / colour / atmosphere evolution only — never touches the camera. */
export function updateEvolveTargets(ctx: EvolveContext): EvolveResult {
  const { tgt, baseline, atmosphereBaseline, dt, evolveSpeed: spd, fractalId } = ctx;
  const morph = getEvolveMorph(fractalId);
  const morphScale = spd / 0.3;
  const p      = ctx.evolvePhase + dt * spd * PHASE_RATE;
  const morphP = ctx.morphPhase  + dt * morph.morphRate * morphScale;
  const beh = resolveEvolveBehavior(p);

  if (!ctx.holdView) {
    morphFractalShape(tgt, baseline, morphP, beh, fractalId);
    morphColor(tgt, baseline, p, morphP, beh, fractalId);
  }

  return {
    phase: p,
    morphPhase: morphP,
    atmosphere: evolveAtmosphere(atmosphereBaseline, p, beh, fractalId),
    paletteIdx: evolvePalette(ctx.paletteIdx, p, beh),
    iters: ctx.holdView
      ? ctx.iters
      : morphDetail(ctx.iters, morphP, beh, fractalId),
  };
}
