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
  // Slow global tour — full sphere, unhurried
  const byZoom = clamp(zoom / 3.2, 0.4, 0.8);
  if (fractalId === 5) return byZoom * 0.72; // Dodeca — readable shell dive + yaw (was near-frozen)
  if (fractalId === 16) return byZoom * 0.28; // Penrose — close φ-caverns read motion hot
  if (fractalId === 17) return byZoom * 0.38; // hyperbolic FOV reads motion hot
  if (fractalId === 18) return byZoom * 0.48;
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

/** Pitch clamp — near true poles (±~85°). Dodeca uses a milder cap (see apply). */
const POLE_MAX = 1.48;
/** Dodeca: stay off the poles so the tour glides through shells, not through the solid. */
const DODECA_POLE_MAX = 0.72;

/** Align orbit so the next frames continue from this pitch (no jump). */
export function syncSphereOrbitToPitch(orbit: CameraOrbit, rotX: number): void {
  const x = clamp(rotX, -POLE_MAX, POLE_MAX);
  orbit.rotX = x;
  orbit.azimuth = 0;
  orbit.rotY = 0;
  orbit.zoom = 0;
  orbit.roll = 0;
  // Running latitude phase — advanceFreeSphereOrbit integrates this each frame
  orbit.seeds.elPhase = Math.asin(clamp(x / POLE_MAX, -1, 1));
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
  const d = seeds.azDir || 1;

  // Dodeca: scale diving through recursive shells + steady yaw (readable motion)
  if (fractalId === 5) {
    const spin =
      lerp(0.028, 0.042, i) *
      d *
      (0.9 + 0.2 * seeds.azRateScale) *
      (1 + 0.12 * Math.sin(pathTime * 0.06 + seeds.azOffset));
    const elOmega =
      lerp(0.028, 0.042, i) * (0.9 + 0.25 * seeds.elRateScale);
    const zoomOmega = lerp(0.09, 0.14, i);
    // Relative zoom amplitude — applied vs baseline in updateEvolveTargets
    const zoomAmp = 0.78 + i * 0.18;
    return { spin, elOmega, zoomOmega, zoomAmp };
  }

  // Slow longitude — full meridians over minutes, not seconds
  const spinBase =
    lerp(0.022, 0.036, i) * (0.85 + 0.25 * seeds.azRateScale);
  const spin =
    spinBase *
    d *
    (1 +
      0.14 * Math.sin(pathTime * 0.08 + seeds.azOffset) +
      0.08 * Math.sin(pathTime * 0.05 * GOLDEN + seeds.zoomPhase));

  // Latitude still visits poles often relative to yaw (global, not equatorial)
  const elOmega =
    lerp(0.038, 0.058, i) * (0.85 + 0.3 * seeds.elRateScale);

  const zoomOmega = lerp(0.008, 0.012, i) * 0.6;
  const zoomAmp = 0.016 + i * 0.014;

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
  baselineZoom = 2.2,
): void {
  if (dt <= 0) return;

  const { spin, elOmega, zoomOmega, zoomAmp } = sphereRates(
    orbit.seeds,
    beh,
    fractalId,
    pathTime,
  );

  // Continuous longitude — never resets except on explicit gesture sync
  orbit.azimuth += dt * spin;
  orbit.seeds.elPhase += dt * elOmega;
  orbit.seeds.zoomPhase += dt * zoomOmega;

  if (fractalId === 5) {
    // Mild latitude — explore around the solid, don't plunge poles through it
    const e1 = Math.sin(orbit.seeds.elPhase);
    const e2 = Math.sin(orbit.seeds.elPhase * GOLDEN + orbit.seeds.azOffset);
    const lat = clamp(0.7 * e1 + 0.3 * e2, -1, 1);
    orbit.rotX = DODECA_POLE_MAX * lat;
    orbit.rotY = orbit.azimuth;
    // Scale-shell dive: large relative zoom so you travel nested generations
    const zPh = orbit.seeds.zoomPhase;
    orbit.zoom =
      baselineZoom *
      (Math.sin(zPh) * zoomAmp * 0.55 +
        Math.sin(zPh * 1.618 + 0.7) * zoomAmp * 0.28 +
        Math.sin(zPh * 0.37 + 1.9) * zoomAmp * 0.12);
  } else {
    // Dual incommensurate latitudes → dense sphere covering
    const e1 = Math.sin(orbit.seeds.elPhase);
    const e2 = Math.sin(orbit.seeds.elPhase * (1.0 + GOLDEN) + orbit.seeds.azOffset);
    const e3 = Math.sin(orbit.seeds.elPhase * GOLDEN * 2.3 + pathTime * 0.02);
    const lat = clamp(0.58 * e1 + 0.27 * e2 + 0.15 * e3, -1, 1);

    orbit.rotX = POLE_MAX * lat;
    orbit.rotY = orbit.azimuth;
    orbit.zoom =
      Math.sin(orbit.seeds.zoomPhase) * zoomAmp * 0.4 +
      Math.sin(orbit.seeds.zoomPhase * 1.7 + 0.9) * zoomAmp * 0.18;
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

    // Dodeca: absolute crawl inside lace band (was near-static vs baseline linger).
    // Power ↔ Scale (~1.88–2.22), bailout ↔ Size, cx/cy ↔ Stretch/Spin.
    const amp = 0.72 + 0.28 * a;
    const ph = morphP * 0.95;
    tgt.power = clamp(
      8.5 +
        Math.sin(ph) * 1.55 * amp +
        Math.sin(ph * 0.618 + 1.15) * 0.85 * amp +
        Math.sin(ph * 1.27 + 2.3) * 0.45 * amp,
      7.0,
      11.0,
    );
    tgt.bailout = clamp(
      2.75 +
        Math.sin(ph * 0.73 + 0.45) * 0.7 * amp +
        Math.cos(ph * 1.05 + 1.7) * 0.4 * amp,
      2.0,
      3.8,
    );
    tgt.cx = clamp(
      Math.sin(ph * 0.55 + 0.25) * 0.42 * amp +
        Math.cos(ph * 0.91 + 1.55) * 0.24 * amp,
      -0.58,
      0.58,
    );
    tgt.cy = clamp(
      Math.sin(ph * 0.48 + 2.0) * 0.4 * amp +
        Math.sin(ph * 1.02 + 0.55) * 0.22 * amp,
      -0.58,
      0.58,
    );
    return;
  }

  // Pseudo-Kleinian / Kleinian: crawl a safe cathedral band (never foam extremes)
  if (fractalId === 7 || fractalId === 12) {
    const amp = 0.55 + 0.25 * a;
    const ph = morphP * 0.85;
    if (fractalId === 7) {
      tgt.power = clamp(
        6.5 + Math.sin(ph) * 1.8 * amp + Math.sin(ph * 0.55 + 1.1) * 0.9 * amp,
        4.5,
        9.5,
      );
      tgt.bailout = clamp(
        2.3 + Math.sin(ph * 0.7 + 0.4) * 0.7 * amp + Math.cos(ph * 1.05 + 1.5) * 0.4 * amp,
        1.6,
        3.4,
      );
      tgt.cx = clamp(
        Math.sin(ph * 0.42 + 0.2) * 0.45 * amp + Math.cos(ph * 0.8 + 1.3) * 0.22 * amp,
        -0.65,
        0.65,
      );
      tgt.cy = clamp(
        Math.sin(ph * 0.38 + 1.7) * 0.42 * amp + Math.sin(ph * 0.9 + 0.5) * 0.2 * amp,
        -0.65,
        0.65,
      );
    } else {
      tgt.power = clamp(
        6.0 + Math.sin(ph) * 1.6 * amp + Math.sin(ph * 0.6 + 0.9) * 0.8 * amp,
        4.0,
        9.0,
      );
      tgt.bailout = clamp(
        2.2 + Math.sin(ph * 0.65 + 0.5) * 0.65 * amp + Math.cos(ph * 0.95 + 1.2) * 0.35 * amp,
        1.5,
        3.2,
      );
      tgt.cx = clamp(
        Math.sin(ph * 0.4 + 0.15) * 0.4 * amp + Math.cos(ph * 0.75 + 1.4) * 0.2 * amp,
        -0.6,
        0.6,
      );
      tgt.cy = clamp(
        Math.sin(ph * 0.36 + 1.8) * 0.38 * amp + Math.sin(ph * 0.88 + 0.4) * 0.18 * amp,
        -0.6,
        0.6,
      );
    }
    return;
  }

  // Tidefold: slow in-band crawl — continuous params, no thrashing snaps
  if (fractalId === 18) {
    const amp = 0.4 + 0.2 * a;
    const ph = morphP * 0.48;
    const baseP = Number.isFinite(baseline.power) ? baseline.power : 10.0;
    const baseB = Number.isFinite(baseline.bailout) ? baseline.bailout : 2.4;
    const baseX = Number.isFinite(baseline.cx) ? baseline.cx : 0.28;
    const baseY = Number.isFinite(baseline.cy) ? baseline.cy : -0.1;
    tgt.power = clamp(
      baseP +
        Math.sin(ph) * 1.1 * amp +
        Math.sin(ph * 0.618 + 1.1) * 0.55 * amp +
        Math.sin(ph * 1.2 + 2.0) * 0.3 * amp,
      7.5,
      12.5,
    );
    tgt.bailout = clamp(
      baseB +
        Math.sin(ph * 0.55 + 0.4) * 0.45 * amp +
        Math.cos(ph * 0.9 + 1.3) * 0.28 * amp,
      1.8,
      3.6,
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
      -0.7,
      0.7,
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
  const tourRate = fractalId === 5 ? 0.48 : 0.28;
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
    advanceFreeSphereOrbit(
      orbit,
      dt * speedScale * pace,
      orbitP,
      beh,
      fractalId,
      baseline.zoom,
    );

    tgt.rotY = baseline.rotY + orbit.azimuth;
    if (fractalId === 5) {
      // Mild pitch — recursion dive is in zoom, not polar punch-through
      tgt.rotX = clamp(orbit.rotX, -DODECA_POLE_MAX, DODECA_POLE_MAX);
      orbit.roll += dt * speedScale * 0.018;
      tgt.rotZ = (baseline.rotZ ?? 0) + orbit.roll;
      // Wide zoom band: pull out to large shells, dive into nested generations
      const zMin = Math.max(ZOOM_MIN, baseline.zoom * 0.2);
      const zMax = Math.max(zMin + 0.2, baseline.zoom * 3.2);
      tgt.zoom = clamp(baseline.zoom + orbit.zoom, zMin, zMax);
    } else {
      tgt.rotX = clamp(orbit.rotX, -POLE_MAX, POLE_MAX);
      orbit.roll += dt * speedScale * 0.026;
      tgt.rotZ = (baseline.rotZ ?? 0) + orbit.roll;
      const zMin = ZOOM_MIN;
      const zMax = Math.max(zMin + 0.04, baseline.zoom * 1.15);
      tgt.zoom = clamp(baseline.zoom + orbit.zoom, zMin, zMax);
    }
    tgt.panX = baseline.panX;
    tgt.panY = baseline.panY;
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
