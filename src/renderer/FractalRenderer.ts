import type { ExplorerStoreApi } from '@/state/ExplorerStore';
import type { AtmosphereState, FractalId } from '@/fractals/types';
import { DEFAULT_ATMOSPHERE } from '@/fractals/types';
import { applyMacrosToTarget } from '@/fractals/macroMapper';
import { updateEvolveTargets } from '@/fractals/evolveProfiles';
import { AdaptiveQuality } from './AdaptiveQuality';
import { CameraController } from './CameraController';
import {
  FpsCounter,
  lerpCameraState,
} from './RenderLoop';

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
import { ShaderCache } from './ShaderCache';
import {
  getUniformLocations,
  uploadUniforms,
  type UniformLocations,
} from './Uniforms';
import { PALETTE_COUNT } from '@/fractals/types';

export class FractalRenderer {
  private gl: WebGLRenderingContext | null = null;
  private shaderCache: ShaderCache | null = null;
  private camera: CameraController | null = null;
  private uniforms: UniformLocations | null = null;
  private rafId = 0;
  private lastTime = performance.now();
  private fpsCounter = new FpsCounter();
  private adaptive = new AdaptiveQuality();
  private currentFractalId: FractalId | null = null;
  private switching: Promise<void> | null = null;
  private disposed = false;
  private visible = true;
  private resizeHandler = () => this.resize();
  private visibilityHandler = () => this.onVisibilityChange();
  private smoothAtmosphere: AtmosphereState = { ...DEFAULT_ATMOSPHERE };
  private smoothPalette = 0;
  private smoothIters = 64;
  private prevAutoEvolve = false;
  /** Monotonic content clock (seconds). */
  private simTime = 0;
  /** True while pointer/touch is actively driving the camera. */
  private cameraGesturing = false;
  /** After gesture ends, keep satellite camera frozen until this time (ms). */
  private cameraHoldUntil = 0;

  /** Time constant for atmosphere / palette lerp (seconds). */
  private static readonly ATM_TAU = 2.0;
  /** Brief pause after release before satellite orbit resumes from the new framing. */
  private static readonly CAMERA_HOLD_MS = 1400;

  constructor(
    private canvas: HTMLCanvasElement,
    private store: ExplorerStoreApi,
  ) {}

  async init(): Promise<void> {
    // preserveDrawingBuffer helps canvas capture / readback during recording
    const attrs: WebGLContextAttributes = {
      preserveDrawingBuffer: true,
      alpha: false,
      antialias: false,
      powerPreference: 'high-performance',
    };
    const gl =
      (this.canvas.getContext('webgl', attrs) ||
        this.canvas.getContext('experimental-webgl', attrs)) as WebGLRenderingContext | null;

    if (!gl) throw new Error('WebGL not supported');

    this.gl = gl;
    this.shaderCache = new ShaderCache(gl);

    const quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
      gl.STATIC_DRAW,
    );

    this.camera = new CameraController(
      this.canvas,
      () => this.store.getState().runtime,
      (view) => this.store.getState().setViewAnchor(view),
      () => {
        this.cameraGesturing = true;
      },
      () => {
        this.cameraGesturing = false;
        this.cameraHoldUntil = performance.now() + FractalRenderer.CAMERA_HOLD_MS;
        // Satellite path restarts from the framing the user just set
        const cur = this.store.getState().runtime.cur;
        this.store.getState().setViewAnchor({
          rotX: cur.rotX,
          rotY: cur.rotY,
          zoom: cur.zoom,
          panX: cur.panX,
          panY: cur.panY,
        });
        this.store.getState().runtime.orbitPhase = 0;
      },
    );
    this.camera.attach();

    window.addEventListener('resize', this.resizeHandler);
    document.addEventListener('visibilitychange', this.visibilityHandler);
    this.resize();

    const fractalId = this.store.getState().fractalId;
    await this.switchFractal(fractalId);
  }

  start(): void {
    this.scheduleFrame();
  }

  private readonly loop = (now: number): void => {
    if (this.disposed || !this.visible) return;
    this.rafId = requestAnimationFrame(this.loop);
    void this.frame(now);
  };

  private scheduleFrame(): void {
    if (this.disposed || !this.visible) return;
    cancelAnimationFrame(this.rafId);
    this.rafId = requestAnimationFrame(this.loop);
  }

  private onVisibilityChange(): void {
    const hidden = document.hidden;
    this.visible = !hidden;
    if (hidden) {
      cancelAnimationFrame(this.rafId);
      this.rafId = 0;
      return;
    }
    this.lastTime = performance.now();
    this.scheduleFrame();
  }

  private async frame(now: number): Promise<void> {
    const gl = this.gl;
    if (!gl || !this.uniforms || !this.visible) return;

    const state = this.store.getState();
    const fractalId = state.fractalId;

    if (fractalId !== this.currentFractalId && !this.switching) {
      this.switching = this.switchFractal(fractalId).finally(() => {
        this.switching = null;
      });
    }
    if (this.switching) {
      await this.switching;
    }

    const wallDt = Math.min(0.1, (now - this.lastTime) / 1000);
    this.lastTime = now;

    this.adaptive.setFrozen(state.isRecording);
    this.fpsCounter.tick(now, (fps) => {
      state.setFps(String(fps));
      const changed = this.adaptive.sample(fps);
      if (changed) this.resize();
    });

    const evolveDt = wallDt * this.adaptive.settings.evolveScale;
    this.advanceAndDraw(evolveDt, wallDt);
  }

  /**
   * @param evolveDt — dt for evolve / camera lerp (may be scaled under load)
   * @param displayDt — unused currently; kept for clarity if we split later
   */
  private advanceAndDraw(evolveDt: number, _displayDt = evolveDt): void {
    const gl = this.gl;
    if (!gl || !this.uniforms) return;

    const state = this.store.getState();
    const fractalId = state.fractalId;
    const quality = this.adaptive.settings;

    if (evolveDt > 0) this.simTime += evolveDt;

    if (state.uiMode === 'express' && !state.autoEvolve) {
      state.refreshMacroBaseline();
    }

    let renderAtmosphere = state.atmosphere;
    let renderPalette = state.paletteIdx;
    let renderIters = state.iters;

    if (evolveDt > 0 && state.autoEvolve) {
      const holdCamera =
        this.cameraGesturing ||
        this.camera?.isGesturing() ||
        performance.now() < this.cameraHoldUntil;
      const savedCam = holdCamera
        ? {
            rotX: state.runtime.tgt.rotX,
            rotY: state.runtime.tgt.rotY,
            zoom: state.runtime.tgt.zoom,
            panX: state.runtime.tgt.panX,
            panY: state.runtime.tgt.panY,
          }
        : null;
      const savedOrbitPhase = holdCamera ? state.runtime.orbitPhase : null;

      const evolved = updateEvolveTargets({
        tgt: state.runtime.tgt,
        baseline: state.getMacroBaseline(),
        atmosphereBaseline: state.getAtmosphereBaseline(),
        orbit: state.runtime.orbit,
        evolvePhase: state.runtime.evolvePhase,
        morphPhase: state.runtime.morphPhase,
        orbitPhase: state.runtime.orbitPhase,
        dt: evolveDt,
        evolveSpeed: state.evolveSpeed,
        paletteIdx: state.paletteIdx,
        iters: state.iters,
        fractalId,
      });
      state.runtime.evolvePhase = evolved.phase;
      state.runtime.morphPhase = evolved.morphPhase;
      if (savedOrbitPhase !== null) {
        // Freeze satellite progress while the user aims — resume from 0 after hold
        state.runtime.orbitPhase = savedOrbitPhase;
      } else {
        state.runtime.orbitPhase = evolved.orbitPhase;
      }
      if (savedCam) {
        Object.assign(state.runtime.tgt, savedCam);
        // Keep displayed camera locked to the gesture while dragging
        if (this.cameraGesturing || this.camera?.isGesturing()) {
          Object.assign(state.runtime.cur, savedCam);
        }
      }
      renderAtmosphere = evolved.atmosphere;
      renderPalette = evolved.paletteIdx;
      renderIters = evolved.iters;
    } else if (state.uiMode === 'express') {
      applyMacrosToTarget(state.macros, fractalId, state.runtime.tgt, true);
      const b = state.getMacroBaseline();
      Object.assign(state.runtime.tgt, {
        power: b.power,
        bailout: b.bailout,
        cx: b.cx,
        cy: b.cy,
        glow: b.glow,
        bright: b.bright,
      });
    }

    if (state.snapshotLerpBoost) {
      const tgt = state.runtime.tgt;
      const cur = state.runtime.cur;
      const close =
        Math.abs(cur.power - tgt.power) < 0.05 &&
        Math.abs(cur.zoom - tgt.zoom) < 0.05 &&
        Math.abs(cur.cx - tgt.cx) < 0.02;
      if (close) state.clearSnapshotLerpBoost();
    }

    if (evolveDt > 0) {
      lerpCameraState(state.runtime, evolveDt, state.snapshotLerpBoost, state.autoEvolve);
    }

    const { cur } = state.runtime;

    if (state.autoEvolve && !this.prevAutoEvolve) {
      Object.assign(this.smoothAtmosphere, renderAtmosphere);
      this.smoothPalette = renderPalette;
      this.smoothIters = renderIters;
    }
    this.prevAutoEvolve = state.autoEvolve;

    const atmK = !state.autoEvolve ? 1 : evolveDt > 0 ? 1 - Math.exp(-evolveDt / FractalRenderer.ATM_TAU) : 0;
    if (state.autoEvolve) {
      this.smoothAtmosphere.fov = lerp(this.smoothAtmosphere.fov, renderAtmosphere.fov, atmK);
      this.smoothAtmosphere.fog = lerp(this.smoothAtmosphere.fog, renderAtmosphere.fog, atmK);
      this.smoothAtmosphere.gamma = lerp(this.smoothAtmosphere.gamma, renderAtmosphere.gamma, atmK);
      this.smoothAtmosphere.vignette = lerp(
        this.smoothAtmosphere.vignette,
        renderAtmosphere.vignette,
        atmK,
      );
      this.smoothPalette = lerp(this.smoothPalette, renderPalette, atmK);
      this.smoothIters = lerp(this.smoothIters, renderIters, atmK);
    } else {
      Object.assign(this.smoothAtmosphere, renderAtmosphere);
      this.smoothPalette = renderPalette;
      this.smoothIters = renderIters;
    }

    const atm = this.smoothAtmosphere;

    uploadUniforms(gl, this.uniforms, {
      width: this.canvas.width,
      height: this.canvas.height,
      time: this.simTime,
      rotY: cur.rotY,
      rotX: cur.rotX,
      zoom: cur.zoom,
      panX: cur.panX,
      panY: cur.panY,
      power: cur.power,
      bailout: cur.bailout,
      iter: this.smoothIters,
      cx: cur.cx,
      cy: cur.cy,
      colorShift: cur.glow,
      bright: cur.bright,
      palette: ((Math.round(this.smoothPalette) % PALETTE_COUNT) + PALETTE_COUNT) % PALETTE_COUNT,
      fov: atm.fov,
      fog: atm.fog,
      gamma: atm.gamma,
      vignette: atm.vignette,
      softShadow: quality.softShadow ? 1 : 0,
      maxSteps: quality.maxSteps,
    });

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  private async switchFractal(fractalId: FractalId): Promise<void> {
    const gl = this.gl;
    const cache = this.shaderCache;
    if (!gl || !cache) return;

    const program = await cache.get(fractalId);
    this.currentFractalId = fractalId;
    gl.useProgram(program);
    this.uniforms = getUniformLocations(gl, program);
    const aPos = gl.getAttribLocation(program, 'a_position');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
  }

  /** Recompile current fractal shader (GLSL HMR). */
  async reloadShaders(): Promise<void> {
    if (!this.shaderCache || this.currentFractalId == null) return;
    this.shaderCache.clear();
    await this.switchFractal(this.currentFractalId);
  }

  private resize(): void {
    if (!this.gl) return;
    const dprCap = this.adaptive.settings.dprCap;
    const dpr = Math.min(window.devicePixelRatio || 1, dprCap);
    // Keep pixel dimensions even — H.264 4:2:0 encoding requires even width/height.
    const toEven = (n: number) => Math.max(2, Math.floor(n / 2) * 2);
    this.canvas.width = toEven(window.innerWidth * dpr);
    this.canvas.height = toEven(window.innerHeight * dpr);
    this.canvas.style.width = `${window.innerWidth}px`;
    this.canvas.style.height = `${window.innerHeight}px`;
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
  }

  dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.rafId);
    window.removeEventListener('resize', this.resizeHandler);
    document.removeEventListener('visibilitychange', this.visibilityHandler);
    this.camera?.detach();
    this.shaderCache?.dispose();
    this.gl = null;
  }
}
