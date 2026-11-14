import { InputManager } from '../core/InputManager';
import type { QualitySetting } from '../core/Storage';
import { ARENA_H, ARENA_W, COLORS, LOGICAL_VIEW_H, PLAYER_DASH_COOLDOWN } from '../game/Constants';
import type { EnemyType } from '../game/Entities';
import { GameWorld } from '../game/GameWorld';
import { SpriteCache, type SpriteKey } from './SpriteCache';

interface Star {
  x: number;
  y: number;
  size: number;
  alpha: number;
}

export class Renderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private sprites = new SpriteCache();
  private stars: Star[] = [];

  private viewW = 1280;
  private viewH = LOGICAL_VIEW_H;
  private camX = 0;
  private camY = 0;

  private shakeEnabled = true;
  private quality: QualitySetting = 'auto';
  private degradedLow = false;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Canvas 2D unavailable');
    this.ctx = ctx;

    for (let i = 0; i < 90; i++) {
      this.stars.push({
        x: Math.random() * ARENA_W,
        y: Math.random() * ARENA_H,
        size: 1 + Math.random() * 1.8,
        alpha: 0.25 + Math.random() * 0.55
      });
    }
    this.resize();
  }

  public setSettings(shake: boolean, quality: QualitySetting): void {
    this.shakeEnabled = shake;
    if (this.quality !== quality) {
      this.quality = quality;
      this.degradedLow = quality === 'low';
      this.resize();
    }
  }

  public forceLowQuality(world: GameWorld): void {
    if (this.quality !== 'auto' || this.degradedLow) return;
    this.degradedLow = true;
    world.particles.densityScale = 0.5;
    this.resize();
  }

  public resize = (): void => {
    const rect = this.canvas.getBoundingClientRect();
    const cssW = Math.max(320, rect.width || window.innerWidth);
    const cssH = Math.max(200, rect.height || window.innerHeight);

    const maxDpr =
      this.quality === 'low' || this.degradedLow ? 1.0 : this.quality === 'high' ? 2.0 : 1.5;
    const dpr = Math.min(window.devicePixelRatio || 1, maxDpr);

    this.canvas.width = Math.round(cssW * dpr);
    this.canvas.height = Math.round(cssH * dpr);
    this.viewH = LOGICAL_VIEW_H;
    this.viewW = Math.round(LOGICAL_VIEW_H * (cssW / cssH));
  };

  public render(world: GameWorld, input: InputManager, fps: number): void {
    const ctx = this.ctx;
    const scale = this.canvas.height / this.viewH;

    const targetCamX = Math.max(
      0,
      Math.min(ARENA_W - this.viewW, world.player.x - this.viewW * 0.5)
    );
    const targetCamY = Math.max(
      0,
      Math.min(ARENA_H - this.viewH, world.player.y - this.viewH * 0.5)
    );
    this.camX += (targetCamX - this.camX) * 0.14;
    this.camY += (targetCamY - this.camY) * 0.14;

    const shakeMag = this.shakeEnabled ? world.shakeIntensity : 0;
    const sx = shakeMag > 0.2 ? (Math.random() - 0.5) * shakeMag : 0;
    const sy = shakeMag > 0.2 ? (Math.random() - 0.5) * shakeMag : 0;

    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, this.viewW, this.viewH);

    ctx.save();
    ctx.translate(-this.camX + sx, -this.camY + sy);

    this.drawBackground(ctx);
    this.drawPickups(ctx, world);
    this.drawParticles(ctx, world);
    this.drawBullets(ctx, world);
    this.drawEnemies(ctx, world);
    if (world.phase !== 'title') {
      this.drawPlayer(ctx, world);
    }
    this.drawFloatingTexts(ctx, world);

    ctx.restore();

    if (world.phase === 'playing') {
      this.drawCanvasHUD(ctx, world, input, fps);
    }
  }

  private drawBackground(ctx: CanvasRenderingContext2D): void {
    if (!this.degradedLow) {
      ctx.fillStyle = COLORS.white;
      for (let i = 0; i < this.stars.length; i++) {
        const s = this.stars[i];
        if (
          s.x < this.camX - 10 ||
          s.x > this.camX + this.viewW + 10 ||
          s.y < this.camY - 10 ||
          s.y > this.camY + this.viewH + 10
        ) {
          continue;
        }
        ctx.globalAlpha = s.alpha;
        ctx.fillRect(s.x, s.y, s.size, s.size);
      }
      ctx.globalAlpha = 1;
    }

    const step = 120;
    const startX = Math.max(0, Math.floor(this.camX / step) * step);
    const endX = Math.min(ARENA_W, this.camX + this.viewW + step);
    const startY = Math.max(0, Math.floor(this.camY / step) * step);
    const endY = Math.min(ARENA_H, this.camY + this.viewH + step);

    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let x = startX; x <= endX; x += step) {
      ctx.moveTo(x, startY);
      ctx.lineTo(x, endY);
    }
    for (let y = startY; y <= endY; y += step) {
      ctx.moveTo(startX, y);
      ctx.lineTo(endX, y);
    }
    ctx.stroke();

    ctx.strokeStyle = COLORS.border;
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, ARENA_W - 4, ARENA_H - 4);
  }

  private drawSpriteRotated(
    ctx: CanvasRenderingContext2D,
    sprite: HTMLCanvasElement,
    x: number,
    y: number,
    angle: number
  ): void {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.drawImage(sprite, -sprite.width * 0.5, -sprite.height * 0.5);
    ctx.restore();
  }

  private drawPlayer(ctx: CanvasRenderingContext2D, world: GameWorld): void {
    const p = world.player;
    if (p.invulnTimer > 0 && Math.floor(p.invulnTimer * 24) % 2 === 0 && p.dashTimer <= 0) {
      ctx.globalAlpha = 0.45;
    }
    const key: SpriteKey = p.overdriveTimer > 0 ? 'playerOverdrive' : 'player';
    this.drawSpriteRotated(ctx, this.sprites.get(key), p.x, p.y, p.angle);
    ctx.globalAlpha = 1;

    if (p.shield > 0) {
      ctx.strokeStyle = p.shield > 1 ? COLORS.lime : 'rgba(82, 255, 168, 0.65)';
      ctx.lineWidth = p.shield > 1 ? 3 : 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius + 9, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  private enemySpriteKey(type: EnemyType): SpriteKey {
    switch (type) {
      case 'drone':
        return 'enemyDrone';
      case 'lancer':
        return 'enemyLancer';
      case 'splitter':
        return 'enemySplitter';
      case 'shard':
        return 'enemyShard';
      case 'orbiter':
        return 'enemyOrbiter';
      case 'boss':
        return 'enemyBoss';
    }
  }

  private drawEnemies(ctx: CanvasRenderingContext2D, world: GameWorld): void {
    for (let i = 0; i < world.enemies.activeCount; i++) {
      const e = world.enemies.items[i];
      if (
        e.x < this.camX - 70 ||
        e.x > this.camX + this.viewW + 70 ||
        e.y < this.camY - 70 ||
        e.y > this.camY + this.viewH + 70
      ) {
        continue;
      }

      if (e.type === 'lancer' && e.phase === 1) {
        ctx.strokeStyle = 'rgba(255, 123, 59, 0.55)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(e.x, e.y);
        ctx.lineTo(e.x + Math.cos(e.angle) * 200, e.y + Math.sin(e.angle) * 200);
        ctx.stroke();
      }

      const sprite = this.sprites.get(this.enemySpriteKey(e.type));
      this.drawSpriteRotated(ctx, sprite, e.x, e.y, e.angle);

      if (e.hitFlash > 0) {
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.radius * 0.85, 0, Math.PI * 2);
        ctx.fill();
      }

      if (e.type === 'boss') {
        const barW = 90;
        const pct = Math.max(0, e.hp / e.maxHp);
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(e.x - barW * 0.5, e.y - 58, barW, 7);
        ctx.fillStyle = COLORS.pink;
        ctx.fillRect(e.x - barW * 0.5, e.y - 58, barW * pct, 7);
      }
    }
  }

  private drawBullets(ctx: CanvasRenderingContext2D, world: GameWorld): void {
    for (let i = 0; i < world.bullets.activeCount; i++) {
      const b = world.bullets.items[i];
      if (
        b.x < this.camX - 24 ||
        b.x > this.camX + this.viewW + 24 ||
        b.y < this.camY - 24 ||
        b.y > this.camY + this.viewH + 24
      ) {
        continue;
      }
      const key: SpriteKey = b.fromPlayer
        ? b.isOverdrive
          ? 'bulletOverdrive'
          : 'bulletPlayer'
        : b.isBossShot
          ? 'bulletBoss'
          : 'bulletEnemy';
      const spr = this.sprites.get(key);
      if (b.fromPlayer) {
        this.drawSpriteRotated(ctx, spr, b.x, b.y, b.angle);
      } else {
        ctx.drawImage(spr, b.x - spr.width * 0.5, b.y - spr.height * 0.5);
      }
    }
  }

  private drawPickups(ctx: CanvasRenderingContext2D, world: GameWorld): void {
    for (let i = 0; i < world.pickups.activeCount; i++) {
      const pk = world.pickups.items[i];
      const key: SpriteKey =
        pk.type === 'spread'
          ? 'pickupSpread'
          : pk.type === 'shield'
            ? 'pickupShield'
            : 'pickupCore';
      const spr = this.sprites.get(key);
      const bob = Math.sin(pk.bobPhase) * 4;
      if (pk.life < 2.5 && Math.floor(pk.life * 10) % 2 === 0) {
        ctx.globalAlpha = 0.4;
      }
      ctx.drawImage(spr, pk.x - spr.width * 0.5, pk.y - spr.height * 0.5 + bob);
      ctx.globalAlpha = 1;
    }
  }

  private drawParticles(ctx: CanvasRenderingContext2D, world: GameWorld): void {
    const pool = world.particles.pool;
    for (let i = 0; i < pool.activeCount; i++) {
      const p = pool.items[i];
      const t = Math.max(0, p.life / p.maxLife);
      ctx.globalAlpha = t;
      if (p.isRing) {
        const radius = p.size * (1 - t * 0.75);
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 2.5 * t;
        ctx.beginPath();
        ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x - p.size * 0.5, p.y - p.size * 0.5, p.size, p.size);
      }
    }
    ctx.globalAlpha = 1;
  }

  private drawFloatingTexts(ctx: CanvasRenderingContext2D, world: GameWorld): void {
    ctx.font = 'bold 16px system-ui, sans-serif';
    ctx.textAlign = 'center';
    for (let i = 0; i < world.texts.activeCount; i++) {
      const ft = world.texts.items[i];
      ctx.globalAlpha = Math.max(0, ft.life / ft.maxLife);
      ctx.fillStyle = ft.color;
      ctx.fillText(ft.text, ft.x, ft.y);
    }
    ctx.globalAlpha = 1;
  }

  private drawCanvasHUD(
    ctx: CanvasRenderingContext2D,
    world: GameWorld,
    input: InputManager,
    fps: number
  ): void {
    const p = world.player;

    ctx.textAlign = 'left';
    ctx.fillStyle = COLORS.white;
    ctx.font = '900 26px system-ui, sans-serif';
    ctx.fillText(Math.floor(world.score).toLocaleString(), 22, 38);

    if (world.combo > 1) {
      ctx.fillStyle = COLORS.gold;
      ctx.font = 'bold 16px system-ui, sans-serif';
      ctx.fillText(`x${world.combo} COMBO`, 22, 60);
    }

    for (let i = 0; i < p.maxHp; i++) {
      ctx.fillStyle = i < p.hp ? COLORS.pink : 'rgba(255, 59, 141, 0.2)';
      ctx.fillRect(22 + i * 26, 70, 20, 8);
    }

    ctx.textAlign = 'center';
    ctx.fillStyle = COLORS.cyan;
    ctx.font = '800 18px system-ui, sans-serif';
    ctx.fillText(`WAVE ${world.waveDirector.wave}`, this.viewW * 0.5, 32);

    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.font = '600 11px system-ui, sans-serif';
    ctx.fillText(`${fps} FPS`, this.viewW * 0.5, 49);

    if (world.waveDirector.waveBannerTimer > 0) {
      ctx.globalAlpha = Math.min(1, world.waveDirector.waveBannerTimer);
      ctx.fillStyle = COLORS.white;
      ctx.font = '900 38px system-ui, sans-serif';
      ctx.fillText(`WAVE ${world.waveDirector.wave}`, this.viewW * 0.5, this.viewH * 0.34);
      ctx.globalAlpha = 1;
    }

    if (input.joystick.active) {
      const rect = this.canvas.getBoundingClientRect();
      const toLogicalX = this.viewW / (rect.width || 1);
      const toLogicalY = this.viewH / (rect.height || 1);
      const ox = input.joystick.originX * toLogicalX;
      const oy = input.joystick.originY * toLogicalY;
      const kx = input.joystick.knobX * toLogicalX;
      const ky = input.joystick.knobY * toLogicalY;
      const r = input.joystick.radius * toLogicalX;

      ctx.strokeStyle = 'rgba(68, 229, 255, 0.4)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(ox, oy, r, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = 'rgba(68, 229, 255, 0.65)';
      ctx.beginPath();
      ctx.arc(kx, ky, r * 0.42, 0, Math.PI * 2);
      ctx.fill();
    }

    if (p.dashCooldown > 0) {
      const pct = 1 - p.dashCooldown / PLAYER_DASH_COOLDOWN;
      ctx.fillStyle = 'rgba(68, 229, 255, 0.35)';
      ctx.fillRect(this.viewW * 0.5 - 40, this.viewH - 18, 80 * pct, 4);
    }
  }
}
