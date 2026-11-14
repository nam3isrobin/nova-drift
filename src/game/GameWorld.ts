import { AudioEngine } from '../core/AudioEngine';
import { InputManager } from '../core/InputManager';
import { ObjectPool } from '../core/ObjectPool';
import { ParticleSystem } from '../graphics/Particles';
import { circleHit, distSq } from './Collision';
import {
  ARENA_H,
  ARENA_W,
  COLORS,
  COMBO_DECAY_TIME,
  OVERDRIVE_DURATION,
  PLAYER_DASH_COOLDOWN,
  PLAYER_DASH_DURATION,
  PLAYER_DASH_SPEED,
  PLAYER_GRAZE_PAD,
  PLAYER_INVULN_HIT,
  PLAYER_RADIUS,
  PLAYER_SPEED
} from './Constants';
import type { Bullet, Enemy, EnemyType, FloatingText, Pickup, PickupType, Player } from './Entities';
import { WaveDirector } from './WaveDirector';

export type WorldPhase = 'title' | 'playing' | 'paused' | 'gameover';

export class GameWorld {
  public phase: WorldPhase = 'title';
  public score = 0;
  public combo = 1;
  public comboTimer = 0;
  public shakeIntensity = 0;
  public hitStopTimer = 0;

  public readonly player: Player = {
    x: ARENA_W * 0.5,
    y: ARENA_H * 0.5,
    vx: 0,
    vy: 0,
    angle: 0,
    radius: PLAYER_RADIUS,
    hp: 3,
    maxHp: 3,
    shield: 0,
    fireCooldown: 0,
    spreadTimer: 0,
    dashTimer: 0,
    dashCooldown: 0,
    dashDirX: 1,
    dashDirY: 0,
    invulnTimer: 0,
    overdriveCharge: 0,
    overdriveTimer: 0
  };

  public readonly bullets = new ObjectPool<Bullet>(280, () => ({
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    angle: 0,
    radius: 5,
    damage: 1,
    life: 0,
    fromPlayer: true,
    isBossShot: false,
    isOverdrive: false,
    grazed: false
  }));

  public readonly enemies = new ObjectPool<Enemy>(90, () => ({
    type: 'drone',
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    angle: 0,
    radius: 14,
    hp: 1,
    maxHp: 1,
    speed: 100,
    scoreValue: 50,
    fireTimer: 0,
    stateTimer: 0,
    phase: 0,
    hitFlash: 0
  }));

  public readonly pickups = new ObjectPool<Pickup>(24, () => ({
    type: 'core',
    x: 0,
    y: 0,
    life: 0,
    bobPhase: 0
  }));

  public readonly texts = new ObjectPool<FloatingText>(50, () => ({
    x: 0,
    y: 0,
    vy: -40,
    text: '',
    color: COLORS.white,
    life: 0,
    maxLife: 0.7
  }));

  public readonly particles = new ParticleSystem(420);
  public readonly waveDirector = new WaveDirector();

  private input: InputManager;
  private audio: AudioEngine;
  private onGameOver: (score: number, wave: number) => void;

  constructor(
    input: InputManager,
    audio: AudioEngine,
    onGameOver: (score: number, wave: number) => void
  ) {
    this.input = input;
    this.audio = audio;
    this.onGameOver = onGameOver;
  }

  public startNewRun(): void {
    this.score = 0;
    this.combo = 1;
    this.comboTimer = 0;
    this.shakeIntensity = 0;
    this.hitStopTimer = 0;

    const p = this.player;
    p.x = ARENA_W * 0.5;
    p.y = ARENA_H * 0.5;
    p.vx = 0;
    p.vy = 0;
    p.angle = 0;
    p.hp = 3;
    p.maxHp = 3;
    p.shield = 1;
    p.fireCooldown = 0;
    p.spreadTimer = 0;
    p.dashTimer = 0;
    p.dashCooldown = 0;
    p.invulnTimer = 0;
    p.overdriveCharge = 25;
    p.overdriveTimer = 0;

    this.bullets.clear();
    this.enemies.clear();
    this.pickups.clear();
    this.texts.clear();
    this.particles.clear();
    this.waveDirector.reset();
    this.input.resetAll();
    this.phase = 'playing';
  }

  public update(dt: number): void {
    if (this.phase !== 'playing') return;

    if (this.hitStopTimer > 0) {
      this.hitStopTimer -= dt;
      this.shakeIntensity = Math.max(0, this.shakeIntensity - dt * 28);
      return;
    }

    this.shakeIntensity = Math.max(0, this.shakeIntensity - dt * 26);

    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) {
        this.combo = 1;
      }
    }

    this.input.syncKeyboardMovement();
    this.updatePlayer(dt);
    this.updateSpawning(dt);
    this.updateEnemies(dt);
    this.updateBullets(dt);
    this.updatePickups(dt);
    this.updateTexts(dt);
    this.particles.update(dt);
  }

  private updatePlayer(dt: number): void {
    const p = this.player;
    if (p.invulnTimer > 0) p.invulnTimer -= dt;
    if (p.dashCooldown > 0) p.dashCooldown -= dt;
    if (p.spreadTimer > 0) p.spreadTimer -= dt;
    if (p.overdriveTimer > 0) p.overdriveTimer -= dt;

    if (this.input.consumeDash() && p.dashCooldown <= 0 && p.dashTimer <= 0) {
      p.dashTimer = PLAYER_DASH_DURATION;
      p.dashCooldown = PLAYER_DASH_COOLDOWN;
      p.invulnTimer = Math.max(p.invulnTimer, PLAYER_DASH_DURATION + 0.06);

      const mx = this.input.moveX;
      const my = this.input.moveY;
      if (Math.abs(mx) > 0.05 || Math.abs(my) > 0.05) {
        const len = Math.hypot(mx, my);
        p.dashDirX = mx / len;
        p.dashDirY = my / len;
      } else {
        p.dashDirX = Math.cos(p.angle);
        p.dashDirY = Math.sin(p.angle);
      }
      this.audio.playDash();
      this.particles.ring(p.x, p.y, COLORS.cyan, 44, 0.22);
    }

    if (this.input.consumeOverdrive() && p.overdriveCharge >= 100) {
      this.triggerOverdrive();
    }

    if (p.dashTimer > 0) {
      p.dashTimer -= dt;
      p.vx = p.dashDirX * PLAYER_DASH_SPEED;
      p.vy = p.dashDirY * PLAYER_DASH_SPEED;
      if (Math.random() < 0.65) {
        this.particles.burst(p.x, p.y, COLORS.cyan, 2, 90, 2.5);
      }
    } else {
      const speedMul = p.overdriveTimer > 0 ? 1.2 : 1.0;
      p.vx = this.input.moveX * PLAYER_SPEED * speedMul;
      p.vy = this.input.moveY * PLAYER_SPEED * speedMul;
    }

    p.x = Math.max(p.radius + 8, Math.min(ARENA_W - p.radius - 8, p.x + p.vx * dt));
    p.y = Math.max(p.radius + 8, Math.min(ARENA_H - p.radius - 8, p.y + p.vy * dt));

    const target = this.findNearestEnemy(p.x, p.y, 760);
    if (target) {
      p.angle = Math.atan2(target.y - p.y, target.x - p.x);
    } else if (Math.abs(p.vx) > 10 || Math.abs(p.vy) > 10) {
      p.angle = Math.atan2(p.vy, p.vx);
    }

    if (p.fireCooldown > 0) p.fireCooldown -= dt;
    if (this.enemies.activeCount > 0 && p.fireCooldown <= 0) {
      const isOd = p.overdriveTimer > 0;
      p.fireCooldown = isOd ? 0.08 : 0.135;
      this.firePlayerVolley(isOd);
    }
  }

  private firePlayerVolley(isOd: boolean): void {
    const p = this.player;
    const muzzleX = p.x + Math.cos(p.angle) * 18;
    const muzzleY = p.y + Math.sin(p.angle) * 18;
    const dmg = isOd ? 2 : 1;

    if (p.spreadTimer > 0 || isOd) {
      const spreadAngles = [-0.16, 0, 0.16];
      for (const offset of spreadAngles) {
        this.spawnBullet(muzzleX, muzzleY, p.angle + offset, 840, dmg, true, false, isOd);
      }
    } else {
      this.spawnBullet(muzzleX, muzzleY, p.angle, 820, dmg, true, false, false);
    }
    this.audio.playShoot(isOd);
  }

  private triggerOverdrive(): void {
    const p = this.player;
    p.overdriveCharge = 0;
    p.overdriveTimer = OVERDRIVE_DURATION;
    p.invulnTimer = Math.max(p.invulnTimer, 0.6);
    this.shakeIntensity = 12;
    this.audio.playOverdrive();
    this.particles.ring(p.x, p.y, COLORS.gold, 420, 0.42);
    this.addFloatingText(p.x, p.y - 32, 'OVERDRIVE!', COLORS.gold);

    for (let i = this.bullets.activeCount - 1; i >= 0; i--) {
      const b = this.bullets.items[i];
      if (!b.fromPlayer) {
        this.particles.burst(b.x, b.y, COLORS.gold, 2, 110, 2);
        this.score += 10 * this.combo;
        this.bullets.releaseAt(i);
      }
    }

    const empRadiusSq = 430 * 430;
    for (let i = this.enemies.activeCount - 1; i >= 0; i--) {
      const e = this.enemies.items[i];
      if (distSq(p.x, p.y, e.x, e.y) <= empRadiusSq) {
        e.hp -= 12;
        e.hitFlash = 0.15;
        if (e.hp <= 0) {
          this.killEnemyAt(i);
        }
      }
    }
  }

  private findNearestEnemy(x: number, y: number, maxRange: number): Enemy | null {
    let best: Enemy | null = null;
    let bestD2 = maxRange * maxRange;
    for (let i = 0; i < this.enemies.activeCount; i++) {
      const e = this.enemies.items[i];
      const d2 = distSq(x, y, e.x, e.y);
      if (d2 < bestD2) {
        bestD2 = d2;
        best = e;
      }
    }
    return best;
  }

  private updateSpawning(dt: number): void {
    const wd = this.waveDirector;
    if (wd.waveBannerTimer > 0) wd.waveBannerTimer -= dt;

    if (wd.spawnQueue.length > 0) {
      wd.spawnTimer -= dt;
      if (wd.spawnTimer <= 0) {
        const type = wd.spawnQueue.shift()!;
        const pt = wd.pickSpawnPoint(this.player.x, this.player.y);
        this.spawnEnemy(type, pt.x, pt.y);
        const interval = Math.max(0.22, 0.85 - wd.wave * 0.04);
        wd.spawnTimer = interval;
      }
    } else if (this.enemies.activeCount === 0) {
      wd.advanceWave();
      this.audio.playWaveClear();
      this.addFloatingText(this.player.x, this.player.y - 38, `WAVE ${wd.wave}`, COLORS.cyan);
    }
  }

  private spawnEnemy(type: EnemyType, x: number, y: number): void {
    const e = this.enemies.acquire();
    if (!e) return;
    const waveScale = 1 + (this.waveDirector.wave - 1) * 0.12;

    e.type = type;
    e.x = x;
    e.y = y;
    e.vx = 0;
    e.vy = 0;
    e.angle = Math.atan2(this.player.y - y, this.player.x - x);
    e.hitFlash = 0;
    e.phase = 0;
    e.stateTimer = 1.0 + Math.random() * 0.8;
    e.fireTimer = 1.2 + Math.random();

    switch (type) {
      case 'drone':
        e.radius = 13;
        e.maxHp = Math.round(2 * waveScale);
        e.speed = 145 + Math.min(90, this.waveDirector.wave * 5);
        e.scoreValue = 60;
        break;
      case 'lancer':
        e.radius = 15;
        e.maxHp = Math.round(3 * waveScale);
        e.speed = 125;
        e.scoreValue = 110;
        break;
      case 'splitter':
        e.radius = 19;
        e.maxHp = Math.round(5 * waveScale);
        e.speed = 95;
        e.scoreValue = 150;
        break;
      case 'shard':
        e.radius = 9;
        e.maxHp = 1;
        e.speed = 215;
        e.scoreValue = 40;
        break;
      case 'orbiter':
        e.radius = 15;
        e.maxHp = Math.round(4 * waveScale);
        e.speed = 135;
        e.scoreValue = 130;
        break;
      case 'boss':
        e.radius = 42;
        e.maxHp = Math.round(75 * waveScale);
        e.speed = 78;
        e.scoreValue = 1500;
        e.fireTimer = 1.0;
        break;
    }
    e.hp = e.maxHp;
    this.particles.ring(x, y, COLORS.pink, e.radius * 2, 0.25);
  }

  private updateEnemies(dt: number): void {
    const p = this.player;

    for (let i = this.enemies.activeCount - 1; i >= 0; i--) {
      const e = this.enemies.items[i];
      if (e.hitFlash > 0) e.hitFlash -= dt;

      const dx = p.x - e.x;
      const dy = p.y - e.y;
      const dist = Math.hypot(dx, dy) || 1;
      const nx = dx / dist;
      const ny = dy / dist;

      if (e.type === 'drone' || e.type === 'shard') {
        e.angle = Math.atan2(dy, dx);
        e.vx = nx * e.speed;
        e.vy = ny * e.speed;
      } else if (e.type === 'lancer') {
        e.stateTimer -= dt;
        if (e.phase === 0) {
          e.angle = Math.atan2(dy, dx);
          e.vx = nx * e.speed;
          e.vy = ny * e.speed;
          if (e.stateTimer <= 0 && dist < 440) {
            e.phase = 1;
            e.stateTimer = 0.45;
            e.vx = 0;
            e.vy = 0;
          }
        } else if (e.phase === 1) {
          e.angle = Math.atan2(dy, dx);
          if (e.stateTimer <= 0) {
            e.phase = 2;
            e.stateTimer = 0.42;
            e.vx = Math.cos(e.angle) * 460;
            e.vy = Math.sin(e.angle) * 460;
          }
        } else {
          if (e.stateTimer <= 0) {
            e.phase = 0;
            e.stateTimer = 1.6;
          }
        }
      } else if (e.type === 'splitter') {
        e.angle += dt * 1.4;
        e.vx = nx * e.speed;
        e.vy = ny * e.speed;
      } else if (e.type === 'orbiter') {
        e.angle = Math.atan2(dy, dx);
        const radial = dist > 280 ? 1 : dist < 210 ? -0.8 : 0;
        e.vx = (nx * radial - ny * 0.85) * e.speed;
        e.vy = (ny * radial + nx * 0.85) * e.speed;

        e.fireTimer -= dt;
        if (e.fireTimer <= 0) {
          e.fireTimer = 1.85;
          this.spawnBullet(e.x, e.y, e.angle, 270, 1, false, false, false);
        }
      } else if (e.type === 'boss') {
        e.angle += dt * 0.7;
        e.vx = nx * e.speed;
        e.vy = ny * e.speed;
        e.fireTimer -= dt;
        if (e.fireTimer <= 0) {
          e.phase = (e.phase + 1) % 3;
          if (e.phase === 0) {
            const count = 12;
            for (let k = 0; k < count; k++) {
              const a = e.angle + (k * Math.PI * 2) / count;
              this.spawnBullet(e.x, e.y, a, 240, 1, false, true, false);
            }
            e.fireTimer = 1.3;
          } else {
            const baseA = Math.atan2(dy, dx);
            for (const off of [-0.24, 0, 0.24]) {
              this.spawnBullet(e.x, e.y, baseA + off, 310, 1, false, true, false);
            }
            e.fireTimer = 0.95;
          }
        }
      }

      e.x = Math.max(e.radius, Math.min(ARENA_W - e.radius, e.x + e.vx * dt));
      e.y = Math.max(e.radius, Math.min(ARENA_H - e.radius, e.y + e.vy * dt));

      if (circleHit(p.x, p.y, p.radius, e.x, e.y, e.radius)) {
        if (p.dashTimer > 0) {
          e.hp -= 3;
          e.hitFlash = 0.14;
          e.x += p.dashDirX * 26;
          e.y += p.dashDirY * 26;
          this.audio.playHit();
          if (e.hp <= 0) {
            this.killEnemyAt(i);
          }
        } else {
          this.damagePlayer();
        }
      }
    }
  }

  private spawnBullet(
    x: number,
    y: number,
    angle: number,
    speed: number,
    damage: number,
    fromPlayer: boolean,
    isBossShot: boolean,
    isOverdrive: boolean
  ): void {
    const b = this.bullets.acquire();
    if (!b) return;
    b.x = x;
    b.y = y;
    b.angle = angle;
    b.vx = Math.cos(angle) * speed;
    b.vy = Math.sin(angle) * speed;
    b.damage = damage;
    b.fromPlayer = fromPlayer;
    b.isBossShot = isBossShot;
    b.isOverdrive = isOverdrive;
    b.radius = fromPlayer ? 6 : isBossShot ? 7 : 5;
    b.life = fromPlayer ? 1.35 : 3.2;
    b.grazed = false;
  }

  private updateBullets(dt: number): void {
    const p = this.player;

    for (let i = this.bullets.activeCount - 1; i >= 0; i--) {
      const b = this.bullets.items[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;

      if (b.life <= 0 || b.x < 0 || b.x > ARENA_W || b.y < 0 || b.y > ARENA_H) {
        this.bullets.releaseAt(i);
        continue;
      }

      if (b.fromPlayer) {
        let hit = false;
        for (let j = this.enemies.activeCount - 1; j >= 0; j--) {
          const e = this.enemies.items[j];
          if (circleHit(b.x, b.y, b.radius, e.x, e.y, e.radius)) {
            e.hp -= b.damage;
            e.hitFlash = 0.08;
            this.particles.burst(b.x, b.y, b.isOverdrive ? COLORS.gold : COLORS.cyan, 3, 150, 2);
            if (e.hp <= 0) {
              this.killEnemyAt(j);
            } else {
              this.audio.playHit();
            }
            hit = true;
            break;
          }
        }
        if (hit) {
          this.bullets.releaseAt(i);
        }
      } else {
        if (circleHit(b.x, b.y, b.radius, p.x, p.y, p.radius - 2)) {
          if (p.dashTimer <= 0) {
            this.bullets.releaseAt(i);
            this.damagePlayer();
          }
        } else if (
          !b.grazed &&
          circleHit(b.x, b.y, b.radius, p.x, p.y, p.radius + PLAYER_GRAZE_PAD)
        ) {
          b.grazed = true;
          this.comboTimer = COMBO_DECAY_TIME;
          this.score += 15 * this.combo;
          p.overdriveCharge = Math.min(100, p.overdriveCharge + 7);
          this.audio.playGraze();
          this.particles.burst(p.x, p.y, COLORS.cyan, 2, 120, 2);
        }
      }
    }
  }

  private killEnemyAt(index: number): void {
    const e = this.enemies.items[index];
    const ex = e.x;
    const ey = e.y;
    const eType = e.type;
    const baseScore = e.scoreValue;

    this.enemies.releaseAt(index);

    this.combo = Math.min(16, this.combo + 1);
    this.comboTimer = COMBO_DECAY_TIME;
    const gained = baseScore * this.combo;
    this.score += gained;
    this.player.overdriveCharge = Math.min(
      100,
      this.player.overdriveCharge + (eType === 'boss' ? 40 : 5)
    );

    const isBoss = eType === 'boss';
    this.audio.playExplosion(isBoss);
    this.particles.burst(
      ex,
      ey,
      isBoss ? COLORS.gold : COLORS.pink,
      isBoss ? 26 : 10,
      isBoss ? 340 : 210,
      isBoss ? 4 : 2.8
    );

    if (isBoss) {
      this.particles.ring(ex, ey, COLORS.gold, 150, 0.45);
      this.shakeIntensity = 14;
      this.hitStopTimer = 0.045;
      this.addFloatingText(ex, ey, `+${gained}`, COLORS.gold);
    } else {
      this.shakeIntensity = Math.max(this.shakeIntensity, 3.2);
      this.addFloatingText(ex, ey, `+${gained}`, COLORS.white);
    }

    if (eType === 'splitter') {
      this.spawnEnemy('shard', ex - 12, ey - 8);
      this.spawnEnemy('shard', ex + 12, ey + 8);
    }

    const dropChance = isBoss ? 1.0 : 0.11;
    if (Math.random() < dropChance) {
      const r = Math.random();
      const pType: PickupType = r < 0.36 ? 'spread' : r < 0.7 ? 'core' : 'shield';
      this.spawnPickup(pType, ex, ey);
    }
  }

  private spawnPickup(type: PickupType, x: number, y: number): void {
    const pk = this.pickups.acquire();
    if (!pk) return;
    pk.type = type;
    pk.x = x;
    pk.y = y;
    pk.life = 11;
    pk.bobPhase = Math.random() * Math.PI * 2;
  }

  private updatePickups(dt: number): void {
    const p = this.player;
    for (let i = this.pickups.activeCount - 1; i >= 0; i--) {
      const pk = this.pickups.items[i];
      pk.life -= dt;
      pk.bobPhase += dt * 4;
      if (pk.life <= 0) {
        this.pickups.releaseAt(i);
        continue;
      }

      const d2 = distSq(p.x, p.y, pk.x, pk.y);
      if (d2 < 140 * 140) {
        const d = Math.sqrt(d2) || 1;
        pk.x += ((p.x - pk.x) / d) * 260 * dt;
        pk.y += ((p.y - pk.y) / d) * 260 * dt;
      }

      if (circleHit(p.x, p.y, p.radius + 8, pk.x, pk.y, 14)) {
        this.audio.playPickup();
        if (pk.type === 'spread') {
          p.spreadTimer = 9.0;
          this.addFloatingText(pk.x, pk.y, 'SPREAD SHOT!', COLORS.cyan);
        } else if (pk.type === 'shield') {
          if (p.shield < 2) p.shield++;
          else if (p.hp < p.maxHp) p.hp++;
          this.addFloatingText(pk.x, pk.y, 'SHIELD +1', COLORS.lime);
        } else {
          p.overdriveCharge = Math.min(100, p.overdriveCharge + 30);
          this.addFloatingText(pk.x, pk.y, 'EMP +30%', COLORS.gold);
        }
        this.particles.ring(pk.x, pk.y, COLORS.lime, 34, 0.22);
        this.pickups.releaseAt(i);
      }
    }
  }

  private damagePlayer(): void {
    const p = this.player;
    if (p.invulnTimer > 0) return;

    p.invulnTimer = PLAYER_INVULN_HIT;
    this.shakeIntensity = 13;
    this.hitStopTimer = 0.04;
    this.combo = 1;
    this.comboTimer = 0;
    this.audio.playPlayerHurt();
    this.particles.burst(p.x, p.y, COLORS.pink, 18, 260, 3);

    if (p.shield > 0) {
      p.shield--;
      this.particles.ring(p.x, p.y, COLORS.lime, 64, 0.28);
      this.addFloatingText(p.x, p.y - 24, 'SHIELD BROKEN!', COLORS.lime);
      return;
    }

    p.hp--;
    if (p.hp <= 0) {
      this.phase = 'gameover';
      this.particles.ring(p.x, p.y, COLORS.pink, 160, 0.5);
      this.onGameOver(this.score, this.waveDirector.wave);
    }
  }

  private addFloatingText(x: number, y: number, text: string, color: string): void {
    const ft = this.texts.acquire();
    if (!ft) return;
    ft.x = x;
    ft.y = y;
    ft.vy = -42;
    ft.text = text;
    ft.color = color;
    ft.maxLife = 0.72;
    ft.life = 0.72;
  }

  private updateTexts(dt: number): void {
    for (let i = this.texts.activeCount - 1; i >= 0; i--) {
      const ft = this.texts.items[i];
      ft.y += ft.vy * dt;
      ft.life -= dt;
      if (ft.life <= 0) {
        this.texts.releaseAt(i);
      }
    }
  }
}
