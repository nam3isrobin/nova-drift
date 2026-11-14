import './style.css';
import { AudioEngine } from './core/AudioEngine';
import { GameLoop } from './core/GameLoop';
import { InputManager } from './core/InputManager';
import { Storage } from './core/Storage';
import { GameWorld } from './game/GameWorld';
import { Renderer } from './graphics/Renderer';
import { UIManager } from './ui/UIManager';

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
const storage = new Storage();
const audio = new AudioEngine();
const renderer = new Renderer(canvas);

let world: GameWorld;
let loop: GameLoop;

const ui = new UIManager(storage, {
  onPlay: () => {
    audio.unlock();
    tryFullscreenLandscape();
    world.startNewRun();
    ui.showPlaying();
    loop.resetTiming();
  },
  onPause: () => {
    if (world.phase === 'playing') {
      world.phase = 'paused';
      input.resetAll();
      ui.showPause();
    }
  },
  onResume: () => {
    audio.unlock();
    if (world.phase === 'paused') {
      world.phase = 'playing';
      ui.showPlaying();
      loop.resetTiming();
    }
  },
  onQuit: () => {
    world.phase = 'title';
    input.resetAll();
    ui.showTitle();
  },
  onRetry: () => {
    audio.unlock();
    world.startNewRun();
    ui.showPlaying();
    loop.resetTiming();
  },
  onSettingsChanged: (settings) => {
    audio.setEnabled(settings.sfx);
    renderer.setSettings(settings.shake, settings.quality);
    world.particles.densityScale = settings.quality === 'low' ? 0.5 : 1.0;
  }
});

const input = new InputManager(canvas, ui.dashBtn, ui.overdriveBtn, () => {
  audio.unlock();
});

world = new GameWorld(input, audio, (score, wave) => {
  const isNewBest = storage.recordRun(score, wave);
  ui.showGameOver(score, wave, isNewBest);
});

const initialSettings = storage.getSettings();
audio.setEnabled(initialSettings.sfx);
renderer.setSettings(initialSettings.shake, initialSettings.quality);
world.particles.densityScale = initialSettings.quality === 'low' ? 0.5 : 1.0;

loop = new GameLoop(
  (dt) => {
    if (input.consumePause()) {
      if (world.phase === 'playing') {
        world.phase = 'paused';
        input.resetAll();
        ui.showPause();
        return;
      } else if (world.phase === 'paused') {
        world.phase = 'playing';
        ui.showPlaying();
      }
    }
    world.update(dt);
  },
  () => {
    renderer.render(world, input, loop.currentFps);
    if (world.phase === 'playing') {
      ui.updateTouchHUD(world.player.dashCooldown, world.player.overdriveCharge);
    }
  },
  () => {
    renderer.forceLowQuality(world);
  }
);

window.addEventListener('resize', renderer.resize);
window.addEventListener('orientationchange', () => {
  setTimeout(renderer.resize, 150);
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    audio.suspend();
    if (world.phase === 'playing') {
      world.phase = 'paused';
      input.resetAll();
      ui.showPause();
    }
  } else {
    audio.resume();
    loop.resetTiming();
  }
});

function tryFullscreenLandscape(): void {
  const el = document.documentElement;
  if (el.requestFullscreen && !document.fullscreenElement) {
    el.requestFullscreen()
      .then(() => {
        const scr = screen as unknown as {
          orientation?: { lock?: (mode: string) => Promise<void> };
        };
        return scr.orientation?.lock?.('landscape');
      })
      .catch(() => {});
  }
}

ui.showTitle();
loop.start();
