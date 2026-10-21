import type { Container } from 'pixi.js';
import type { Body } from './physics';
import type { EnemyDef } from './data/enemies';
import type { Game } from './game';

export type Hit = 'melee' | 'arrow' | 'plunge';

// What the game loop, the player and projectiles need from any hostile (regular enemy or boss).
export interface Foe {
  readonly def: EnemyDef;
  body: Body;
  hp: number;
  view: Container;
  remove: boolean;
  readonly dead: boolean;
  summoned: boolean; // spawned by a summoner: gives no souls, so it cannot be farmed
  readonly maxHp?: number; // bosses report this for the health bar
  activate?(): void; // bosses sleep until the arena locks
  readonly intangible?: boolean; // cannot be hit right now (e.g. a fading ghost)
  hurt(dmg: number, dir: number, g: Game, kb?: number, how?: Hit): void;
  stun(): void;
  update(dt: number, g: Game): void;
}
