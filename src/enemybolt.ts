import { Graphics } from 'pixi.js';
import type { Game } from './game';
import { sign } from './physics';
import { px, py } from './gfx';

export type BoltKind = 'arrow' | 'wave' | 'fire';

// Hostile projectile. Arrows fly straight; waves travel along the ground and must be jumped over.
export class EnemyBolt {
  view = new Graphics();
  dead = false;
  private life: number;

  constructor(readonly kind: BoltKind, public x: number, public y: number, private vx: number, private vy: number, private dmg: number) {
    if (kind === 'arrow') {
      this.view.poly([-26, -3, 16, -3, 16, -9, 30, 0, 16, 9, 16, 3, -26, 3]).fill({ color: 0xe9e3cf }).stroke({ width: 3, color: 0x1a1030, join: 'round' });
      this.view.poly([-26, -3, -34, -9, -20, -3]).fill({ color: 0xc43a4a });
      this.view.poly([-26, 3, -34, 9, -20, 3]).fill({ color: 0xc43a4a });
    } else if (kind === 'fire') {
      this.view.moveTo(-34, 0).quadraticCurveTo(-12, -14, 0, -14).quadraticCurveTo(16, -10, 16, 0).quadraticCurveTo(16, 10, 0, 14).quadraticCurveTo(-12, 14, -34, 0).fill({ color: 0xff7a1e }).stroke({ width: 3.5, color: 0x1a1030, join: 'round' });
      this.view.circle(2, 0, 8).fill({ color: 0xffe27a });
    } else {
      // a rolling purple crescent
      this.view.moveTo(0, 0).quadraticCurveTo(46, -30, 8, -84).quadraticCurveTo(-4, -40, -34, 0).closePath().fill({ color: 0xb06cff }).stroke({ width: 4, color: 0x1a1030, join: 'round' });
      this.view.moveTo(2, -6).quadraticCurveTo(24, -26, 6, -58).quadraticCurveTo(0, -30, -16, -6).closePath().fill({ color: 0xe6c8ff });
      this.view.scale.x = sign(vx);
    }
    this.view.position.set(px(x), py(y));
    this.life = kind === 'arrow' ? 2.5 : kind === 'fire' ? 4 : 3.5;
  }

  update(dt: number, g: Game) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.life -= dt;
    this.view.position.set(px(this.x), py(this.y));
    if (this.kind !== 'wave') this.view.rotation = -Math.atan2(this.vy, this.vx);
    if (this.life <= 0) this.dead = true;

    if (this.kind !== 'wave') {
      for (const s of g.level.solids) {
        if (this.x > s.x0 && this.x < s.x1 && this.y > s.y0 && this.y < s.y1) this.dead = true;
      }
    }

    const p = g.player.body;
    const hit = Math.abs(this.x - p.x) < p.w / 2 + 0.3 && this.y > p.y - 0.2 && this.y < p.y + p.h;
    // a wave rolls along the floor, so a player who is airborne passes over it
    const clears = this.kind === 'wave' && p.y > this.y + 0.5;
    if (hit && !clears && !this.dead) {
      this.dead = true;
      g.player.takeDamage(this.dmg, this.x - sign(this.vx) * 0.5, g);
    }
  }
}
