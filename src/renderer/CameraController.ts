import type { ExplorerRuntimeState } from '@/fractals/types';
import { ZOOM_MAX, ZOOM_MIN } from '@/fractals/types';

/** Touch: precision first — previous gains spun too fast on phones. */
const TOUCH_BASE_YAW = 0.85;
const TOUCH_BASE_PITCH = 0.5;
/** Mouse: a bit hotter than touch, still speed-aware. */
const MOUSE_BASE_YAW = 2.4;
const MOUSE_BASE_PITCH = 1.25;
const SPEED_REF = 3.2;
const VEL_SMOOTH = 0.28;
/** Suppress synthetic mouse events that follow touch on mobile. */
const MOUSE_SUPPRESS_MS = 900;

export class CameraController {
  private isDragging = false;
  private isShift = false;
  private lastMX = 0;
  private lastMY = 0;
  private lastTD = 0;
  private lastMoveTime = 0;
  private velYaw = 0;
  private velPitch = 0;
  /** Ignore mouse down/move/up until this time (after touch). */
  private suppressMouseUntil = 0;
  private inputKind: 'mouse' | 'touch' | null = null;

  constructor(
    private canvas: HTMLCanvasElement,
    private getState: () => ExplorerRuntimeState,
    private onGestureStart?: () => void,
    private onGestureEnd?: () => void,
    /** Wheel / committed zoom — sync baseline without orbit reseed. */
    private onZoomCommit?: (zoom: number) => void,
  ) {}

  isGesturing(): boolean {
    return this.isDragging;
  }

  attach(): void {
    this.canvas.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('mouseup', this.onMouseUp);
    window.addEventListener('mousemove', this.onMouseMove);
    window.addEventListener('blur', this.onForceEnd);
    this.canvas.addEventListener('wheel', this.onWheel, { passive: false });
    this.canvas.addEventListener('touchstart', this.onTouchStart, { passive: false });
    this.canvas.addEventListener('touchend', this.onTouchEnd, { passive: false });
    this.canvas.addEventListener('touchcancel', this.onTouchEnd, { passive: false });
    this.canvas.addEventListener('touchmove', this.onTouchMove, { passive: false });
  }

  detach(): void {
    this.canvas.removeEventListener('mousedown', this.onMouseDown);
    window.removeEventListener('mouseup', this.onMouseUp);
    window.removeEventListener('mousemove', this.onMouseMove);
    window.removeEventListener('blur', this.onForceEnd);
    this.canvas.removeEventListener('wheel', this.onWheel);
    this.canvas.removeEventListener('touchstart', this.onTouchStart);
    this.canvas.removeEventListener('touchend', this.onTouchEnd);
    this.canvas.removeEventListener('touchcancel', this.onTouchEnd);
    this.canvas.removeEventListener('touchmove', this.onTouchMove);
  }

  private beginGesture(kind: 'mouse' | 'touch'): void {
    this.inputKind = kind;
    this.velYaw = 0;
    this.velPitch = 0;
    this.onGestureStart?.();
  }

  private endGesture(): void {
    this.inputKind = null;
    this.isDragging = false;
    this.onGestureEnd?.();
  }

  private onForceEnd = (): void => {
    if (this.isDragging) this.endGesture();
  };

  /** Write rotation to both cur and tgt so Auto Evolve lerp cannot lag the gesture. */
  private applyRot(dYaw: number, dPitch: number): void {
    const runtime = this.getState();
    for (const s of [runtime.tgt, runtime.cur]) {
      s.rotY += dYaw;
      s.rotX = Math.max(-1.3, Math.min(1.3, s.rotX + dPitch));
    }
  }

  private applyPan(dPanX: number, dPanY: number): void {
    const runtime = this.getState();
    for (const s of [runtime.tgt, runtime.cur]) {
      s.panX += dPanX;
      s.panY += dPanY;
    }
  }

  private applyZoom(nextZoom: number, commit = false): void {
    const runtime = this.getState();
    const z = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, nextZoom));
    runtime.tgt.zoom = z;
    runtime.cur.zoom = z;
    if (commit) this.onZoomCommit?.(z);
  }

  private orbitFromDelta(
    dx: number,
    dy: number,
    dt: number,
    baseYaw: number,
    basePitch: number,
  ): void {
    const speed = Math.hypot(dx, dy) / dt;
    const speedGain = 0.7 + 0.55 * Math.min(1, speed / SPEED_REF);
    const dYaw = dx * baseYaw * speedGain;
    const dPitch = dy * basePitch * speedGain;
    this.applyRot(dYaw, dPitch);

    const instantYaw = dYaw / dt;
    const instantPitch = dPitch / dt;
    this.velYaw += (instantYaw - this.velYaw) * VEL_SMOOTH;
    this.velPitch += (instantPitch - this.velPitch) * VEL_SMOOTH;
  }

  private onMouseDown = (e: MouseEvent): void => {
    if (performance.now() < this.suppressMouseUntil) return;
    this.isDragging = true;
    this.isShift = e.shiftKey;
    this.lastMX = e.clientX;
    this.lastMY = e.clientY;
    this.lastMoveTime = performance.now();
    this.beginGesture('mouse');
  };

  private onMouseUp = (): void => {
    if (performance.now() < this.suppressMouseUntil) return;
    if (!this.isDragging || this.inputKind === 'touch') return;
    this.endGesture();
  };

  private onMouseMove = (e: MouseEvent): void => {
    if (performance.now() < this.suppressMouseUntil) return;
    if (!this.isDragging || this.inputKind !== 'mouse') return;
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
    // Do NOT begin/end a full orbit gesture — that reseeds the path every notch.
    // Normalize trackpad vs mouse: cap step, use exponential scale.
    let dy = e.deltaY;
    if (e.deltaMode === 1) dy *= 16; // line → pixels-ish
    if (e.deltaMode === 2) dy *= 64; // page
    dy = Math.max(-80, Math.min(80, dy));
    const factor = Math.exp(dy * 0.0018);
    const z = this.getState().tgt.zoom * factor;
    // While dragging, only update live zoom; commit on release.
    this.applyZoom(z, !this.isDragging);
  };

  private onTouchStart = (e: TouchEvent): void => {
    e.preventDefault();
    this.suppressMouseUntil = performance.now() + MOUSE_SUPPRESS_MS;
    this.isDragging = true;
    this.lastMX = e.touches[0].clientX;
    this.lastMY = e.touches[0].clientY;
    this.lastMoveTime = performance.now();
    this.beginGesture('touch');
    if (e.touches.length >= 2) {
      this.lastTD = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY,
      );
    } else {
      this.lastTD = 0; // avoid stale pinch ratio when 2nd finger lands later
    }
  };

  private onTouchEnd = (e: TouchEvent): void => {
    this.suppressMouseUntil = performance.now() + MOUSE_SUPPRESS_MS;
    if (e.touches.length === 0) {
      if (!this.isDragging) return;
      this.endGesture();
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
    this.suppressMouseUntil = performance.now() + MOUSE_SUPPRESS_MS;
    if (e.touches.length >= 2) {
      this.velYaw = 0;
      this.velPitch = 0;
      const d = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY,
      );
      if (this.lastTD > 8) {
        // Clamp per-frame pinch so one noisy sample can't jump zoom to the rail
        const ratio = Math.max(0.94, Math.min(1.06, this.lastTD / d));
        this.applyZoom(this.getState().tgt.zoom * ratio);
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
