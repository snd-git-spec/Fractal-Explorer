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
  orbit: CameraOrbit;
  evolvePhase: number;
  morphPhase: number;
  orbitPhase: number;
  dt: number;
  evolveSpeed: number;
  paletteIdx: PaletteIdx;
  iters: number;
  fractalId: FractalId;
  /** When true, morph continues but satellite camera is left alone. */
  holdView?: boolean;
}

export interface EvolveResult {
  phase: number;
  morphPhase: number;
  orbitPhase: number;
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
  const byZoom = clamp(zoom / 3.2, 0.35, 1);
  if (fractalId === 16) return byZoom * 0.45;
  if (fractalId === 15) return byZoom * 0.55;
  if (DENSE_ORBIT_IDS.has(fractalId)) return byZoom * 0.5;
  return byZoom * 0.85;
}

/** Phase clock for colour / atmosphere. */
const PHASE_RATE = 0.7;

/** Shape morph wave frequency — fast enough to read as living form. */
const MORPH_FREQ = 1.85;
const MORPH_FREQ2 = 1.05;

/**
 * Free sphere journey — wall-clock integration of longitude + latitude.
 * Latitude: POLE_MAX * sin(phase) hits true poles. Longitude: continuous spin + wander.
 */
const GOLDEN = 0.6180339887;

/** Pitch clamp — true poles (±90° of the tour sphere). */
const POLE_MAX = 1.28;

/** Align orbit so the next frames continue from this pitch (no jump). */
export function syncSphereOrbitToPitch(orbit: CameraOrbit, rotX: number): void {
  const x = clamp(rotX, -POLE_MAX, POLE_MAX);
  orbit.rotX = x;
  orbit.azimuth = 0;
  orbit.rotY = 0;
  orbit.zoom = 0;
  // Running latitude phase — advanceFreeSphereOrbit integrates this each frame
  orbit.seeds.elPhase = Math.asin(clamp(x / POLE_MAX, -1, 1));
}

interface EvolveBehavior {
  intensity: number;
  paramAmp: number;
  colorAmp: number;
  detailSwing: number;
}

/** Tempered morph; colourAmp kept near git so spectra still tour the full wheel. */
const EVOLVE_CYCLE: EvolveBehavior[] = [
  { intensity: 0.7, paramAmp: 0.75, colorAmp: 1.05, detailSwing: 3.0 },
  { intensity: 0.85, paramAmp: 0.9, colorAmp: 1.2, detailSwing: 4.0 },
  { intensity: 0.95, paramAmp: 1.0, colorAmp: 1.35, detailSwing: 4.5 },
  { intensity: 0.8, paramAmp: 0.85, colorAmp: 1.15, detailSwing: 3.5 },
];

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

/** Wall-clock rates (rad/sec). Density/zoom pacing is applied once via orbitPace(dt). */
function sphereRates(
  seeds: CameraOrbit['seeds'],
  beh: EvolveBehavior,
  fractalId: FractalId,
  pathTime: number,
): { spin: number; elOmega: number; zoomOmega: number; zoomAmp: number } {
  const i = beh.intensity;
  const dense = DENSE_ORBIT_IDS.has(fractalId);
  const d = seeds.azDir || 1;

  // ~20–35s per full yaw turn at pace=1
  const spinBase =
    lerp(0.2, 0.32, i) * (0.85 + 0.25 * seeds.azRateScale);
  const spin =
    spinBase *
    d *
    (1 +
      0.2 * Math.sin(pathTime * 0.11 + seeds.azOffset) +
      0.12 * Math.sin(pathTime * 0.07 * GOLDEN + seeds.zoomPhase));

  // ~15–25s equator→pole→equator (half-period π / elOmega)
  const elOmega =
    lerp(0.14, 0.22, i) * (0.85 + 0.3 * seeds.elRateScale);

  const zoomOmega = lerp(0.06, 0.1, i);
  const zoomAmp = (dense ? 0.028 : 0.04) + i * 0.025;

  return { spin, elOmega, zoomOmega, zoomAmp };
}

/**
 * Integrate sphere pose with wall dt so motion cannot freeze when orbitPhase is tiny/reset.
 * Mutates seeds.elPhase / zoomPhase as running integrators.
 */
function advanceFreeSphereOrbit(
  orbit: CameraOrbit,
  dt: number,
  pathTime: number,
  beh: EvolveBehavior,
  fractalId: FractalId,
): void {
  if (dt <= 0) return;

  const { spin, elOmega, zoomOmega, zoomAmp } = sphereRates(
    orbit.seeds,
    beh,
    fractalId,
    pathTime,
  );

  orbit.azimuth += dt * spin;
  orbit.seeds.elPhase += dt * elOmega;
  orbit.seeds.zoomPhase += dt * zoomOmega;

  orbit.rotX = clamp(POLE_MAX * Math.sin(orbit.seeds.elPhase), -POLE_MAX, POLE_MAX);
  orbit.rotY = orbit.azimuth;
  orbit.zoom =
    Math.sin(orbit.seeds.zoomPhase) * zoomAmp * 0.45 +
    Math.sin(orbit.seeds.zoomPhase * 1.7 + 0.9) * zoomAmp * 0.2;
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
      1.05,
      crisp ? 1.7 : 1.95,
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

  // In-band morphs: stay inside the live param band so form keeps moving
  // (generic high mul + clamps = rush to extreme, then stall).
  if (fractalId === 0 || fractalId === 5) {
    if (fractalId === 0) {
      // Absolute band crawl — always moving through lobe powers (no baseline linger).
      // Incommensurate rates so the sum rarely flatlines.
      const amp = 0.75 + 0.25 * a;
      const ph = morphP * 1.05;
      tgt.power = clamp(
        8.0 +
          Math.sin(ph) * 3.4 * amp +
          Math.sin(ph * 0.618 + 1.2) * 1.6 * amp +
          Math.sin(ph * 1.41 + 2.4) * 0.9 * amp,
        5.0,
        12.0,
      );
      tgt.bailout = clamp(
        2.4 +
          Math.sin(ph * 0.73 + 0.5) * 0.95 * amp +
          Math.cos(ph * 1.12 + 1.8) * 0.55 * amp,
        1.5,
        4.4,
      );
      // Stretch / spin keep changing even when power briefly slows
      tgt.cx = clamp(
        Math.sin(ph * 0.55 + 0.3) * 0.72 * amp +
          Math.cos(ph * 0.91 + 1.7) * 0.4 * amp,
        -0.92,
        0.92,
      );
      tgt.cy = clamp(
        Math.sin(ph * 0.48 + 2.1) * 0.7 * amp +
          Math.sin(ph * 1.05 + 0.6) * 0.38 * amp,
        -0.92,
        0.92,
      );
      return;
    }

    // Dodeca: morph the solid — recursion + spin/stretch of the 20-vertex cloud
    const ampD = 0.88 + 0.12 * a;
    const ph = morphP * 1.25;
    tgt.power = clamp(
      8.0 +
        Math.sin(ph) * 4.0 * ampD +
        Math.sin(ph * 0.55 + 1.05) * 2.0 * ampD,
      4.5,
      13.5,
    );
    tgt.bailout = clamp(
      2.9 +
        Math.sin(ph * 0.62 + 0.4) * 1.2 * ampD +
        Math.cos(ph * 0.95 + 1.4) * 0.65 * ampD,
      1.6,
      4.8,
    );
    tgt.cx = clamp(
      Math.sin(ph * 0.38 + 0.12) * 1.05 * ampD +
        Math.cos(ph * 0.72 + 1.35) * 0.55 * ampD +
        Math.sin(ph * 1.15 + 2.4) * 0.35 * ampD,
      -1.15,
      1.15,
    );
    tgt.cy = clamp(
      Math.sin(ph * 0.34 + 1.95) * 1.0 * ampD +
        Math.sin(ph * 0.78 + 0.55) * 0.55 * ampD +
        Math.cos(ph * 1.08 + 1.7) * 0.35 * ampD,
      -1.15,
      1.15,
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
  // Dodeca: palette shift tracks shape morph (bloom / 5-fold), not just clock
  const clock = fractalId === 5 ? morphP * 0.55 + p * 0.18 : p;
  const tourRate = fractalId === 5 ? 0.28 : 0.16;
  const tour = ((clock * tourRate) % 2 + 2) % 2;
  const saw = tour < 1 ? tour * 2 - 1 : 3 - tour * 2;
  tgt.glow = clamp(
    baseline.glow +
      saw * (fractalId === 5 ? 0.95 : 0.85) * a +
      Math.sin(clock * 0.35) * 0.22 * a +
      Math.cos(clock * 0.22 + 1.4) * 0.14 * a,
    -0.15,
    2.2,
  );
  const brightWave =
    Math.sin(clock * 0.28 + 0.6) * 0.55 * a +
    Math.cos(clock * 0.18 + 1.4) * 0.3 * a;
  tgt.bright = clamp(baseline.bright + brightWave, 0.55, 3.0);
}

export function updateEvolveTargets(ctx: EvolveContext): EvolveResult {
  const { tgt, baseline, atmosphereBaseline, orbit, dt, evolveSpeed: spd, fractalId } = ctx;
  const morph = getEvolveMorph(fractalId);
  // All clocks follow Evolve Speed so lowering the dial slows camera + shape together
  const speedScale = spd / 0.3;
  const p      = ctx.evolvePhase + dt * spd * PHASE_RATE;
  const morphP = ctx.morphPhase  + dt * morph.morphRate * speedScale;
  const beh = resolveEvolveBehavior(p);

  // Freeze view while aiming — do not advance sphere integrators
  const orbitP = ctx.holdView
    ? ctx.orbitPhase
    : ctx.orbitPhase + dt * speedScale;

  if (!ctx.holdView) {
    // Wall-clock sphere tour (dt) — independent of the old near-frozen orbitPhase sampler
    const pace = orbitPace(fractalId, baseline.zoom);
    advanceFreeSphereOrbit(orbit, dt * speedScale * pace, orbitP, beh, fractalId);

    tgt.rotY = baseline.rotY + orbit.azimuth;
    tgt.rotX = clamp(orbit.rotX, -POLE_MAX, POLE_MAX);
    const zMin = ZOOM_MIN;
    const zMax = Math.max(zMin + 0.04, baseline.zoom * 1.15);
    tgt.zoom = clamp(baseline.zoom + orbit.zoom, zMin, zMax);
    tgt.panX = 0;
    tgt.panY = 0;
  }

  morphFractalShape(tgt, baseline, morphP, beh, fractalId);
  morphColor(tgt, baseline, p, morphP, beh, fractalId);

  return {
    phase: p,
    morphPhase: morphP,
    orbitPhase: orbitP,
    atmosphere: evolveAtmosphere(atmosphereBaseline, p, beh, fractalId),
    paletteIdx: evolvePalette(ctx.paletteIdx, p, beh),
    iters: morphDetail(ctx.iters, morphP, beh, fractalId),
  };
}
