import type { CameraState, FractalId, ViewAnchor } from './types';

export interface FractalCameraPreset {
  zoom?: number;
  rotX?: number;
  rotY?: number;
  panX?: number;
  panY?: number;
}

/** Per-fractal default framing — camera orbits the origin at these angles. */
export const FRACTAL_CAMERA_PRESETS: Partial<Record<FractalId, FractalCameraPreset>> = {
  0: { zoom: 1.4, rotX: 0.2, rotY: 0.0 },
  1: { zoom: 5.5, rotX: 0.45, rotY: 0.75 },
  2: { zoom: 4.2, rotX: 0.3, rotY: 0.5 },
  3: { zoom: 3.5, rotX: 0.3, rotY: 0.45 },
  4: { zoom: 1.8, rotX: 0.25, rotY: 0.4 },
  5: { zoom: 1.7, rotX: 0.45, rotY: 0.85 },
  6: { zoom: 5.0, rotX: 0.3, rotY: 0.5 },
  7: { zoom: 3.2, rotX: 0.55, rotY: 0.85 },
  8: { zoom: 2.2, rotX: 0.22, rotY: 0.38 },
  9: { zoom: 3.2, rotX: 0.35, rotY: 0.55 },
  10: { zoom: 3.0, rotX: 0.2, rotY: 0.3 },
  11: { zoom: 0.2, rotX: 0.35, rotY: 0.55 },
  12: { zoom: 4.5, rotX: 0.5, rotY: 0.8 },
  13: { zoom: 2.4, rotX: 0.25, rotY: 0.42 },
  14: { zoom: 2.8, rotX: 0.55, rotY: 0.7 },
  15: { zoom: 2.4, rotX: 0.42, rotY: 0.75 },
  16: { zoom: 1.9, rotX: 0.5, rotY: 0.85 },
  17: { zoom: 0.2, rotX: 0.4, rotY: 0.75 },
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
