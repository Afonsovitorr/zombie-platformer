import { Container, Graphics } from 'pixi.js';
import { SpriteActor, px, py } from './gfx';
import type { NpcDef } from './data/levels';

// A friendly merchant: idles by the fire and shows a bubble when the hero is close.
export class Npc {
  readonly view = new Container();
  private actor = new SpriteActor('heroine', 2.0);
  private bubble = new Graphics();
  private t = Math.random() * 6;

  constructor(readonly def: NpcDef) {
    this.view.position.set(px(def.x), py(def.y));
    this.actor.setFacing(-1);
    // sack of goods behind the merchant
    const sack = new Graphics();
    sack.ellipse(-70, -22, 30, 26).fill({ color: 0xb98550 }).stroke({ width: 4, color: 0x1a1030 });
    sack.circle(-70, -46, 8).fill({ color: 0x8a5f3c }).stroke({ width: 3, color: 0x1a1030 });
    sack.circle(-58, -16, 7).fill({ color: 0xf2c14e }).stroke({ width: 2.5, color: 0x1a1030 });
    this.bubble.roundRect(-22, -16, 44, 32, 10).fill({ color: 0xffffff }).stroke({ width: 4, color: 0x1a1030 });
    this.bubble.poly([-6, 16, 6, 16, 0, 28]).fill({ color: 0xffffff }).stroke({ width: 3, color: 0x1a1030 });
    this.bubble.circle(0, 6, 3.5).fill({ color: 0x1a1030 }).rect(-2.5, -9, 5, 12).fill({ color: 0x1a1030 });
    this.bubble.position.set(0, -170);
    this.bubble.visible = false;
    this.view.addChild(sack, this.actor.root, this.bubble);
  }

  update(dt: number, playerX: number) {
    this.t += dt;
    const near = Math.abs(playerX - this.def.x) < 3;
    this.actor.setFacing(playerX < this.def.x ? -1 : 1);
    this.actor.update(dt);
    this.bubble.visible = near;
    this.bubble.y = -170 + Math.sin(this.t * 5) * 4;
  }

  near(x: number, y: number) {
    return Math.abs(x - this.def.x) < 2.6 && Math.abs(y - this.def.y) < 2.5;
  }
}
