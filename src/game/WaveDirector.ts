import { ARENA_H, ARENA_W } from './Constants';
import type { EnemyType } from './Entities';

export class WaveDirector {
  public wave = 1;
  public spawnQueue: EnemyType[] = [];
  public spawnTimer = 0;
  public waveBannerTimer = 0;

  public reset(): void {
    this.wave = 1;
    this.spawnQueue.length = 0;
    this.spawnTimer = 0.6;
    this.buildWave(1);
  }

  public advanceWave(): void {
    this.wave++;
    this.buildWave(this.wave);
  }

  private buildWave(w: number): void {
    this.spawnQueue.length = 0;
    this.waveBannerTimer = 2.0;
    this.spawnTimer = 0.7;

    if (w % 5 === 0) {
      this.spawnQueue.push('boss');
      const escortCount = 4 + Math.floor(w * 0.6);
      for (let i = 0; i < escortCount; i++) {
        this.spawnQueue.push(i % 2 === 0 ? 'drone' : 'orbiter');
      }
      return;
    }

    const total = Math.min(48, 7 + w * 3);
    for (let i = 0; i < total; i++) {
      const r = Math.random();
      if (w >= 4 && r < 0.16) {
        this.spawnQueue.push('orbiter');
      } else if (w >= 3 && r < 0.34) {
        this.spawnQueue.push('splitter');
      } else if (w >= 2 && r < 0.56) {
        this.spawnQueue.push('lancer');
      } else {
        this.spawnQueue.push('drone');
      }
    }
  }

  public pickSpawnPoint(playerX: number, playerY: number): { x: number; y: number } {
    for (let attempt = 0; attempt < 8; attempt++) {
      const edge = Math.floor(Math.random() * 4);
      let x = 0;
      let y = 0;
      const pad = 42;
      if (edge === 0) {
        x = pad + Math.random() * (ARENA_W - pad * 2);
        y = pad;
      } else if (edge === 1) {
        x = ARENA_W - pad;
        y = pad + Math.random() * (ARENA_H - pad * 2);
      } else if (edge === 2) {
        x = pad + Math.random() * (ARENA_W - pad * 2);
        y = ARENA_H - pad;
      } else {
        x = pad;
        y = pad + Math.random() * (ARENA_H - pad * 2);
      }

      const dx = x - playerX;
      const dy = y - playerY;
      if (dx * dx + dy * dy > 360 * 360) {
        return { x, y };
      }
    }
    return {
      x: playerX < ARENA_W * 0.5 ? ARENA_W - 60 : 60,
      y: playerY < ARENA_H * 0.5 ? ARENA_H - 60 : 60
    };
  }
}
