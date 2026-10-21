export type EnemyKind =
  | 'melee' | 'archer' | 'hound' | 'necro' | 'boss' // knights and the Carniçal Rei (sprite characters)
  | 'flyer' | 'spitter' | 'phantom' | 'ambush' | 'plant' | 'golem' | 'spiky' | 'charger' | 'hopper' | 'bomber' | 'ogre' | 'blob'; // monsters brought to life in code

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
  reward?: string; // skill id granted by defeating this boss
  sprite: string; // variant name in public/sprites/manifest.json (knights) or monsters.json (monsters)
  monster?: boolean; // true when sprite names a monster atlas
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
  // ---- monsters (Bevouliin art, animated in code) ----
  skull: {
    id: 'skull', name: 'Caveira voadora', kind: 'flyer', hp: 2, speed: 3.2, damage: 1, w: 0.9, h: 1.0, scale: 0.8,
    detect: 13, reach: 6, windup: 0.5, active: 0.7, recover: 0.6, souls: 14,
    sprite: 'skull', monster: true, body: 1.2,
  },
  spitter: {
    id: 'spitter', name: 'Caveira chifruda', kind: 'spitter', hp: 3, speed: 2.4, damage: 1, w: 0.9, h: 1.0, scale: 0.8,
    detect: 15, reach: 12, windup: 0.7, active: 0.2, recover: 1.6, souls: 28,
    sprite: 'horn_skull', monster: true, body: 1.3,
  },
  phantom: {
    id: 'phantom', name: 'Fantasma', kind: 'phantom', hp: 3, speed: 2.3, damage: 1, w: 0.9, h: 1.1, scale: 0.8,
    detect: 14, reach: 1.2, windup: 0.4, active: 0.3, recover: 1.0, souls: 30,
    sprite: 'shadow_skull', monster: true, body: 1.4,
  },
  tomb: {
    id: 'tomb', name: 'Lápide viva', kind: 'ambush', hp: 4, speed: 3.2, damage: 1, w: 1.0, h: 1.5, scale: 1,
    detect: 4.5, reach: 1.2, windup: 0.4, active: 0.3, recover: 0.5, souls: 18,
    sprite: 'tomb', monster: true, body: 1.8,
  },
  plant: {
    id: 'plant', name: 'Planta carnívora', kind: 'plant', hp: 3, speed: 0, damage: 1, w: 0.9, h: 1.3, scale: 1,
    detect: 2.8, reach: 2.4, windup: 0.5, active: 0.2, recover: 0.9, souls: 14,
    sprite: 'plant', monster: true, body: 1.6,
  },
  golem: {
    id: 'golem', name: 'Golem de pedra', kind: 'golem', hp: 10, speed: 1.3, damage: 2, w: 1.4, h: 2.2, scale: 1.5,
    detect: 9, reach: 2.8, windup: 1.0, active: 0.3, recover: 1.3, souls: 50,
    sprite: 'rock', monster: true, body: 2.8,
  },
  brick: {
    id: 'brick', name: 'Golem de tijolo', kind: 'golem', hp: 7, speed: 2.0, damage: 1, w: 1.2, h: 2.0, scale: 1.3,
    detect: 9, reach: 2.4, windup: 0.8, active: 0.3, recover: 1.0, souls: 40,
    sprite: 'brick', monster: true, body: 2.6,
  },
  frost: {
    id: 'frost', name: 'Golem de gelo', kind: 'golem', hp: 8, speed: 1.6, damage: 2, w: 1.3, h: 2.2, scale: 1.4,
    detect: 9, reach: 2.6, windup: 0.9, active: 0.3, recover: 1.2, souls: 45,
    sprite: 'ice', monster: true, body: 2.6,
  },
  gargoyle: {
    id: 'gargoyle', name: 'Gárgula', kind: 'flyer', hp: 6, speed: 3.6, damage: 2, w: 1.2, h: 2.0, scale: 1.3,
    detect: 7, reach: 7, windup: 0.6, active: 0.8, recover: 0.8, souls: 40,
    sprite: 'gargoyle', monster: true, body: 2.5,
  },
  spiky: {
    id: 'spiky', name: 'Espinhento', kind: 'spiky', hp: 3, speed: 1.9, damage: 1, w: 1.5, h: 1.2, scale: 1,
    detect: 0, reach: 0, windup: 0, active: 0, recover: 0, souls: 20,
    sprite: 'spike_brown', monster: true, body: 1.5,
  },
  imp: {
    id: 'imp', name: 'Diabrete', kind: 'charger', hp: 3, speed: 2.8, damage: 1, w: 1.0, h: 1.2, scale: 1,
    detect: 11, reach: 6, windup: 0.6, active: 1.0, recover: 0.7, souls: 25,
    sprite: 'imp', monster: true, body: 1.5,
  },
  shade: {
    id: 'shade', name: 'Sombra saltitante', kind: 'hopper', hp: 1, speed: 5.5, damage: 1, w: 0.8, h: 0.9, scale: 0.7,
    detect: 11, reach: 1.2, windup: 0.3, active: 0.4, recover: 0.4, souls: 8,
    sprite: 'shade', monster: true, body: 1.1,
  },
  bomber: {
    id: 'bomber', name: 'Tomate-bomba', kind: 'bomber', hp: 2, speed: 3.3, damage: 2, w: 0.9, h: 1.1, scale: 0.8,
    detect: 11, reach: 2.2, windup: 0.9, active: 0.2, recover: 0, souls: 16,
    sprite: 'tomato', monster: true, body: 1.4,
  },
  blob: {
    id: 'blob', name: 'Gosma azul', kind: 'blob', hp: 3, speed: 2.5, damage: 1, w: 0.9, h: 1.3, scale: 1,
    detect: 9, reach: 1.5, windup: 0.5, active: 0.2, recover: 0.6, souls: 12,
    sprite: 'blob', monster: true, body: 1.7,
  },
  cyclops: {
    id: 'cyclops', name: 'Ciclope', kind: 'spitter', hp: 4, speed: 1.2, damage: 1, w: 1.0, h: 1.4, scale: 1,
    detect: 14, reach: 11, windup: 0.8, active: 0.2, recover: 1.5, souls: 30,
    sprite: 'cyclops', monster: true, body: 1.7,
  },
  ogre: {
    id: 'ogre', name: 'Ogro-lodo', kind: 'ogre', hp: 22, speed: 2.1, damage: 2, w: 1.6, h: 2.4, scale: 1.8,
    detect: 12, reach: 3.2, windup: 0.8, active: 0.4, recover: 1.0, souls: 120,
    sprite: 'ogre', monster: true, body: 3.0,
  },
  necromante: {
    id: 'necromante', name: 'Necromante', kind: 'boss', hp: 26, speed: 0, damage: 1, w: 1.2, h: 2.8, scale: 2,
    detect: 30, reach: 3, windup: 0.7, active: 0.3, recover: 1.1, souls: 250, reward: 'hunter_3',
    sprite: 'necro', body: 3.4,
  },
  ogro: {
    id: 'ogro', name: 'Ogro-lodo', kind: 'ogre', hp: 34, speed: 2.4, damage: 2, w: 2.0, h: 3.2, scale: 2,
    detect: 16, reach: 3.6, windup: 0.8, active: 0.4, recover: 0.9, souls: 280, reward: 'bastion_boss',
    sprite: 'ogre', monster: true, body: 4.4,
  },
  carnical_rei: {
    id: 'carnical_rei', name: 'Carniçal Rei', kind: 'boss', hp: 30, speed: 1.9, damage: 2, w: 1.9, h: 3.4, scale: 2,
    detect: 30, reach: 3.2, windup: 0.9, active: 0.3, recover: 0.8, souls: 300,
    sprite: 'king', body: 4.0, reward: 'blade_boss',
  },
};
