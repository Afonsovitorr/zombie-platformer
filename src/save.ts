export interface SaveData {
  souls: number;
  skills: string[];
  gear: string[]; // equipment bought from the merchant
  potions: number;
  heartPieces: number; // 3 pieces make one extra heart
  level: number;
  checkpoint: number | null; // index of the last campfire in the current level; null = level start
  opened: string[]; // chest ids already looted
  broken: string[]; // secret walls already broken
}

const KEY = 'zombie-platformer:save:v2';
const fresh = (): SaveData => ({ souls: 0, skills: [], gear: [], potions: 1, heartPieces: 0, level: 0, checkpoint: null, opened: [], broken: [] });

export class Save {
  data: SaveData = fresh();

  load(): boolean {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return false;
      this.data = { ...fresh(), ...JSON.parse(raw) };
      return true;
    } catch {
      return false;
    }
  }

  persist() {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.data));
    } catch {
      // storage can be blocked (private mode); the game still works, just without saves
    }
  }

  clear() {
    this.data = fresh();
    this.persist();
  }
}
