export interface EnemyDef {
  id: string;
  name: string;
  hp: number;
  speed: number;
  damage: number;
  w: number;
  h: number;
  scale: number;
  detect: number; // distance at which it notices the player
  reach: number; // distance at which it starts an attack
  windup: number; // seconds of telegraph before the hit
  active: number;
  recover: number;
  souls: number;
  model: string; // glb in public/models
  tint?: number; // multiplied over the model's texture to tell variants apart
}

export const ENEMIES: Record<string, EnemyDef> = {
  walker: {
    id: 'walker', name: 'Zumbi', hp: 3, speed: 2.4, damage: 1, w: 0.9, h: 1.8, scale: 1,
    detect: 10, reach: 1.5, windup: 0.55, active: 0.2, recover: 0.5, souls: 10,
    model: 'character-zombie',
  },
  runner: {
    id: 'runner', name: 'Zumbi corredor', hp: 2, speed: 5, damage: 1, w: 0.8, h: 1.7, scale: 0.95,
    detect: 12, reach: 1.4, windup: 0.3, active: 0.2, recover: 0.45, souls: 15,
    model: 'character-zombie', tint: 0xffd88a,
  },
  brute: {
    id: 'brute', name: 'Brutamontes', hp: 8, speed: 1.6, damage: 2, w: 1.3, h: 2.5, scale: 1.4,
    detect: 9, reach: 2.1, windup: 0.85, active: 0.25, recover: 0.8, souls: 40,
    model: 'character-zombie', tint: 0x8fa3c4,
  },
};
