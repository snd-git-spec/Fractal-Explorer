import type { ExplorerRuntimeState, ViewAnchor } from '@/fractals/types';

const TOUCH_BASE_YAW = 1.6;
const TOUCH_BASE_PITCH = 0.9;
const MOUSE_BASE_YAW = 3.6;
const MOUSE_BASE_PITCH = 1.9;
const SPEED_REF = 2.5;
const COAST_DECAY = 10;
const COAST_MIN_SPEED = 0.08;
const VEL_SMOOTH = 0.35;

export class CameraController {
  private isDragging = false;
  private isShift = false;
  private lastMX = 0;
  private lastMY = 0;
  private lastTD = 0;
  private lastMoveTime = 0;
  private velYaw = 0;
  private velPitch = 0;
  private coastRaf = 0;
  private coastLastTime = 0;

  constructor(
    private canvas: HTMLCanvasElement,
    private getState: () => ExplorerRuntimeState,
    private onViewChange?: (view: Partial<ViewAnchor>) => void,
  ) {}

  attach(): void {
    this.canvas.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('mouseup', this.onMouseUp);
    window.addEventListener('mousemove', this.onMouseMove);
    this.canvas.addEventListener('wheel', this.onWheel, { passive: false });
    this.canvas.addEventListener('touchstart', this.onTouchStart, { passive: false });
    this.canvas.addEventListener('touchend', this.onTouchEnd, { passive: false });
    this.canvas.addEventListener('touchmove', this.onTouchMove, { passive: false });
  }

  detach(): void {
    this.stopCoast();
    this.canvas.removeEventListener('mousedown', this.onMouseDown);
    window.removeEventListener('mouseup', this.onMouseUp);
    window.removeEventListener('mousemove', this.onMouseMove);
    this.canvas.removeEventListener('wheel', this.onWheel);
    this.canvas.removeEventListener('touchstart', this.onTouchStart);
    this.canvas.removeEventListener('touchend', this.onTouchEnd);
    this.canvas.removeEventListener('touchmove', this.onTouchMove);
  }

  private syncView(view: Partial<ViewAnchor>): void {
    this.onViewChange?.(view);
  }

  /** Write rotation to both cur and tgt so Auto Evolve lerp cannot lag the gesture. */
  private applyRot(dYaw: number, dPitch: number): void {
    const runtime = this.getState();
    for (const s of [runtime.tgt, runtime.cur]) {
      s.rotY += dYaw;
      s.rotX = Math.max(-1.3, Math.min(1.3, s.rotX + dPitch));
    }
    this.syncView({ rotX: runtime.tgt.rotX, rotY: runtime.tgt.rotY });
  }

  private applyPan(dPanX: number, dPanY: number): void {
    const runtime = this.getState();
    for (const s of [runtime.tgt, runtime.cur]) {
      s.panX += dPanX;
      s.panY += dPanY;
    }
    this.syncView({ panX: runtime.tgt.panX, panY: runtime.tgt.panY });
  }

  private applyZoom(nextZoom: number): void {
    const runtime = this.getState();
    const z = Math.max(1, Math.min(12, nextZoom));
    runtime.tgt.zoom = z;
    runtime.cur.zoom = z;
    this.syncView({ zoom: z });
  }

  private stopCoast(): void {
    if (this.coastRaf) {
      cancelAnimationFrame(this.coastRaf);
      this.coastRaf = 0;
    }
  }

  private startCoast(): void {
    this.stopCoast();
    const speed = Math.hypot(this.velYaw, this.velPitch);
    if (speed < COAST_MIN_SPEED) {
      this.velYaw = 0;
      this.velPitch = 0;
      return;
    }
    this.coastLastTime = performance.now();
    const tick = (now: number): void => {
      const dt = Math.min(0.05, (now - this.coastLastTime) / 1000);
      this.coastLastTime = now;
      const decay = Math.exp(-COAST_DECAY * dt);
      this.velYaw *= decay;
      this.velPitch *= decay;
      if (Math.hypot(this.velYaw, this.velPitch) < COAST_MIN_SPEED) {
        this.velYaw = 0;
        this.velPitch = 0;
        this.coastRaf = 0;
        return;
      }
      this.applyRot(this.velYaw * dt, this.velPitch * dt);
      this.coastRaf = requestAnimationFrame(tick);
    };
    this.coastRaf = requestAnimationFrame(tick);
  }

  private orbitFromDelta(
    dx: number,
    dy: number,
    dt: number,
    baseYaw: number,
    basePitch: number,
  ): void {
    const speed = Math.hypot(dx, dy) / dt;
    const speedGain = 0.55 + 0.9 * Math.min(1, speed / SPEED_REF);
    const dYaw = dx * baseYaw * speedGain;
    const dPitch = dy * basePitch * speedGain;
    this.applyRot(dYaw, dPitch);

    const instantYaw = dYaw / dt;
    const instantPitch = dPitch / dt;
    this.velYaw += (instantYaw - this.velYaw) * VEL_SMOOTH;
    this.velPitch += (instantPitch - this.velPitch) * VEL_SMOOTH;
  }

  private onMouseDown = (e: MouseEvent): void => {
    this.stopCoast();
    this.velYaw = 0;
    this.velPitch = 0;
    this.isDragging = true;
    this.isShift = e.shiftKey;
    this.lastMX = e.clientX;
    this.lastMY = e.clientY;
    this.lastMoveTime = performance.now();
  };

  private onMouseUp = (): void => {
    if (!this.isDragging) return;
    this.isDragging = false;
    if (!this.isShift) this.startCoast();
  };

  private onMouseMove = (e: MouseEvent): void => {
    if (!this.isDragging) return;
    const now = performance.now();
    const dt = Math.max((now - this.lastMoveTime) / 1000, 1e-3);
    const dx = (e.clientX - this.lastMX) / window.innerWidth;
    const dy = (e.clientY - this.lastMY) / window.innerHeight;
    if (this.isShift) {
      const zoom = this.getState().tgt.zoom;
      this.applyPan(dx * zoom, -dy * zoom);
      this.velYaw = 0;
      this.velPitch = 0;
    } else {
      this.orbitFromDelta(dx, dy, dt, MOUSE_BASE_YAW, MOUSE_BASE_PITCH);
    }
    this.lastMX = e.clientX;
    this.lastMY = e.clientY;
    this.lastMoveTime = now;
  };

  private onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    const s = this.getState().tgt;
    this.applyZoom(s.zoom * (1 + e.deltaY * 0.001));
  };

  private onTouchStart = (e: TouchEvent): void => {
    e.preventDefault();
    this.stopCoast();
    this.velYaw = 0;
    this.velPitch = 0;
    this.isDragging = true;
    this.lastMX = e.touches[0].clientX;
    this.lastMY = e.touches[0].clientY;
    this.lastMoveTime = performance.now();
    if (e.touches.length >= 2) {
      this.lastTD = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY,
      );
    }
  };

  private onTouchEnd = (e: TouchEvent): void => {
    if (e.touches.length === 0) {
      this.isDragging = false;
      this.startCoast();
    } else {
      this.lastMX = e.touches[0].clientX;
      this.lastMY = e.touches[0].clientY;
      this.lastMoveTime = performance.now();
      if (e.touches.length >= 2) {
        this.lastTD = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY,
        );
      }
    }
  };

  private onTouchMove = (e: TouchEvent): void => {
    e.preventDefault();
    if (e.touches.length >= 2) {
      this.velYaw = 0;
      this.velPitch = 0;
      const d = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY,
      );
      if (this.lastTD > 0) {
        this.applyZoom(this.getState().tgt.zoom * (this.lastTD / d));
      }
      this.lastTD = d;
      this.lastMX = (e.touches[0].clientX + e.touches[1].clientX) * 0.5;
      this.lastMY = (e.touches[0].clientY + e.touches[1].clientY) * 0.5;
      this.lastMoveTime = performance.now();
    } else if (e.touches.length === 1) {
      const now = performance.now();
      const dt = Math.max((now - this.lastMoveTime) / 1000, 1e-3);
      const dx = (e.touches[0].clientX - this.lastMX) / window.innerWidth;
      const dy = (e.touches[0].clientY - this.lastMY) / window.innerHeight;
      this.orbitFromDelta(dx, dy, dt, TOUCH_BASE_YAW, TOUCH_BASE_PITCH);
      this.lastMX = e.touches[0].clientX;
      this.lastMY = e.touches[0].clientY;
      this.lastMoveTime = now;
    }
  };
}
