/**
 * Quality-preserving adaptive render cost.
 *
 * Conservative: prefer evolve backoff over cutting geometric fidelity.
 * Never drops below 1.0 DPR; does not cap Detail/iters.
 */

export type AdaptiveSettings = {
  /** Cap for devicePixelRatio (always ≥ 1). */
  dprCap: number;
  softShadow: boolean;
  maxSteps: number;
  /** Multiplier on evolve dt (1 = full speed). */
  evolveScale: number;
  step: number;
};

const STEPS: AdaptiveSettings[] = [
  { step: 0, dprCap: 1.5, softShadow: true, maxSteps: 160, evolveScale: 1 },
  // First: slow evolve only — keep full visual fidelity
  { step: 1, dprCap: 1.5, softShadow: true, maxSteps: 160, evolveScale: 0.65 },
  // Then: soft shadows off (shape still sharp)
  { step: 2, dprCap: 1.5, softShadow: false, maxSteps: 160, evolveScale: 0.65 },
  // Mild ray-step trim only after that
  { step: 3, dprCap: 1.5, softShadow: false, maxSteps: 140, evolveScale: 0.55 },
  // DPR last — never below 1.0
  { step: 4, dprCap: 1.25, softShadow: false, maxSteps: 140, evolveScale: 0.55 },
  { step: 5, dprCap: 1.0, softShadow: false, maxSteps: 140, evolveScale: 0.5 },
];

const LOW_FPS = 24;
const HIGH_FPS = 50;
const DROP_STREAK = 4;
const RAISE_STREAK = 2;

export class AdaptiveQuality {
  private step = 0;
  private lowStreak = 0;
  private highStreak = 0;
  private frozen = false;
  private lastApplied: AdaptiveSettings = STEPS[0];

  get settings(): AdaptiveSettings {
    return this.lastApplied;
  }

  /** Freeze while recording so quality does not thrash mid-export. */
  setFrozen(frozen: boolean): void {
    this.frozen = frozen;
  }

  /**
   * Feed a measured FPS sample. Returns true if settings changed
   * (caller should re-resize when dprCap changes).
   */
  sample(fps: number): boolean {
    if (this.frozen) return false;

    if (fps < LOW_FPS) {
      this.lowStreak += 1;
      this.highStreak = 0;
      if (this.lowStreak >= DROP_STREAK && this.step < STEPS.length - 1) {
        this.step += 1;
        this.lowStreak = 0;
        this.lastApplied = STEPS[this.step];
        return true;
      }
    } else if (fps > HIGH_FPS) {
      this.highStreak += 1;
      this.lowStreak = 0;
      if (this.highStreak >= RAISE_STREAK && this.step > 0) {
        this.step -= 1;
        this.highStreak = 0;
        this.lastApplied = STEPS[this.step];
        return true;
      }
    } else {
      this.lowStreak = 0;
      this.highStreak = 0;
    }

    return false;
  }
}
