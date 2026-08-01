import type {
  AtmosphereState,
  CameraOrbit,
  CameraState,
  PaletteIdx,
} from './types';
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
}

export interface EvolveResult {
  phase: number;
  morphPhase: number;
  orbitPhase: number;
  atmosphere: AtmosphereState;
  paletteIdx: PaletteIdx;
  iters: number;
}

const POLE = 0.85; // ~49° — varied elevation without slamming the poles

/** Phase clock for colour / atmosphere. */
const PHASE_RATE = 0.7;

/** Shape morph wave frequency — fast enough to read as living form. */
const MORPH_FREQ = 1.85;
const MORPH_FREQ2 = 1.05;

/**
 * Quasi-random satellite path — multi-harmonic yaw/pitch/zoom so the
 * global path never feels like a fixed circle.
 */
const GOLDEN = 0.6180339887;
const ORBIT = {
  azMin: 0.0045,
  azMax: 0.0095,
  zoomMin: 0.00035,
  zoomMax: 0.0009,
} as const;

interface EvolveBehavior {
  intensity: number;
  paramAmp: number;
  colorAmp: number;
  detailSwing: number;
}

/** Higher paramAmp so shape morph hits the full SDF band. */
const EVOLVE_CYCLE: EvolveBehavior[] = [
  { intensity: 0.65, paramAmp: 1.05, colorAmp: 1.0, detailSwing: 5.0 },
  { intensity: 0.82, paramAmp: 1.25, colorAmp: 1.15, detailSwing: 6.5 },
  { intensity: 0.95, paramAmp: 1.4, colorAmp: 1.3, detailSwing: 7.5 },
  { intensity: 1.1,  paramAmp: 1.55, colorAmp: 1.4, detailSwing: 8.5 },
];

const CYCLE_SEGMENT = 22;

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

function sampleOrbitPose(
  elapsed: number,
  seeds: CameraOrbit['seeds'],
  beh: EvolveBehavior,
): { rotX: number; rotY: number; zoom: number; azimuth: number } {
  const i = beh.intensity;
  const azSpeed = lerp(ORBIT.azMin, ORBIT.azMax, i) * seeds.azRateScale;
  const elSpeed = azSpeed * (0.35 + 0.25 * seeds.elRateScale);
  const zoomSpeed = lerp(ORBIT.zoomMin, ORBIT.zoomMax, i);

  const azWobble =
    Math.sin(elapsed * azSpeed * 0.37 + seeds.elPhase) * 0.28 +
    Math.sin(elapsed * azSpeed * GOLDEN + 1.7) * 0.18;
  const azimuth = elapsed * azSpeed * (1.0 + azWobble * 0.35) + seeds.azOffset;
  const rotY =
    azimuth +
    Math.sin(elapsed * azSpeed * 0.55 + seeds.zoomPhase) * 0.55 +
    Math.cos(elapsed * azSpeed * 1.37 + 0.9) * 0.32 +
    Math.sin(elapsed * azSpeed * 2.1 * GOLDEN + 2.4) * 0.18;

  const ep = elapsed * elSpeed + seeds.elPhase;
  const rotX =
    Math.sin(ep) * POLE * 0.55 +
    Math.sin(ep * GOLDEN + 1.2) * POLE * 0.32 +
    Math.cos(ep * 0.41 + 0.6) * POLE * 0.22 +
    Math.sin(ep * 1.73 + seeds.zoomPhase) * POLE * 0.12;

  const zoomAmp = 0.18 + i * 0.28;
  const zt = elapsed * zoomSpeed + seeds.zoomPhase;
  const zoom =
    Math.sin(zt) * zoomAmp * 0.5 +
    Math.sin(zt * seeds.zoomFreqA * 40.0 + 0.9) * zoomAmp * 0.28 +
    Math.cos(zt * seeds.zoomFreqB * 55.0 + 1.5) * zoomAmp * 0.18 +
    Math.sin(zt * seeds.zoomFreqC * 70.0 + 2.1) * zoomAmp * 0.12;

  return { rotX, rotY, zoom, azimuth };
}

function computeSmoothOrbit(
  orbit: CameraOrbit,
  elapsed: number,
  beh: EvolveBehavior,
  _fractalId: FractalId,
): void {
  // Subtract t=0 pose so a fractal/snapshot load starts at framing with zero
  // delta — avoids a huge random yaw jump that lerps fast-then-slow.
  const now = sampleOrbitPose(elapsed, orbit.seeds, beh);
  const zero = sampleOrbitPose(0, orbit.seeds, beh);

  orbit.azimuth = now.azimuth - zero.azimuth;
  orbit.rotY = now.rotY - zero.rotY;
  orbit.rotX = now.rotX - zero.rotX;
  orbit.zoom = now.zoom - zero.zoom;
  orbit.panX = 0;
  orbit.panY = 0;
}

function evolveAtmosphere(baseline: AtmosphereState, p: number, beh: EvolveBehavior): AtmosphereState {
  const a = beh.colorAmp;
  const f = 0.48;
  return {
    fov: clamp(
      baseline.fov +
        Math.sin(p * f) * 0.14 * a +
        Math.cos(p * f * 0.618 + 1) * 0.08 * a,
      1.0,
      2.15,
    ),
    fog: clamp(
      baseline.fog +
        Math.sin(p * f * 0.9 + 0.5) * 0.85 * a +
        Math.cos(p * f * 0.55) * 0.4 * a,
      0.08,
      2.4,
    ),
    gamma: clamp(
      baseline.gamma +
        Math.sin(p * f * 0.7 + 1.1) * 0.28 * a +
        Math.cos(p * f * 0.44 + 2.3) * 0.16 * a +
        Math.sin(p * f * 1.15 + 0.3) * 0.1 * a,
      0.28,
      1.15,
    ),
    vignette: clamp(
      baseline.vignette +
        Math.cos(p * f * 0.6) * 0.7 * a +
        Math.sin(p * f * 0.38 + 1.8) * 0.35 * a,
      0.25,
      2.2,
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

  const w1 = Math.sin(morphP * MORPH_FREQ);
  const w2 = Math.sin(morphP * MORPH_FREQ * 0.618 + 1.1);
  const w3 = Math.cos(morphP * MORPH_FREQ * 0.85 + 0.5);
  const w4 = Math.sin(morphP * MORPH_FREQ2 + 2.0);
  const w5 = Math.cos(morphP * MORPH_FREQ2 * 0.73 + 0.9);
  const w6 = Math.sin(morphP * MORPH_FREQ * 0.381 + 3.2);

  if (morph.power) {
    const rel = (w1 * 0.55 + w2 * 0.35 + w4 * 0.25 + w6 * 0.18) * 1.15 * a * morph.powerMul;
    const abs = (w3 * 3.6 + w5 * 2.2 + w6 * 1.4) * a * morph.powerMul * 0.55;
    tgt.power = clamp(
      baseline.power * (1 + rel) + abs,
      Math.max(2.5, baseline.power * 0.35),
      Math.min(15.5, baseline.power * 2.2),
    );
  } else {
    tgt.power = baseline.power;
  }

  if (morph.bailout) {
    const rel = (w3 * 0.55 + w2 * 0.4 + w5 * 0.3) * 0.85 * a * morph.bailoutMul;
    const abs = (w4 * 1.8 + w6 * 1.1) * a * morph.bailoutMul * 0.65;
    tgt.bailout = clamp(
      baseline.bailout * (1 + rel) + abs,
      Math.max(1.05, baseline.bailout * 0.4),
      Math.min(6.2, baseline.bailout * 2.4),
    );
  } else {
    tgt.bailout = baseline.bailout;
  }

  if (morph.warp) {
    const wx =
      (w1 * 0.6 + w3 * 0.4 + w4 * 0.35 + w6 * 0.22) * 1.65 * a * morph.warpMul +
      w5 * 0.75 * a * morph.warpMul;
    const wy =
      (w2 * 0.6 + w1 * 0.35 + w5 * 0.4 + w6 * 0.2) * 1.65 * a * morph.warpMul +
      w4 * 0.7 * a * morph.warpMul;
    tgt.cx = clamp(baseline.cx + wx, -1.45, 1.45);
    tgt.cy = clamp(baseline.cy + wy, -1.45, 1.45);
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
  const wave =
    Math.sin(morphP * 0.95) * beh.detailSwing +
    Math.cos(morphP * 0.62 + 0.8) * beh.detailSwing * 0.6 +
    Math.sin(morphP * 0.38 + 1.4) * beh.detailSwing * 0.35;
  return clamp(iters + wave * beh.paramAmp * 0.72 * morph.detailMul, 4, 64);
}

function morphColor(tgt: CameraState, baseline: CameraState, p: number, beh: EvolveBehavior): void {
  const a = beh.colorAmp;
  // Slow hue tour — colours linger and ease rather than flash
  const tour = ((p * 0.16) % 2 + 2) % 2;
  const saw = tour < 1 ? tour * 2 - 1 : 3 - tour * 2;
  tgt.glow = clamp(
    baseline.glow +
      saw * 0.85 * a +
      Math.sin(p * 0.35) * 0.22 * a +
      Math.cos(p * 0.22 + 1.4) * 0.14 * a,
    -0.15,
    2.2,
  );
  const brightWave =
    Math.sin(p * 0.28 + 0.6) * 0.55 * a +
    Math.cos(p * 0.18 + 1.4) * 0.3 * a;
  tgt.bright = clamp(baseline.bright + brightWave, 0.55, 3.0);
}

export function updateEvolveTargets(ctx: EvolveContext): EvolveResult {
  const { tgt, baseline, atmosphereBaseline, orbit, dt, evolveSpeed: spd, fractalId } = ctx;
  const morph = getEvolveMorph(fractalId);
  // All clocks follow Evolve Speed so lowering the dial slows camera + shape together
  const speedScale = spd / 0.3;
  const p      = ctx.evolvePhase + dt * spd * PHASE_RATE;
  const morphP = ctx.morphPhase  + dt * morph.morphRate * speedScale;
  const orbitP = ctx.orbitPhase  + dt * speedScale;
  const beh = resolveEvolveBehavior(p);

  computeSmoothOrbit(orbit, orbitP, beh, fractalId);

  // Azimuth-led satellite: yaw orbits, pitch nods around snapshot/preset framing
  tgt.rotY = baseline.rotY + orbit.rotY;
  tgt.rotX = clamp(baseline.rotX + orbit.rotX, -1.25, 1.25);
  tgt.zoom = clamp(baseline.zoom + orbit.zoom, 1, 12);
  tgt.panX = 0;
  tgt.panY = 0;

  morphFractalShape(tgt, baseline, morphP, beh, fractalId);
  morphColor(tgt, baseline, p, beh);

  return {
    phase: p,
    morphPhase: morphP,
    orbitPhase: orbitP,
    atmosphere: evolveAtmosphere(atmosphereBaseline, p, beh),
    paletteIdx: evolvePalette(ctx.paletteIdx, p, beh),
    iters: morphDetail(ctx.iters, morphP, beh, fractalId),
  };
}
