export interface SaveData {
  souls: number;
  skills: string[];
  level: number;
  checkpointX: number | null; // null = start of level
}

const KEY = 'zombie-platformer:save:v1';
const fresh = (): SaveData => ({ souls: 0, skills: [], level: 0, checkpointX: null });

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
