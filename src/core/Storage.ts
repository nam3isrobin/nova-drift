export type QualitySetting = 'auto' | 'low' | 'high';

export interface GameSettings {
  sfx: boolean;
  shake: boolean;
  quality: QualitySetting;
}

export interface ScoreEntry {
  score: number;
  wave: number;
}

interface SaveData {
  version: number;
  settings: GameSettings;
  highScores: ScoreEntry[];
  bestWave: number;
}

const STORAGE_KEY = 'nova_drift_save_v1';

const DEFAULT_SAVE: SaveData = {
  version: 1,
  settings: {
    sfx: true,
    shake: true,
    quality: 'auto'
  },
  highScores: [],
  bestWave: 1
};

export class Storage {
  private data: SaveData;

  constructor() {
    this.data = this.load();
  }

  private load(): SaveData {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return structuredClone(DEFAULT_SAVE);
      const parsed = JSON.parse(raw) as Partial<SaveData>;
      return {
        version: 1,
        settings: {
          sfx: parsed.settings?.sfx ?? true,
          shake: parsed.settings?.shake ?? true,
          quality: parsed.settings?.quality ?? 'auto'
        },
        highScores: Array.isArray(parsed.highScores) ? parsed.highScores.slice(0, 5) : [],
        bestWave: typeof parsed.bestWave === 'number' ? parsed.bestWave : 1
      };
    } catch {
      return structuredClone(DEFAULT_SAVE);
    }
  }

  private persist(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
    } catch {
      // Ignore storage quota/private mode errors gracefully
    }
  }

  public getSettings(): GameSettings {
    return this.data.settings;
  }

  public saveSettings(settings: GameSettings): void {
    this.data.settings = { ...settings };
    this.persist();
  }

  public getBestScore(): number {
    return this.data.highScores[0]?.score ?? 0;
  }

  public getBestWave(): number {
    return this.data.bestWave;
  }

  public getHighScores(): ScoreEntry[] {
    return this.data.highScores;
  }

  public recordRun(score: number, wave: number): boolean {
    const prevBest = this.getBestScore();
    if (wave > this.data.bestWave) {
      this.data.bestWave = wave;
    }
    if (score > 0) {
      this.data.highScores.push({ score: Math.floor(score), wave });
      this.data.highScores.sort((a, b) => b.score - a.score);
      this.data.highScores = this.data.highScores.slice(0, 5);
    }
    this.persist();
    return score > prevBest && score > 0;
  }
}
