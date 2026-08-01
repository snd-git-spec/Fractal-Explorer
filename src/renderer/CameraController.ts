import type { ExplorerRuntimeState, ViewAnchor } from '@/fractals/types';

export class CameraController {
  private isDragging = false;
  private isShift = false;
  private lastMX = 0;
  private lastMY = 0;
  private lastTD = 0;

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

  private onMouseDown = (e: MouseEvent): void => {
    this.isDragging = true;
    this.isShift = e.shiftKey;
    this.lastMX = e.clientX;
    this.lastMY = e.clientY;
  };

  private onMouseUp = (): void => {
    this.isDragging = false;
  };

  private onMouseMove = (e: MouseEvent): void => {
    if (!this.isDragging) return;
    const dx = (e.clientX - this.lastMX) / window.innerWidth;
    const dy = (e.clientY - this.lastMY) / window.innerHeight;
    const s = this.getState().tgt;
    if (this.isShift) {
      s.panX += dx * s.zoom;
      s.panY -= dy * s.zoom;
      this.syncView({ panX: s.panX, panY: s.panY });
    } else {
      s.rotY += dx * 2.8;
      s.rotX = Math.max(-1.3, Math.min(1.3, s.rotX + dy * 1.4));
      this.syncView({ rotX: s.rotX, rotY: s.rotY });
    }
    this.lastMX = e.clientX;
    this.lastMY = e.clientY;
  };

  private onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    const s = this.getState().tgt;
    s.zoom = Math.max(1, Math.min(12, s.zoom * (1 + e.deltaY * 0.001)));
    this.syncView({ zoom: s.zoom });
  };

  private onTouchStart = (e: TouchEvent): void => {
    e.preventDefault();
    this.isDragging = true;
    this.lastMX = e.touches[0].clientX;
    this.lastMY = e.touches[0].clientY;
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
    } else {
      this.lastMX = e.touches[0].clientX;
      this.lastMY = e.touches[0].clientY;
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
    const s = this.getState().tgt;
    if (e.touches.length >= 2) {
      const d = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY,
      );
      if (this.lastTD > 0) {
        s.zoom = Math.max(1, Math.min(12, s.zoom * (this.lastTD / d)));
        this.syncView({ zoom: s.zoom });
      }
      this.lastTD = d;
      this.lastMX = (e.touches[0].clientX + e.touches[1].clientX) * 0.5;
      this.lastMY = (e.touches[0].clientY + e.touches[1].clientY) * 0.5;
    } else if (e.touches.length === 1) {
      const dx = (e.touches[0].clientX - this.lastMX) / window.innerWidth;
      const dy = (e.touches[0].clientY - this.lastMY) / window.innerHeight;
      s.rotY += dx * 3.5;
      s.rotX = Math.max(-1.3, Math.min(1.3, s.rotX + dy * 2.0));
      this.syncView({ rotX: s.rotX, rotY: s.rotY });
      this.lastMX = e.touches[0].clientX;
      this.lastMY = e.touches[0].clientY;
    }
  };
}
