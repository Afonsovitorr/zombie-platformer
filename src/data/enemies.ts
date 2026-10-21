export type EnemyKind = 'melee' | 'archer' | 'hound' | 'necro' | 'boss';

export interface EnemyDef {
  id: string;
  name: string;
  kind: EnemyKind;
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
  sprite: string; // variant name in public/sprites/manifest.json
  body: number; // height of the character on screen, in world units
}

export const ENEMIES: Record<string, EnemyDef> = {
  walker: {
    id: 'walker', name: 'Zumbi', kind: 'melee', hp: 3, speed: 2.4, damage: 1, w: 0.9, h: 1.8, scale: 1,
    detect: 10, reach: 1.5, windup: 0.55, active: 0.2, recover: 0.5, souls: 10,
    sprite: 'walker', body: 2.0,
  },
  runner: {
    id: 'runner', name: 'Zumbi corredor', kind: 'melee', hp: 2, speed: 5, damage: 1, w: 0.8, h: 1.7, scale: 0.95,
    detect: 12, reach: 1.4, windup: 0.3, active: 0.2, recover: 0.45, souls: 15,
    sprite: 'runner', body: 1.9,
  },
  brute: {
    id: 'brute', name: 'Brutamontes', kind: 'melee', hp: 8, speed: 1.6, damage: 2, w: 1.3, h: 2.5, scale: 1.4,
    detect: 9, reach: 2.1, windup: 0.85, active: 0.25, recover: 0.8, souls: 40,
    sprite: 'brute', body: 2.9,
  },
  // Stationary shooter: telegraphs, then fires an arrow at the player's chest.
  archer: {
    id: 'archer', name: 'Esqueleto arqueiro', kind: 'archer', hp: 2, speed: 0, damage: 1, w: 0.8, h: 1.7, scale: 1,
    detect: 15, reach: 15, windup: 0.9, active: 0.3, recover: 1.6, souls: 20,
    sprite: 'archer', body: 2.0,
  },
  // Fast and low: crouches, then leaps at the player. (A small dragon whelp stands in for the dog.)
  hound: {
    id: 'hound', name: 'Cão-zumbi', kind: 'hound', hp: 2, speed: 5.5, damage: 1, w: 0.9, h: 1.0, scale: 0.6,
    detect: 13, reach: 4.2, windup: 0.4, active: 0.6, recover: 0.7, souls: 15,
    sprite: 'whelp', body: 1.3,
  },
  // Keeps its distance and raises zombies; kill it first.
  necro: {
    id: 'necro', name: 'Necromante menor', kind: 'necro', hp: 4, speed: 2.6, damage: 1, w: 0.8, h: 1.8, scale: 1,
    detect: 14, reach: 14, windup: 1.0, active: 0.3, recover: 0.8, souls: 60,
    sprite: 'necro', body: 2.1,
  },
  carnical_rei: {
    id: 'carnical_rei', name: 'Carniçal Rei', kind: 'boss', hp: 30, speed: 1.9, damage: 2, w: 1.9, h: 3.4, scale: 2,
    detect: 30, reach: 3.2, windup: 0.9, active: 0.3, recover: 0.8, souls: 300,
    sprite: 'king', body: 4.0,
  },
};
