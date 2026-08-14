import type { CameraState, FractalId, ViewAnchor } from './types';

export interface FractalCameraPreset {
  zoom?: number;
  rotX?: number;
  rotY?: number;
  panX?: number;
  panY?: number;
  /** Optional shape dial defaults applied after macros on fractal switch. */
  power?: number;
  bailout?: number;
  cx?: number;
  cy?: number;
}

/** Per-fractal default framing — camera orbits the origin at these angles. */
export const FRACTAL_CAMERA_PRESETS: Partial<Record<FractalId, FractalCameraPreset>> = {
  0: { zoom: 1.4, rotX: 0.2, rotY: 0.0 },
  1: { zoom: 5.5, rotX: 0.45, rotY: 0.75 },
  2: { zoom: 4.2, rotX: 0.3, rotY: 0.5 },
  3: { zoom: 3.5, rotX: 0.3, rotY: 0.45 },
  4: { zoom: 1.8, rotX: 0.25, rotY: 0.4 },
  5: { zoom: 2.1, rotX: 0.32, rotY: 0.6, power: 8.5, bailout: 2.8, cx: 0.15, cy: -0.12 },
  6: { zoom: 5.0, rotX: 0.3, rotY: 0.5 },
  7: { zoom: 3.8, rotX: 0.4, rotY: 0.65 },
  8: { zoom: 2.2, rotX: 0.22, rotY: 0.38 },
  9: { zoom: 3.2, rotX: 0.35, rotY: 0.55 },
  10: { zoom: 3.0, rotX: 0.2, rotY: 0.3 },
  11: { zoom: 0.2, rotX: 0.35, rotY: 0.55 },
  12: { zoom: 1.8, rotX: 0.38, rotY: 0.65 },
  13: { zoom: 2.4, rotX: 0.25, rotY: 0.42, power: 2.2 },
  14: { zoom: 2.8, rotX: 0.55, rotY: 0.7 },
  15: { zoom: 0.05, rotX: 0.42, rotY: 0.75 },
  16: { zoom: 1.7, rotX: 0.5, rotY: 0.85 },
  17: { zoom: 0.2, rotX: 0.4, rotY: 0.75 },
  18: {
    zoom: 4.7,
    rotX: 1.28,
    rotY: -3.55,
    panX: 0.62,
    panY: -0.48,
    power: 10,
    bailout: 3.1,
    cx: 0.28,
    cy: 0.85,
  },
};

export function applyFractalPreset(
  tgt: CameraState,
  fractalId: FractalId,
): ViewAnchor {
  const preset = FRACTAL_CAMERA_PRESETS[fractalId];
  if (!preset) {
    return {
      rotX: tgt.rotX,
      rotY: tgt.rotY,
      panX: tgt.panX,
      panY: tgt.panY,
      zoom: tgt.zoom,
    };
  }

  if (preset.zoom !== undefined) tgt.zoom = preset.zoom;
  if (preset.rotX !== undefined) tgt.rotX = preset.rotX;
  if (preset.rotY !== undefined) tgt.rotY = preset.rotY;
  if (preset.power !== undefined) tgt.power = preset.power;
  if (preset.bailout !== undefined) tgt.bailout = preset.bailout;
  if (preset.cx !== undefined) tgt.cx = preset.cx;
  if (preset.cy !== undefined) tgt.cy = preset.cy;
  tgt.panX = preset.panX ?? 0;
  tgt.panY = preset.panY ?? 0;

  return {
    rotX: tgt.rotX,
    rotY: tgt.rotY,
    panX: tgt.panX,
    panY: tgt.panY,
    zoom: tgt.zoom,
  };
}

export function snapCameraToView(state: CameraState, view: ViewAnchor): void {
  state.rotX = view.rotX;
  state.rotY = view.rotY;
  state.panX = view.panX;
  state.panY = view.panY;
  state.zoom = view.zoom;
}
