import type { FractalId } from '@/fractals/types';
import {
  assembleFragmentShader,
  loadShaderParts,
} from './shaderSources';

function compileShader(
  gl: WebGLRenderingContext,
  src: string,
  type: number,
): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('Failed to create shader');
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader) ?? 'Unknown shader error';
    gl.deleteShader(shader);
    throw new Error(`Shader compile error: ${log}`);
  }
  return shader;
}

function linkProgram(
  gl: WebGLRenderingContext,
  vs: WebGLShader,
  fs: WebGLShader,
): WebGLProgram {
  const program = gl.createProgram();
  if (!program) throw new Error('Failed to create program');
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program) ?? 'Unknown link error';
    gl.deleteProgram(program);
    throw new Error(`Program link error: ${log}`);
  }
  return program;
}

export class ShaderCache {
  private cache = new Map<FractalId, WebGLProgram>();
  private loading = new Map<FractalId, Promise<WebGLProgram>>();

  constructor(private gl: WebGLRenderingContext) {}

  /** Drop a cached program so the next get() recompiles (e.g. after GLSL HMR). */
  invalidate(fractalId?: FractalId): void {
    if (fractalId !== undefined) {
      const prog = this.cache.get(fractalId);
      if (prog) this.gl.deleteProgram(prog);
      this.cache.delete(fractalId);
      return;
    }
    this.dispose();
  }

  async get(fractalId: FractalId): Promise<WebGLProgram> {
    const cached = this.cache.get(fractalId);
    if (cached) return cached;

    const pending = this.loading.get(fractalId);
    if (pending) return pending;

    const loadPromise = this.compile(fractalId);
    this.loading.set(fractalId, loadPromise);
    try {
      const program = await loadPromise;
      this.cache.set(fractalId, program);
      return program;
    } finally {
      this.loading.delete(fractalId);
    }
  }

  /** Force recompile of all fractals (GLSL HMR / hard refresh of sources). */
  clear(): void {
    this.invalidate();
  }

  private async compile(fractalId: FractalId): Promise<WebGLProgram> {
    const { header, body, footer, vertex } = await loadShaderParts(fractalId);
    const fsSource = assembleFragmentShader(header, body, footer);
    const vs = compileShader(this.gl, vertex, this.gl.VERTEX_SHADER);
    const fs = compileShader(this.gl, fsSource, this.gl.FRAGMENT_SHADER);
    return linkProgram(this.gl, vs, fs);
  }

  dispose(): void {
    for (const program of this.cache.values()) {
      this.gl.deleteProgram(program);
    }
    this.cache.clear();
    this.loading.clear();
  }
}