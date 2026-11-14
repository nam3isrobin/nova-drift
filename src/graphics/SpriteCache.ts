import { COLORS } from '../game/Constants';

export type SpriteKey =
  | 'player'
  | 'playerOverdrive'
  | 'enemyDrone'
  | 'enemyLancer'
  | 'enemySplitter'
  | 'enemyShard'
  | 'enemyOrbiter'
  | 'enemyBoss'
  | 'bulletPlayer'
  | 'bulletOverdrive'
  | 'bulletEnemy'
  | 'bulletBoss'
  | 'pickupSpread'
  | 'pickupShield'
  | 'pickupCore';

function makeCanvas(size: number, draw: (ctx: CanvasRenderingContext2D, half: number) => void): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d')!;
  draw(ctx, size / 2);
  return c;
}

function drawGlow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  color: string,
  alpha = 0.38
): void {
  const grad = ctx.createRadialGradient(x, y, r * 0.1, x, y, r);
  grad.addColorStop(0, color);
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export class SpriteCache {
  private sprites: Record<SpriteKey, HTMLCanvasElement>;

  constructor() {
    this.sprites = {
      player: this.buildShip(COLORS.cyan),
      playerOverdrive: this.buildShip(COLORS.gold),
      enemyDrone: this.buildDiamond(48, 13, COLORS.pink),
      enemyLancer: this.buildLancer(56, COLORS.orange),
      enemySplitter: this.buildHex(64, 19, COLORS.purple),
      enemyShard: this.buildDiamond(34, 9, COLORS.purple),
      enemyOrbiter: this.buildOrbiter(54, COLORS.lime),
      enemyBoss: this.buildBoss(128),
      bulletPlayer: this.buildBullet(28, 5, COLORS.cyan),
      bulletOverdrive: this.buildBullet(32, 6, COLORS.gold),
      bulletEnemy: this.buildOrbBullet(26, 5, COLORS.pink),
      bulletBoss: this.buildOrbBullet(34, 7, COLORS.orange),
      pickupSpread: this.buildPickup(44, COLORS.cyan, 'S'),
      pickupShield: this.buildPickup(44, COLORS.lime, '+'),
      pickupCore: this.buildPickup(44, COLORS.gold, 'E')
    };
  }

  public get(key: SpriteKey): HTMLCanvasElement {
    return this.sprites[key];
  }

  private buildShip(color: string): HTMLCanvasElement {
    return makeCanvas(64, (ctx, h) => {
      drawGlow(ctx, h, h, 28, color, 0.42);
      ctx.translate(h, h);
      ctx.beginPath();
      ctx.moveTo(20, 0);
      ctx.lineTo(-14, -13);
      ctx.lineTo(-7, 0);
      ctx.lineTo(-14, 13);
      ctx.closePath();
      ctx.fillStyle = '#091526';
      ctx.fill();
      ctx.lineWidth = 2.8;
      ctx.strokeStyle = color;
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(11, 0);
      ctx.lineTo(-4, -5);
      ctx.lineTo(-4, 5);
      ctx.closePath();
      ctx.fillStyle = COLORS.white;
      ctx.fill();
    });
  }

  private buildDiamond(size: number, r: number, color: string): HTMLCanvasElement {
    return makeCanvas(size, (ctx, h) => {
      drawGlow(ctx, h, h, r * 1.8, color, 0.35);
      ctx.translate(h, h);
      ctx.beginPath();
      ctx.moveTo(r, 0);
      ctx.lineTo(0, -r * 0.85);
      ctx.lineTo(-r, 0);
      ctx.lineTo(0, r * 0.85);
      ctx.closePath();
      ctx.fillStyle = '#140b1c';
      ctx.fill();
      ctx.lineWidth = 2.4;
      ctx.strokeStyle = color;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(0, 0, r * 0.28, 0, Math.PI * 2);
      ctx.fillStyle = COLORS.white;
      ctx.fill();
    });
  }

  private buildLancer(size: number, color: string): HTMLCanvasElement {
    return makeCanvas(size, (ctx, h) => {
      drawGlow(ctx, h, h, 24, color, 0.38);
      ctx.translate(h, h);
      ctx.beginPath();
      ctx.moveTo(20, 0);
      ctx.lineTo(-16, -10);
      ctx.lineTo(-10, 0);
      ctx.lineTo(-16, 10);
      ctx.closePath();
      ctx.fillStyle = '#1f1108';
      ctx.fill();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = color;
      ctx.stroke();
    });
  }

  private buildHex(size: number, r: number, color: string): HTMLCanvasElement {
    return makeCanvas(size, (ctx, h) => {
      drawGlow(ctx, h, h, r * 1.65, color, 0.35);
      ctx.translate(h, h);
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i * Math.PI) / 3;
        const px = Math.cos(a) * r;
        const py = Math.sin(a) * r;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fillStyle = '#150c24';
      ctx.fill();
      ctx.lineWidth = 2.6;
      ctx.strokeStyle = color;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(0, 0, r * 0.35, 0, Math.PI * 2);
      ctx.strokeStyle = COLORS.white;
      ctx.lineWidth = 1.8;
      ctx.stroke();
    });
  }

  private buildOrbiter(size: number, color: string): HTMLCanvasElement {
    return makeCanvas(size, (ctx, h) => {
      drawGlow(ctx, h, h, 23, color, 0.34);
      ctx.translate(h, h);
      ctx.beginPath();
      ctx.arc(0, 0, 14, 0, Math.PI * 2);
      ctx.fillStyle = '#091d16';
      ctx.fill();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = color;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(0, 0, 5, 0, Math.PI * 2);
      ctx.fillStyle = COLORS.white;
      ctx.fill();
    });
  }

  private buildBoss(size: number): HTMLCanvasElement {
    return makeCanvas(size, (ctx, h) => {
      drawGlow(ctx, h, h, 58, COLORS.pink, 0.42);
      ctx.translate(h, h);
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4;
        const rad = i % 2 === 0 ? 48 : 34;
        const px = Math.cos(a) * rad;
        const py = Math.sin(a) * rad;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fillStyle = '#1e0918';
      ctx.fill();
      ctx.lineWidth = 3.5;
      ctx.strokeStyle = COLORS.pink;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(0, 0, 18, 0, Math.PI * 2);
      ctx.strokeStyle = COLORS.gold;
      ctx.lineWidth = 3;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(0, 0, 8, 0, Math.PI * 2);
      ctx.fillStyle = COLORS.white;
      ctx.fill();
    });
  }

  private buildBullet(size: number, r: number, color: string): HTMLCanvasElement {
    return makeCanvas(size, (ctx, h) => {
      drawGlow(ctx, h, h, r * 2.4, color, 0.45);
      ctx.translate(h, h);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.roundRect(-r * 1.7, -r * 0.55, r * 3.4, r * 1.1, r * 0.5);
      ctx.fill();
      ctx.fillStyle = COLORS.white;
      ctx.beginPath();
      ctx.roundRect(-r * 1.1, -r * 0.28, r * 2.2, r * 0.56, r * 0.25);
      ctx.fill();
    });
  }

  private buildOrbBullet(size: number, r: number, color: string): HTMLCanvasElement {
    return makeCanvas(size, (ctx, h) => {
      drawGlow(ctx, h, h, r * 2.3, color, 0.5);
      ctx.translate(h, h);
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.5, 0, Math.PI * 2);
      ctx.fillStyle = COLORS.white;
      ctx.fill();
    });
  }

  private buildPickup(size: number, color: string, label: string): HTMLCanvasElement {
    return makeCanvas(size, (ctx, h) => {
      drawGlow(ctx, h, h, 20, color, 0.45);
      ctx.translate(h, h);
      ctx.beginPath();
      ctx.arc(0, 0, 13, 0, Math.PI * 2);
      ctx.fillStyle = '#091224';
      ctx.fill();
      ctx.lineWidth = 2.4;
      ctx.strokeStyle = color;
      ctx.stroke();

      ctx.fillStyle = color;
      ctx.font = 'bold 14px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, 0, 1);
    });
  }
}
