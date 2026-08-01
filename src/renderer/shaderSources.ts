import type { FractalId } from '@/fractals/types';
import { getFractalSlug } from '@/fractals/registry';

import headerSrc from './shaders/header.glsl?raw';
import footerSrc from './shaders/footer.glsl?raw';
import vertexSrc from './shaders/vertex.glsl?raw';

const fractalShaderLoaders: Record<string, () => Promise<{ default: string }>> = {
  mandelbulb: () => import('./shaders/fractals/mandelbulb.glsl?raw'),
  mandelbox: () => import('./shaders/fractals/mandelbox.glsl?raw'),
  nova: () => import('./shaders/fractals/nova.glsl?raw'),
  menger: () => import('./shaders/fractals/menger.glsl?raw'),
  apollonian: () => import('./shaders/fractals/apollonian.glsl?raw'),
  dodecahedron: () => import('./shaders/fractals/dodecahedron.glsl?raw'),
  sierpinski: () => import('./shaders/fractals/sierpinski.glsl?raw'),
  'pseudo-kleinian': () => import('./shaders/fractals/pseudo-kleinian.glsl?raw'),
  'kleinian-ifs': () => import('./shaders/fractals/kleinian-ifs.glsl?raw'),
  'quaternion-julia': () => import('./shaders/fractals/quaternion-julia.glsl?raw'),
  mandelbroth: () => import('./shaders/fractals/mandelbroth.glsl?raw'),
  'amazing-surf': () => import('./shaders/fractals/amazing-surf.glsl?raw'),
  kleinian: () => import('./shaders/fractals/kleinian.glsl?raw'),
  kifs: () => import('./shaders/fractals/kifs.glsl?raw'),
  kali: () => import('./shaders/fractals/kali.glsl?raw'),
};

export async function loadFractalShaderSource(fractalId: FractalId): Promise<string> {
  const slug = getFractalSlug(fractalId);
  const loader = fractalShaderLoaders[slug];
  if (!loader) throw new Error(`No shader loader for fractal: ${slug}`);
  const mod = await loader();
  return mod.default;
}

export async function loadShaderParts(fractalId: FractalId): Promise<{
  header: string;
  body: string;
  footer: string;
  vertex: string;
}> {
  const body = await loadFractalShaderSource(fractalId);
  return {
    header: headerSrc,
    body,
    footer: footerSrc,
    vertex: vertexSrc,
  };
}

export function assembleFragmentShader(header: string, body: string, footer: string): string {
  return `${header}\n${body}\n${footer}`;
}

if (import.meta.hot) {
  import.meta.hot.accept(
    [
      './shaders/header.glsl?raw',
      './shaders/footer.glsl?raw',
      './shaders/vertex.glsl?raw',
    ],
    () => {
      window.dispatchEvent(new Event('fractal-shader-hmr'));
    },
  );
}
