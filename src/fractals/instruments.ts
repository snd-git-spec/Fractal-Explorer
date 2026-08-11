import type {
  AtmosphereState,
  CameraState,
  FractalId,
  MacroState,
  PaletteIdx,
} from './types';

export interface MacroWeights {
  pulsePower: number;
  pulseBailout: number;
  pulseBright: number;
  pulseWarpX: number;
  pulseWarpY: number;
  depthPower: number;
  depthIters: number;
  depthZoom: number;
  driftSpeed: number;
  driftGlow: number;
  driftWarpX: number;
  driftWarpY: number;
  voidFov: number;
  voidFog: number;
  voidGamma: number;
  voidVignette: number;
}

export interface ParamLabels {
  power: string;
  bailout: string;
  cx: string;
  cy: string;
  glow: string;
  bright: string;
  zoom: string;
  hideBailout?: boolean;
  hideWarp?: boolean;
}

export interface FractalSnapshot {
  name: string;
  macros: MacroState;
  camera?: Partial<CameraState>;
  atmosphere?: Partial<AtmosphereState>;
  palette?: PaletteIdx;
}

export interface RemixRanges {
  pulse: [number, number];
  depth: [number, number];
  drift: [number, number];
  void: [number, number];
}

export interface FractalInstrument {
  labels: ParamLabels;
  macroWeights: MacroWeights;
  snapshots: FractalSnapshot[];
  remixRanges: RemixRanges;
}

const DEFAULT_WEIGHTS: MacroWeights = {
  pulsePower: 1.0,
  pulseBailout: 0.85,
  pulseBright: 0.75,
  pulseWarpX: 0, // unused — Drift owns warp
  pulseWarpY: 0,
  depthPower: 0, // unused — Pulse owns shape
  depthIters: 1.0,
  depthZoom: 0.6,
  driftSpeed: 1.0,
  driftGlow: 1.0,
  driftWarpX: 1.0,
  driftWarpY: 1.0,
  voidFov: 1.0,
  voidFog: 1.0,
  voidGamma: 0.9,
  voidVignette: 1.0,
};

const DEFAULT_LABELS: ParamLabels = {
  power: 'Shape',
  bailout: 'Density',
  cx: 'Warp X',
  cy: 'Warp Y',
  glow: 'Colour Shift',
  bright: 'Brightness',
  zoom: 'Zoom',
};

const DEFAULT_REMIX: RemixRanges = {
  pulse: [0.2, 0.85],
  depth: [0.25, 0.9],
  drift: [0.15, 0.75],
  void: [0.2, 0.8],
};

function inst(
  partial: {
    labels?: Partial<ParamLabels>;
    macroWeights?: Partial<MacroWeights>;
    remixRanges?: RemixRanges;
    snapshots: FractalSnapshot[];
  },
): FractalInstrument {
  return {
    macroWeights: { ...DEFAULT_WEIGHTS, ...partial.macroWeights },
    remixRanges: partial.remixRanges ?? DEFAULT_REMIX,
    labels: { ...DEFAULT_LABELS, ...partial.labels },
    snapshots: partial.snapshots,
  };
}

const INSTRUMENTS: Record<FractalId, FractalInstrument> = {
  0: inst({
    labels: { power: 'Spikiness', bailout: 'Escape', cx: 'Lobe Spin', cy: 'Pole Stretch' },
    macroWeights: { pulsePower: 1.0, depthIters: 0.85, pulseWarpX: 0.85, pulseWarpY: 0.75, driftWarpX: 0.70, driftWarpY: 0.65 },
    snapshots: [
      { name: 'Neon Spire', macros: { pulse: 0.85, depth: 0.7, drift: 0.5, void: 0.35 }, camera: { power: 11, zoom: 2.5 }, palette: 1 },
      { name: 'Deep Bulb', macros: { pulse: 0.4, depth: 0.9, drift: 0.2, void: 0.7 }, camera: { zoom: 3.5 }, palette: 0 },
      { name: 'Electric Storm', macros: { pulse: 0.75, depth: 0.5, drift: 0.85, void: 0.25 }, palette: 3 },
    ],
  }),
  1: inst({
    labels: { power: 'Fold Scale', bailout: 'Wall Density', cx: 'Offset X', cy: 'Offset Y' },
    macroWeights: { pulsePower: 0.7, depthZoom: 0.35, depthIters: 0.7, pulseWarpX: 0.35, pulseWarpY: 0.35 },
    snapshots: [
      {
        name: 'Cathedral',
        macros: { pulse: 0.45, depth: 0.5, drift: 0.35, void: 0.3 },
        camera: { zoom: 5.5, rotX: 0.45, rotY: 0.75, power: 7.0, bailout: 2.2, cx: -0.15, cy: 0.1 },
        palette: 0,
      },
      {
        name: 'Neon Coral',
        macros: { pulse: 0.85, depth: 0.45, drift: 0.75, void: 0.2 },
        camera: { zoom: 4.6, rotX: 0.55, rotY: 1.05, power: 12.5, bailout: 4.2, cx: 0.85, cy: -0.55 },
        palette: 1,
      },
      {
        name: 'Crystal Void',
        macros: { pulse: 0.4, depth: 0.7, drift: 0.25, void: 0.45 },
        camera: { zoom: 6.5, rotX: 0.3, rotY: 0.45, power: 4.5, bailout: 1.6, cx: -0.45, cy: 0.7 },
        palette: 3,
      },
    ],
  }),
  2: inst({
    labels: { power: 'Petals', bailout: 'Cell Size', cx: 'Nova X', cy: 'Nova Y' },
    macroWeights: { pulseWarpX: 0.85, pulseWarpY: 0.85, pulsePower: 0.55, depthIters: 0.35, depthZoom: 0.5 },
    snapshots: [
      { name: 'Three Petals', macros: { pulse: 0.5, depth: 0.55, drift: 0.4, void: 0.45 }, camera: { cx: 0.15, cy: 0.25 }, palette: 1 },
      { name: 'Newton Drift', macros: { pulse: 0.4, depth: 0.5, drift: 0.7, void: 0.4 }, palette: 0 },
    ],
  }),
  3: inst({
    labels: { power: 'Scale', bailout: 'Void Gap', cx: 'Branching', cy: 'Cross Width', hideBailout: true },
    macroWeights: { pulsePower: 0.2, depthIters: 1.0, depthZoom: 0.95, pulseWarpX: 0.45, pulseWarpY: 0.4 },
    snapshots: [
      { name: 'Sponge Core', macros: { pulse: 0.4, depth: 0.95, drift: 0.2, void: 0.5 }, camera: { zoom: 3 }, palette: 0 },
      { name: 'Lattice', macros: { pulse: 0.3, depth: 0.85, drift: 0.35, void: 0.65 }, camera: { zoom: 5 }, palette: 2 },
    ],
  }),
  4: inst({
    labels: { power: 'Inversion', bailout: 'Sphere Gap', cx: 'Twist X', cy: 'Twist Y' },
    macroWeights: { pulsePower: 0.85, depthZoom: 0.7, driftWarpX: 0.6 },
    snapshots: [
      { name: 'Gasket', macros: { pulse: 0.55, depth: 0.75, drift: 0.3, void: 0.55 }, camera: { zoom: 4 }, palette: 0 },
      { name: 'Bubble Storm', macros: { pulse: 0.8, depth: 0.5, drift: 0.65, void: 0.3 }, palette: 1 },
    ],
  }),
  5: inst({
    labels: { power: 'Recursion', bailout: 'Size', cx: 'Spin', cy: 'Stretch' },
    macroWeights: {
      pulsePower: 1.2,
      pulseBailout: 1.1,
      depthIters: 1.35,
      depthZoom: 0,
      driftWarpX: 1.5,
      driftWarpY: 1.45,
      voidFog: 0.45,
      voidFov: 0.55,
      voidVignette: 0.65,
    },
    remixRanges: {
      pulse: [0.4, 0.92],
      depth: [0.5, 0.95],
      drift: [0.35, 0.9],
      void: [0.2, 0.55],
    },
    snapshots: [
      {
        name: 'Solid Nest',
        macros: { pulse: 0.5, depth: 0.9, drift: 0.4, void: 0.28 },
        camera: { zoom: 1.7, rotX: 0.45, rotY: 0.85, power: 7.0, bailout: 2.6, cx: 0.25, cy: -0.2 },
        atmosphere: { fog: 0.28, fov: 1.35, gamma: 0.55, vignette: 0.65 },
        palette: 2,
      },
      {
        name: 'Out of Itself',
        macros: { pulse: 0.75, depth: 0.95, drift: 0.7, void: 0.25 },
        camera: { zoom: 1.45, rotX: 0.4, rotY: 1.1, power: 11.5, bailout: 3.8, cx: 0.8, cy: -0.65 },
        atmosphere: { fog: 0.25, fov: 1.4, gamma: 0.55, vignette: 0.6 },
        palette: 0,
      },
    ],
  }),
  6: inst({
    labels: { power: 'Fold Scale', bailout: 'Grid Size', cx: 'Vertex Twist', cy: 'Vertex Tilt' },
    macroWeights: { pulsePower: 0.75, depthIters: 0.9, depthZoom: 0.7, pulseWarpX: 0.8, pulseWarpY: 0.75, driftWarpX: 0.6, driftWarpY: 0.55 },
    snapshots: [
      { name: 'Tetra Face', macros: { pulse: 0.35, depth: 0.85, drift: 0.3, void: 0.55 }, camera: { zoom: 5, rotX: 0.3, rotY: 0.5 }, palette: 0 },
      { name: 'Sierpinski Deep', macros: { pulse: 0.4, depth: 0.95, drift: 0.2, void: 0.7 }, camera: { zoom: 5.5 }, palette: 3 },
    ],
  }),
  7: inst({
    labels: { power: 'Sphere Fold', bailout: 'Box Fold', cx: 'Julia X', cy: 'Julia Y' },
    macroWeights: {
      pulsePower: 0.7,
      pulseBailout: 0.75,
      pulseWarpX: 0.9,
      pulseWarpY: 0.9,
      driftWarpX: 0.75,
      driftWarpY: 0.75,
      depthIters: 0.5,
      depthZoom: 0.35,
      voidFov: 0.4,
    },
    snapshots: [
      {
        name: 'Lattice',
        macros: { pulse: 0.45, depth: 0.55, drift: 0.35, void: 0.35 },
        camera: { zoom: 3.2, rotX: 0.55, rotY: 0.85, power: 8.0, bailout: 2.4, cx: -0.2, cy: 0.15 },
        palette: 0,
      },
      {
        name: 'Drift',
        macros: { pulse: 0.7, depth: 0.5, drift: 0.75, void: 0.28 },
        camera: { zoom: 2.6, rotX: 0.65, rotY: 1.1, power: 11.0, bailout: 3.5, cx: 0.7, cy: -0.45 },
        palette: 1,
      },
    ],
  }),
  8: inst({
    labels: { power: 'Spike Scale', bailout: 'Sort Gap', cx: 'Phase X', cy: 'Phase Y' },
    macroWeights: { pulsePower: 0.7, depthIters: 0.85, depthZoom: 0.8 },
    snapshots: [
      { name: 'Stellated', macros: { pulse: 0.65, depth: 0.8, drift: 0.45, void: 0.4 }, palette: 3 },
      { name: 'Limit Set', macros: { pulse: 0.45, depth: 0.9, drift: 0.25, void: 0.65 }, palette: 0 },
    ],
  }),
  9: inst({
    labels: { power: '4D Twist', bailout: 'Slice Tilt', cx: 'Julia X', cy: 'Julia Y' },
    macroWeights: {
      pulsePower: 1.0,
      pulseBailout: 0.85,
      pulseWarpX: 1.0,
      pulseWarpY: 1.0,
      driftWarpX: 0.8,
      driftWarpY: 0.8,
      depthIters: 0.8,
      depthZoom: 0.55,
    },
    snapshots: [
      { name: '4D Slice', macros: { pulse: 0.55, depth: 0.65, drift: 0.45, void: 0.4 }, camera: { zoom: 3.2 }, palette: 1 },
      { name: 'Quaternion Dream', macros: { pulse: 0.7, depth: 0.55, drift: 0.75, void: 0.5 }, camera: { cx: 0.25, cy: -0.2 }, palette: 3 },
    ],
  }),
  10: inst({
    labels: { power: 'Hybrid Power', bailout: 'Fold Escape', cx: 'Blend X', cy: 'Blend Y' },
    macroWeights: { pulsePower: 1.0, pulseBailout: 0.7, depthIters: 0.8, driftSpeed: 0.9 },
    snapshots: [
      { name: 'Bulb vs Box', macros: { pulse: 0.7, depth: 0.75, drift: 0.6, void: 0.4 }, palette: 1 },
      { name: 'Fractal Fight', macros: { pulse: 0.85, depth: 0.6, drift: 0.8, void: 0.25 }, palette: 1 },
    ],
  }),
  11: inst({
    labels: { power: 'Layer Scale', bailout: 'Surf Gap', cx: 'Fold Width', cy: 'Fold Depth' },
    macroWeights: { pulsePower: 0.85, depthIters: 0.75, depthZoom: 0.6, pulseWarpX: 0.7, pulseWarpY: 0.65, driftWarpX: 0.5, driftWarpY: 0.5 },
    snapshots: [
      { name: 'Amazing', macros: { pulse: 0.6, depth: 0.7, drift: 0.45, void: 0.5 }, camera: { zoom: 0.2, rotX: 0.35, rotY: 0.55 }, palette: 2 },
      { name: 'Surf Layers', macros: { pulse: 0.75, depth: 0.85, drift: 0.35, void: 0.55 }, camera: { zoom: 0.2, rotX: 0.4, rotY: 0.7 }, palette: 0 },
    ],
  }),
  12: inst({
    labels: { power: 'Möbius Scale', bailout: 'Group Gap', cx: 'Transform X', cy: 'Transform Y' },
    macroWeights: { pulsePower: 0.8, pulseWarpX: 0.75, pulseWarpY: 0.75, depthIters: 0.7 },
    snapshots: [
      { name: 'Limit Group', macros: { pulse: 0.5, depth: 0.75, drift: 0.4, void: 0.6 }, palette: 0 },
      { name: 'Möbius Web', macros: { pulse: 0.7, depth: 0.65, drift: 0.55, void: 0.35 }, palette: 1 },
    ],
  }),
  13: inst({
    labels: { power: 'Fold Scale', bailout: 'Domain Size', cx: 'Twist X', cy: 'Twist Y' },
    macroWeights: {
      pulsePower: 0.85,
      pulseBailout: 0.5,
      pulseWarpX: 0.9,
      pulseWarpY: 1.1,
      driftWarpX: 0.7,
      driftWarpY: 0.85,
      depthIters: 0.75,
      depthZoom: 0,
    },
    snapshots: [
      { name: 'Kaleido', macros: { pulse: 0.55, depth: 0.55, drift: 0.4, void: 0.4 }, camera: { zoom: 2.4, rotX: 0.25, rotY: 0.42 }, palette: 0 },
      { name: 'Spin Fold', macros: { pulse: 0.7, depth: 0.5, drift: 0.75, void: 0.3 }, camera: { zoom: 2.1, rotX: 0.35, rotY: 0.65 }, palette: 1 },
      { name: 'Crystal Spire', macros: { pulse: 0.4, depth: 0.65, drift: 0.35, void: 0.5 }, camera: { zoom: 2.8, rotX: 0.18, rotY: 0.32 }, palette: 3 },
    ],
  }),
  14: inst({
    labels: { power: 'Centre Drift', bailout: 'Clamp Band', cx: 'Kali X', cy: 'Kali Y' },
    macroWeights: {
      pulsePower: 0.7,
      pulseBailout: 0.65,
      pulseWarpX: 1.0,
      pulseWarpY: 1.0,
      driftWarpX: 0.85,
      driftWarpY: 0.85,
      depthIters: 0.65,
      depthZoom: 0,
    },
    snapshots: [
      { name: 'Cavern', macros: { pulse: 0.45, depth: 0.5, drift: 0.5, void: 0.35 }, camera: { zoom: 2.8, rotX: 0.55, rotY: 0.7 }, palette: 0 },
      { name: 'Neon Vein', macros: { pulse: 0.65, depth: 0.45, drift: 0.7, void: 0.25 }, camera: { zoom: 2.5, rotX: 0.65, rotY: 0.9 }, palette: 1 },
      { name: 'Deep Kali', macros: { pulse: 0.55, depth: 0.6, drift: 0.4, void: 0.45 }, camera: { zoom: 3.4, rotX: 0.4, rotY: 0.5 }, palette: 3 },
    ],
  }),
  15: inst({
    labels: { power: 'Cross Ratio', bailout: 'Arm Thickness', cx: 'Cell Warp', cy: 'Fold Warp' },
    macroWeights: {
      pulsePower: 0.8,
      pulseBailout: 0.7,
      depthIters: 1.15,
      depthZoom: 0.45,
      pulseWarpX: 0.75,
      pulseWarpY: 0.7,
      voidFog: 0.45,
      voidVignette: 0.65,
    },
    snapshots: [
      {
        name: 'Temple',
        macros: { pulse: 0.45, depth: 1.0, drift: 0.3, void: 0.25 },
        camera: { zoom: 2.4, rotX: 0.42, rotY: 0.75 },
        atmosphere: { fog: 0.28, fov: 1.4, gamma: 0.55, vignette: 0.7 },
        palette: 0,
      },
      {
        name: 'Cross Void',
        macros: { pulse: 0.65, depth: 1.0, drift: 0.55, void: 0.22 },
        camera: { zoom: 2.1, rotX: 0.5, rotY: 0.95 },
        atmosphere: { fog: 0.25, fov: 1.45, gamma: 0.55, vignette: 0.65 },
        palette: 2,
      },
    ],
  }),
  16: inst({
    labels: { power: 'Cavern Scale', bailout: 'Vein Depth', cx: 'Phason X', cy: 'Phason Y' },
    macroWeights: {
      pulsePower: 0.8,
      pulseBailout: 0.75,
      depthIters: 1.0,
      driftWarpX: 1.0,
      driftWarpY: 0.95,
      driftGlow: 1.0,
      voidFov: 0.7,
      voidFog: 0.4,
      voidVignette: 0.6,
    },
    snapshots: [
      {
        name: 'Cathedral',
        macros: { pulse: 0.5, depth: 1.0, drift: 0.4, void: 0.25 },
        camera: { zoom: 1.9, rotX: 0.5, rotY: 0.85 },
        atmosphere: { fog: 0.28, fov: 1.45, gamma: 0.55, vignette: 0.65 },
        palette: 3,
      },
      {
        name: 'Phason Drift',
        macros: { pulse: 0.65, depth: 1.0, drift: 0.7, void: 0.22 },
        camera: { zoom: 1.9, rotX: 0.6, rotY: 1.1 },
        atmosphere: { fog: 0.25, fov: 1.5, gamma: 0.55, vignette: 0.6 },
        palette: 7,
      },
    ],
  }),
  17: inst({
    labels: {
      power: 'Mirror Boost',
      bailout: 'Sphere Radius',
      cx: 'Cusp Twist',
      cy: 'Phason',
    },
    macroWeights: {
      pulsePower: 0.85,
      pulseBailout: 0.8,
      pulseBright: 0.75,
      depthIters: 1.15,
      depthZoom: 0,
      driftWarpX: 1.0,
      driftWarpY: 0.95,
      driftGlow: 1.0,
      voidFov: 0.65,
      voidFog: 0.25,
      voidVignette: 0.5,
    },
    remixRanges: {
      pulse: [0.25, 0.75],
      depth: [0.45, 1.0],
      drift: [0.2, 0.65],
      void: [0.15, 0.4],
    },
    snapshots: [
      {
        name: 'Stained Glass',
        macros: { pulse: 0.5, depth: 1.0, drift: 0.35, void: 0.18 },
        camera: { zoom: 0.2, rotX: 0.4, rotY: 0.75 },
        atmosphere: { fog: 0.18, fov: 1.4, gamma: 0.52, vignette: 0.55 },
        palette: 3,
      },
      {
        name: 'Infinite Cusp',
        macros: { pulse: 0.65, depth: 1.0, drift: 0.5, void: 0.16 },
        camera: { zoom: 0.2, rotX: 0.5, rotY: 0.95 },
        atmosphere: { fog: 0.16, fov: 1.45, gamma: 0.52, vignette: 0.5 },
        palette: 1,
      },
    ],
  }),
};

export function getInstrument(fractalId: FractalId): FractalInstrument {
  return INSTRUMENTS[fractalId];
}

export function getSnapshots(fractalId: FractalId): FractalSnapshot[] {
  return INSTRUMENTS[fractalId].snapshots;
}
