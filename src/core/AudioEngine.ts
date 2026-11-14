export class AudioEngine {
  private ctx: AudioContext | null = null;
  private enabled = true;
  private lastPlayed = new Map<string, number>();

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled && this.ctx && this.ctx.state === 'running') {
      void this.ctx.suspend();
    } else if (enabled && this.ctx && this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
  }

  public unlock(): void {
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();
    }
    if (this.enabled && this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
  }

  public suspend(): void {
    if (this.ctx && this.ctx.state === 'running') {
      void this.ctx.suspend();
    }
  }

  public resume(): void {
    if (this.enabled && this.ctx && this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
  }

  private canPlay(tag: string, minIntervalMs: number): boolean {
    if (!this.enabled || !this.ctx || this.ctx.state !== 'running') return false;
    const now = performance.now();
    const prev = this.lastPlayed.get(tag) ?? 0;
    if (now - prev < minIntervalMs) return false;
    this.lastPlayed.set(tag, now);
    return true;
  }

  private tone(
    type: OscillatorType,
    startFreq: number,
    endFreq: number,
    duration: number,
    gainVal: number
  ): void {
    const ctx = this.ctx;
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(startFreq, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), now + duration);

    gain.gain.setValueAtTime(gainVal, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + duration);
  }

  public playShoot(overdrive: boolean): void {
    if (!this.canPlay('shoot', 55)) return;
    this.tone(overdrive ? 'sawtooth' : 'triangle', overdrive ? 920 : 720, 260, 0.06, 0.045);
  }

  public playHit(): void {
    if (!this.canPlay('hit', 45)) return;
    this.tone('square', 280, 110, 0.05, 0.04);
  }

  public playExplosion(large = false): void {
    if (!this.canPlay(large ? 'expL' : 'exp', large ? 90 : 50)) return;
    this.tone('sawtooth', large ? 170 : 220, 32, large ? 0.34 : 0.16, large ? 0.14 : 0.08);
  }

  public playDash(): void {
    if (!this.canPlay('dash', 120)) return;
    this.tone('sine', 240, 680, 0.12, 0.09);
  }

  public playGraze(): void {
    if (!this.canPlay('graze', 75)) return;
    this.tone('sine', 1250, 1650, 0.045, 0.035);
  }

  public playPickup(): void {
    if (!this.canPlay('pickup', 80)) return;
    this.tone('triangle', 520, 1040, 0.14, 0.08);
  }

  public playOverdrive(): void {
    if (!this.canPlay('overdrive', 300)) return;
    this.tone('sawtooth', 180, 960, 0.35, 0.14);
  }

  public playPlayerHurt(): void {
    if (!this.canPlay('hurt', 200)) return;
    this.tone('sawtooth', 140, 40, 0.28, 0.16);
  }

  public playWaveClear(): void {
    if (!this.canPlay('wave', 300)) return;
    this.tone('triangle', 440, 880, 0.22, 0.09);
  }
}
