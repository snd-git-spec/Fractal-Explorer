import type { FractalId, FractalMeta } from './types';

export const FRACTALS: FractalMeta[] = [
  { id: 0, slug: 'mandelbulb', name: 'Mandelbulb', label: 'Power-N Spherical', equation: 'z → zⁿ + c  ·  Mandelbulb: Spherical Power-N (White & Nylander, 2009)' },
  { id: 1, slug: 'mandelbox', name: 'Mandelbox', label: 'Infinite Box Sponge', equation: 'Box-fold ∘ Sphere-fold → z·s + c  ·  Mandelbox sponge (scale≈2) — nested boxes forever' },
  { id: 2, slug: 'nova', name: 'Nova / Newton', label: '3-Petal Newton', equation: 'z → z − (z³−1)/(3z²) + c  ·  Nova/Newton Fractal — 3-petal convergence basins' },
  { id: 3, slug: 'menger', name: 'Menger Sponge', label: 'IFS Cross Fold', equation: 'IFS Cross-Subtraction  ·  Menger Sponge' },
  { id: 4, slug: 'apollonian', name: 'Apollonian', label: 'Inversive Spheres', equation: 'Inversive Spheres: p→p·k/|p|²  ·  Apollonian Gasket' },
  { id: 5, slug: 'dodecahedron', name: 'Dodecahedron IFS', label: '5-fold Pentagonal', equation: 'Reflect through dodecahedron face planes × scale  ·  Dodecahedral IFS (5-fold)' },
  { id: 6, slug: 'sierpinski', name: 'Sierpinski', label: 'Tetrahedron IFS', equation: 'IFS Fold to Nearest Vertex × 2ⁿ  ·  Sierpiński Tetrahedron' },
  { id: 7, slug: 'pseudo-kleinian', name: 'Pseudo Kleinian', label: 'Julia-Box Lattice', equation: 'Box-fold ∘ Sphere-fold + C → plane trap  ·  Pseudo Kleinian (Knighty / Theli-at)' },
  { id: 8, slug: 'kleinian-ifs', name: 'Kleinian IFS', label: 'Möbius Limit Set', equation: 'Octahedral sort + scale  ·  Kleinian IFS — stellated spiky lattice' },
  { id: 9, slug: 'quaternion-julia', name: 'Quaternion Julia', label: '4D Cross-Section', equation: 'q → q² + c in ℍ, slice at w=k  ·  Quaternion Julia Set (Hart, 1989)' },
  { id: 10, slug: 'mandelbroth', name: 'Mandelbroth', label: 'Bulb × Box Hybrid', equation: 'Odd steps: z→zⁿ+c (Bulb) · Even steps: box-fold+sphere-fold (Box)  ·  Mandelbroth — two formulas fighting each iteration' },
  { id: 11, slug: 'amazing-surf', name: 'Amazing Surf', label: '2D-fold Layers', equation: '2D box-fold + sphere-fold + scale  ·  Amazing Surf (Kali, 2012)' },
  { id: 12, slug: 'kleinian', name: 'Kleinian', label: 'Möbius Group', equation: 'Box-fold + sphere inversion × s  ·  Kleinian Group — Möbius limit set' },
  { id: 13, slug: 'kifs', name: 'KIFS', label: 'Kaleidoscopic Folds', equation: 'Abs-fold ∘ Rotate ∘ Scale − Offset  ·  Kaleidoscopic IFS (Knighty / Syntopia)' },
  { id: 14, slug: 'kali', name: 'Kali Set', label: 'Inversion Julia', equation: 'p → |p|/|p|² − C  ·  Kali Set (Fragmentarium) — morphing cavern lattice' },
];

export function getFractalById(id: FractalId): FractalMeta {
  return FRACTALS[id];
}

export function getFractalSlug(id: FractalId): string {
  return FRACTALS[id].slug;
}
