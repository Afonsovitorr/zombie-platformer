import type { Container } from 'pixi.js';
import type { Body } from './physics';
import type { EnemyDef } from './data/enemies';
import type { Game } from './game';

// What the game loop, the player and projectiles need from any hostile (regular enemy or boss).
export interface Foe {
  readonly def: EnemyDef;
  body: Body;
  view: Container;
  remove: boolean;
  readonly dead: boolean;
  summoned: boolean; // spawned by a summoner: gives no souls, so it cannot be farmed
  hurt(dmg: number, dir: number, g: Game, kb?: number): void;
  stun(): void;
  update(dt: number, g: Game): void;
}
