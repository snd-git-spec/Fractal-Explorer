import type {
  AtmosphereState,
  CameraState,
  FractalId,
  MacroState,
  PaletteIdx,
} from './types';
import {
  DEFAULT_ATMOSPHERE,
  DEFAULT_CAMERA,
  DEFAULT_MACROS,
  clampPaletteIdx,
} from './types';

const SEED_VERSION = 1;

interface SeedPayload {
  v: number;
  f: FractalId;
  p: PaletteIdx;
  m: MacroState;
  c: Pick<CameraState, 'rotX' | 'rotY' | 'zoom' | 'panX' | 'panY' | 'power' | 'bailout' | 'cx' | 'cy' | 'glow' | 'bright'>;
  a: AtmosphereState;
  i: number;
  e: number;
}

function clampByte(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n * 255)));
}

function encodeFloat(n: number, min: number, max: number): number {
  return clampByte((n - min) / (max - min));
}

function decodeFloat(b: number, min: number, max: number): number {
  return min + (b / 255) * (max - min);
}

export function encodeSeed(state: {
  fractalId: FractalId;
  paletteIdx: PaletteIdx;
  macros: MacroState;
  runtime: { tgt: CameraState };
  atmosphere: AtmosphereState;
  iters: number;
  evolveSpeed: number;
}): string {
  const payload: SeedPayload = {
    v: SEED_VERSION,
    f: state.fractalId,
    p: state.paletteIdx,
    m: state.macros,
    c: { ...state.runtime.tgt },
    a: state.atmosphere,
    i: state.iters,
    e: state.evolveSpeed,
  };

  const bytes = new Uint8Array(32);
  bytes[0] = payload.v;
  bytes[1] = payload.f;
  bytes[2] = payload.p;
  bytes[3] = clampByte(payload.m.pulse);
  bytes[4] = clampByte(payload.m.depth);
  bytes[5] = clampByte(payload.m.drift);
  bytes[6] = clampByte(payload.m.void);
  bytes[7] = encodeFloat(payload.c.rotX, -1.5, 1.5);
  bytes[8] = encodeFloat(payload.c.rotY, -3.14, 3.14);
  bytes[9] = encodeFloat(payload.c.zoom, 0.2, 12);
  bytes[10] = encodeFloat(payload.c.power, 2, 16);
  bytes[11] = encodeFloat(payload.c.bailout, 1, 6);
  bytes[12] = encodeFloat(payload.c.cx, -1.5, 1.5);
  bytes[13] = encodeFloat(payload.c.cy, -1.5, 1.5);
  bytes[14] = encodeFloat(payload.c.glow, 0, 1);
  bytes[15] = encodeFloat(payload.c.bright, 0.1, 3);
  bytes[16] = encodeFloat(payload.a.fov, 0.8, 2.5);
  bytes[17] = encodeFloat(payload.a.fog, 0.2, 2.5);
  bytes[18] = encodeFloat(payload.a.gamma, 0.3, 0.7);
  bytes[19] = encodeFloat(payload.a.vignette, 0.3, 2);
  bytes[20] = payload.i;
  bytes[21] = clampByte(payload.e / 2);

  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function decodeSeed(seed: string): Partial<{
  fractalId: FractalId;
  paletteIdx: PaletteIdx;
  macros: MacroState;
  camera: CameraState;
  atmosphere: AtmosphereState;
  iters: number;
  evolveSpeed: number;
}> | null {
  try {
    const padded = seed.replace(/-/g, '+').replace(/_/g, '/');
    const pad = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4));
    const binary = atob(padded + pad);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    if (bytes[0] !== SEED_VERSION || bytes.length < 22) return null;

    return {
      fractalId: bytes[1] as FractalId,
      paletteIdx: clampPaletteIdx(bytes[2]),
      macros: {
        pulse: bytes[3] / 255,
        depth: bytes[4] / 255,
        drift: bytes[5] / 255,
        void: bytes[6] / 255,
      },
      camera: {
        ...DEFAULT_CAMERA,
        rotX: decodeFloat(bytes[7], -1.5, 1.5),
        rotY: decodeFloat(bytes[8], -3.14, 3.14),
        zoom: decodeFloat(bytes[9], 0.2, 12),
        power: decodeFloat(bytes[10], 2, 16),
        bailout: decodeFloat(bytes[11], 1, 6),
        cx: decodeFloat(bytes[12], -1.5, 1.5),
        cy: decodeFloat(bytes[13], -1.5, 1.5),
        glow: decodeFloat(bytes[14], 0, 1),
        bright: decodeFloat(bytes[15], 0.1, 3),
      },
      atmosphere: {
        fov: decodeFloat(bytes[16], 0.8, 2.5),
        fog: decodeFloat(bytes[17], 0.2, 2.5),
        gamma: decodeFloat(bytes[18], 0.3, 0.7),
        vignette: decodeFloat(bytes[19], 0.3, 2),
      },
      iters: bytes[20],
      evolveSpeed: (bytes[21] / 255) * 2,
    };
  } catch {
    return null;
  }
}

export function getSeedFromUrl(): string | null {
  const hash = window.location.hash;
  const match = hash.match(/[#&]seed=([^&]+)/);
  return match ? match[1] : null;
}

export function setSeedInUrl(seed: string): void {
  const url = new URL(window.location.href);
  url.hash = `seed=${seed}`;
  window.history.replaceState(null, '', url.toString());
}

export { DEFAULT_MACROS, DEFAULT_ATMOSPHERE, DEFAULT_CAMERA };
