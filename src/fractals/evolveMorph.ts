import type { FractalId } from './types';

/** Shape-evolution rate — high enough that folds visibly crawl at default evolve speed. */
export const FRACTAL_MORPH_RATE = 0.095;

/** Which uniforms drive each fractal's SDF — scales tune visible morph range. */
export interface EvolveMorphConfig {
  morphRate: number;
  power: boolean;
  bailout: boolean;
  warp: boolean;
  powerMul: number;
  bailoutMul: number;
  warpMul: number;
  detailMul: number;
}

const BASE: Omit<EvolveMorphConfig, 'powerMul' | 'bailoutMul' | 'warpMul' | 'detailMul'> = {
  morphRate: FRACTAL_MORPH_RATE,
  power: true,
  bailout: true,
  warp: true,
};

const MORPH: Record<FractalId, EvolveMorphConfig> = {
  // Mandelbulb: faster steady crawl (still in-band — no clamp parking)
  0: { ...BASE, morphRate: 0.092, powerMul: 1.0, bailoutMul: 1.0, warpMul: 1.0, detailMul: 1.35 },
  1: { ...BASE, powerMul: 3.8, bailoutMul: 3.0, warpMul: 4.2, detailMul: 2.8 },
  2: { ...BASE, powerMul: 1.8, bailoutMul: 1.6, warpMul: 2.4, detailMul: 0.5 },
  3: { ...BASE, powerMul: 3.0, bailoutMul: 2.0, warpMul: 2.6, detailMul: 2.8 },
  4: { ...BASE, powerMul: 3.2, bailoutMul: 1.9, warpMul: 2.5, detailMul: 2.6 },
  5: { ...BASE, morphRate: 0.16, powerMul: 1.0, bailoutMul: 1.0, warpMul: 1.0, detailMul: 1.5 },
  6: { ...BASE, powerMul: 3.0, bailoutMul: 1.9, warpMul: 2.6, detailMul: 2.8 },
  // PK: Julia C + plane trap snap hard when harmonics align — slower rate, softer amps
  7: {
    ...BASE,
    morphRate: 0.048,
    powerMul: 1.6,
    bailoutMul: 1.35,
    warpMul: 1.55,
    detailMul: 0.7,
  },
  8: { ...BASE, powerMul: 3.0, bailoutMul: 1.9, warpMul: 2.4, detailMul: 2.6 },
  9: { ...BASE, powerMul: 3.8, bailoutMul: 3.2, warpMul: 3.6, detailMul: 2.6 },
  10: { ...BASE, powerMul: 2.6, bailoutMul: 2.2, warpMul: 2.5, detailMul: 2.3 },
  11: { ...BASE, powerMul: 3.0, bailoutMul: 2.4, warpMul: 2.3, detailMul: 2.4 },
  12: { ...BASE, powerMul: 2.7, bailoutMul: 2.2, warpMul: 2.5, detailMul: 1.8 },
  13: { ...BASE, powerMul: 2.5, bailoutMul: 2.0, warpMul: 2.8, detailMul: 1.8 },
  14: { ...BASE, morphRate: 0.07, powerMul: 1.8, bailoutMul: 1.5, warpMul: 1.85, detailMul: 1.2 },
  15: { ...BASE, morphRate: 0.085, powerMul: 2.0, bailoutMul: 1.85, warpMul: 2.1, detailMul: 1.3 },
  16: { ...BASE, morphRate: 0.07, powerMul: 2.2, bailoutMul: 1.8, warpMul: 2.0, detailMul: 1.4 },
  17: { ...BASE, morphRate: 0.065, powerMul: 2.0, bailoutMul: 1.75, warpMul: 1.9, detailMul: 1.2 },
};

export function getEvolveMorph(fractalId: FractalId): EvolveMorphConfig {
  return MORPH[fractalId];
}
