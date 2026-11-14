import { FIXED_DT, MAX_FRAME_DT } from '../game/Constants';

export class GameLoop {
  private rafId = 0;
  private lastTime = 0;
  private accumulator = 0;
  private running = false;

  private fpsFrames = 0;
  private fpsTimer = 0;
  public currentFps = 60;
  private lowFpsStreak = 0;

  private onUpdate: (dt: number) => void;
  private onRender: (alpha: number) => void;
  private onLowFpsDetected: () => void;

  constructor(
    onUpdate: (dt: number) => void,
    onRender: (alpha: number) => void,
    onLowFpsDetected: () => void
  ) {
    this.onUpdate = onUpdate;
    this.onRender = onRender;
    this.onLowFpsDetected = onLowFpsDetected;
  }

  public start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    this.accumulator = 0;
    this.rafId = requestAnimationFrame(this.tick);
  }

  public stop(): void {
    this.running = false;
    cancelAnimationFrame(this.rafId);
  }

  public resetTiming(): void {
    this.lastTime = performance.now();
    this.accumulator = 0;
  }

  private tick = (now: number): void => {
    if (!this.running) return;
    this.rafId = requestAnimationFrame(this.tick);

    let frameDt = (now - this.lastTime) / 1000;
    this.lastTime = now;
    if (frameDt > MAX_FRAME_DT) frameDt = MAX_FRAME_DT;
    if (frameDt < 0) frameDt = 0;

    this.accumulator += frameDt;
    while (this.accumulator >= FIXED_DT) {
      this.onUpdate(FIXED_DT);
      this.accumulator -= FIXED_DT;
    }

    const alpha = this.accumulator / FIXED_DT;
    this.onRender(alpha);

    this.fpsFrames++;
    this.fpsTimer += frameDt;
    if (this.fpsTimer >= 1.0) {
      this.currentFps = Math.round(this.fpsFrames / this.fpsTimer);
      this.fpsFrames = 0;
      this.fpsTimer = 0;

      if (this.currentFps < 47) {
        this.lowFpsStreak++;
        if (this.lowFpsStreak >= 2) {
          this.onLowFpsDetected();
          this.lowFpsStreak = 0;
        }
      } else {
        this.lowFpsStreak = 0;
      }
    }
  };
}
