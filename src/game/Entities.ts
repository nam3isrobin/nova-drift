export type EnemyType = 'drone' | 'lancer' | 'splitter' | 'shard' | 'orbiter' | 'boss';
export type PickupType = 'spread' | 'shield' | 'core';

export interface Player {
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  radius: number;
  hp: number;
  maxHp: number;
  shield: number;
  fireCooldown: number;
  spreadTimer: number;
  dashTimer: number;
  dashCooldown: number;
  dashDirX: number;
  dashDirY: number;
  invulnTimer: number;
  overdriveCharge: number;
  overdriveTimer: number;
}

export interface Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  radius: number;
  damage: number;
  life: number;
  fromPlayer: boolean;
  isBossShot: boolean;
  isOverdrive: boolean;
  grazed: boolean;
}

export interface Enemy {
  type: EnemyType;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  radius: number;
  hp: number;
  maxHp: number;
  speed: number;
  scoreValue: number;
  fireTimer: number;
  stateTimer: number;
  phase: number;
  hitFlash: number;
}

export interface Pickup {
  type: PickupType;
  x: number;
  y: number;
  life: number;
  bobPhase: number;
}

export interface FloatingText {
  x: number;
  y: number;
  vy: number;
  text: string;
  color: string;
  life: number;
  maxLife: number;
}
