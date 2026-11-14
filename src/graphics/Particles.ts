import { ObjectPool } from '../core/ObjectPool';

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  isRing: boolean;
}

export class ParticleSystem {
  public readonly pool: ObjectPool<Particle>;
  public densityScale = 1;

  constructor(capacity = 420) {
    this.pool = new ObjectPool<Particle>(capacity, () => ({
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      life: 0,
      maxLife: 1,
      size: 2,
      color: '#ffffff',
      isRing: false
    }));
  }

  public burst(x: number, y: number, color: string, count: number, speed = 220, size = 3): void {
    const n = Math.max(1, Math.round(count * this.densityScale));
    for (let i = 0; i < n; i++) {
      const p = this.pool.acquire();
      if (!p) break;
      const angle = Math.random() * Math.PI * 2;
      const spd = speed * (0.35 + Math.random() * 0.75);
      p.x = x;
      p.y = y;
      p.vx = Math.cos(angle) * spd;
      p.vy = Math.sin(angle) * spd;
      p.maxLife = 0.22 + Math.random() * 0.28;
      p.life = p.maxLife;
      p.size = size * (0.7 + Math.random() * 0.6);
      p.color = color;
      p.isRing = false;
    }
  }

  public ring(x: number, y: number, color: string, maxRadius: number, duration = 0.32): void {
    const p = this.pool.acquire();
    if (!p) return;
    p.x = x;
    p.y = y;
    p.vx = 0;
    p.vy = 0;
    p.maxLife = duration;
    p.life = duration;
    p.size = maxRadius;
    p.color = color;
    p.isRing = true;
  }

  public update(dt: number): void {
    for (let i = this.pool.activeCount - 1; i >= 0; i--) {
      const p = this.pool.items[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.pool.releaseAt(i);
        continue;
      }
      if (!p.isRing) {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vx *= 0.94;
        p.vy *= 0.94;
      }
    }
  }

  public clear(): void {
    this.pool.clear();
  }
}
