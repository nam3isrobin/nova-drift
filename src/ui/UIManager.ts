import { type GameSettings, type QualitySetting, Storage } from '../core/Storage';
import { PLAYER_DASH_COOLDOWN } from '../game/Constants';

export interface UIActions {
  onPlay: () => void;
  onPause: () => void;
  onResume: () => void;
  onQuit: () => void;
  onRetry: () => void;
  onSettingsChanged: (settings: GameSettings) => void;
}

export class UIManager {
  private hudOverlay = document.getElementById('hud-overlay')!;
  private titleScreen = document.getElementById('screen-title')!;
  private pauseScreen = document.getElementById('screen-pause')!;
  private settingsScreen = document.getElementById('screen-settings')!;
  private gameOverScreen = document.getElementById('screen-gameover')!;

  private titleBest = document.getElementById('title-best')!;
  private goScore = document.getElementById('go-score')!;
  private goWave = document.getElementById('go-wave')!;
  private goNewBest = document.getElementById('go-new-best')!;
  private goLeaderboard = document.getElementById('go-leaderboard')!;

  public readonly dashBtn = document.getElementById('btn-dash') as HTMLButtonElement;
  public readonly overdriveBtn = document.getElementById('btn-overdrive') as HTMLButtonElement;
  private dashRing = document.getElementById('dash-ring')!;
  private overdriveRing = document.getElementById('overdrive-ring')!;
  private overdrivePct = document.getElementById('overdrive-pct')!;

  private optSfx = document.getElementById('opt-sfx')!;
  private optShake = document.getElementById('opt-shake')!;
  private optQuality = document.getElementById('opt-quality')!;

  private returnToPauseFromSettings = false;
  private lastDashScale = -1;
  private lastOdInt = -1;
  private lastOdReady = false;

  private storage: Storage;
  private actions: UIActions;

  constructor(storage: Storage, actions: UIActions) {
    this.storage = storage;
    this.actions = actions;

    document.getElementById('btn-play')!.addEventListener('click', actions.onPlay);
    document.getElementById('btn-pause')!.addEventListener('click', actions.onPause);
    document.getElementById('btn-resume')!.addEventListener('click', actions.onResume);
    document.getElementById('btn-quit')!.addEventListener('click', actions.onQuit);
    document.getElementById('btn-retry')!.addEventListener('click', actions.onRetry);
    document.getElementById('btn-go-title')!.addEventListener('click', actions.onQuit);

    document.getElementById('btn-settings-open')!.addEventListener('click', () => {
      this.openSettings(false);
    });
    document.getElementById('btn-pause-settings')!.addEventListener('click', () => {
      this.openSettings(true);
    });
    document.getElementById('btn-settings-close')!.addEventListener('click', () => {
      this.closeSettings();
    });

    this.optSfx.addEventListener('click', () => this.toggleSfx());
    this.optShake.addEventListener('click', () => this.toggleShake());
    this.optQuality.addEventListener('click', () => this.cycleQuality());

    this.syncSettingsLabels();
    this.refreshTitleBest();
  }

  public showTitle(): void {
    this.refreshTitleBest();
    this.hudOverlay.classList.add('hidden');
    this.pauseScreen.classList.add('hidden');
    this.settingsScreen.classList.add('hidden');
    this.gameOverScreen.classList.add('hidden');
    this.titleScreen.classList.remove('hidden');
  }

  public showPlaying(): void {
    this.titleScreen.classList.add('hidden');
    this.pauseScreen.classList.add('hidden');
    this.settingsScreen.classList.add('hidden');
    this.gameOverScreen.classList.add('hidden');
    this.hudOverlay.classList.remove('hidden');
  }

  public showPause(): void {
    this.hudOverlay.classList.add('hidden');
    this.settingsScreen.classList.add('hidden');
    this.pauseScreen.classList.remove('hidden');
  }

  public showGameOver(score: number, wave: number, isNewBest: boolean): void {
    this.hudOverlay.classList.add('hidden');
    this.pauseScreen.classList.add('hidden');
    this.goScore.textContent = Math.floor(score).toLocaleString();
    this.goWave.textContent = String(wave);
    this.goNewBest.classList.toggle('hidden', !isNewBest);

    const scores = this.storage.getHighScores();
    this.goLeaderboard.innerHTML =
      scores.length > 0
        ? scores
            .map(
              (entry, idx) =>
                `<div>#${idx + 1} &mdash; ${entry.score.toLocaleString()} (Wave ${entry.wave})</div>`
            )
            .join('')
        : '<div>No recorded runs yet.</div>';

    this.gameOverScreen.classList.remove('hidden');
  }

  public updateTouchHUD(dashCooldown: number, overdriveCharge: number): void {
    const dashReadyRatio = Math.max(0, Math.min(1, 1 - dashCooldown / PLAYER_DASH_COOLDOWN));
    const dashScale = Math.round(dashReadyRatio * 100) / 100;
    if (dashScale !== this.lastDashScale) {
      this.lastDashScale = dashScale;
      this.dashRing.style.transform = `scaleY(${dashScale})`;
      this.dashBtn.style.opacity = dashScale >= 1 ? '1' : '0.62';
    }

    const odInt = Math.floor(overdriveCharge);
    const odReady = odInt >= 100;
    if (odInt !== this.lastOdInt || odReady !== this.lastOdReady) {
      this.lastOdInt = odInt;
      this.lastOdReady = odReady;
      this.overdriveRing.style.transform = `scaleY(${odInt / 100})`;
      this.overdrivePct.textContent = odReady ? 'READY' : `${odInt}%`;
      this.overdriveBtn.disabled = !odReady;
      this.overdriveBtn.classList.toggle('ready', odReady);
    }
  }

  private refreshTitleBest(): void {
    this.titleBest.textContent = `BEST: ${this.storage.getBestScore().toLocaleString()} | WAVE ${this.storage.getBestWave()}`;
  }

  private openSettings(fromPause: boolean): void {
    this.returnToPauseFromSettings = fromPause;
    this.titleScreen.classList.add('hidden');
    this.pauseScreen.classList.add('hidden');
    this.settingsScreen.classList.remove('hidden');
  }

  private closeSettings(): void {
    this.settingsScreen.classList.add('hidden');
    if (this.returnToPauseFromSettings) {
      this.pauseScreen.classList.remove('hidden');
    } else {
      this.titleScreen.classList.remove('hidden');
    }
  }

  private toggleSfx(): void {
    const s = this.storage.getSettings();
    s.sfx = !s.sfx;
    this.storage.saveSettings(s);
    this.syncSettingsLabels();
    this.actions.onSettingsChanged(s);
  }

  private toggleShake(): void {
    const s = this.storage.getSettings();
    s.shake = !s.shake;
    this.storage.saveSettings(s);
    this.syncSettingsLabels();
    this.actions.onSettingsChanged(s);
  }

  private cycleQuality(): void {
    const order: QualitySetting[] = ['auto', 'low', 'high'];
    const s = this.storage.getSettings();
    const next = order[(order.indexOf(s.quality) + 1) % order.length];
    s.quality = next;
    this.storage.saveSettings(s);
    this.syncSettingsLabels();
    this.actions.onSettingsChanged(s);
  }

  private syncSettingsLabels(): void {
    const s = this.storage.getSettings();
    this.optSfx.textContent = s.sfx ? 'ON' : 'OFF';
    this.optShake.textContent = s.shake ? 'ON' : 'OFF';
    this.optQuality.textContent = s.quality.toUpperCase();
  }
}
