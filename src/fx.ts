import { Container, Graphics, Text } from 'pixi.js';
import { U, px, py, ghostOf, type SpriteActor } from './gfx';

interface Item {
  node: Container;
  life: number;
  max: number;
  vx: number;
  vy: number;
  grow: number; // scale per second
  fade: boolean;
}

// Short-lived visual effects: sparks, dust, slashes, floating numbers, dodge ghosts.
export class Fx {
  readonly layer = new Container();
  private items: Item[] = [];

  private add(node: Container, life: number, o: Partial<Item> = {}) {
    this.layer.addChild(node);
    this.items.push({ node, life, max: life, vx: 0, vy: 0, grow: 0, fade: true, ...o });
  }

  clear() {
    for (const i of this.items) i.node.destroy();
    this.items = [];
  }

  // Star-shaped burst for a hit.
  hit(x: number, y: number, color = 0xffe066, n = 7) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random();
      const s = 3 + Math.random() * 5;
      const g = new Graphics().star(0, 0, 4, 6 + Math.random() * 5, 2).fill({ color }).stroke({ width: 2, color: 0x1a1030 });
      g.position.set(px(x), py(y));
      this.add(g, 0.35 + Math.random() * 0.15, { vx: Math.cos(a) * s * U, vy: -Math.sin(a) * s * U, grow: -0.5 });
    }
    const ring = new Graphics().circle(0, 0, 14).stroke({ width: 5, color: 0xffffff });
    ring.position.set(px(x), py(y));
    this.add(ring, 0.18, { grow: 5 });
  }

  dust(x: number, y: number, dir = 0) {
    for (let i = 0; i < 4; i++) {
      const g = new Graphics().circle(0, 0, 7 + Math.random() * 6).fill({ color: 0xe9e2f5, alpha: 0.85 }).stroke({ width: 2, color: 0x1a1030, alpha: 0.5 });
      g.position.set(px(x) + (Math.random() - 0.5) * 20, py(y) - 4);
      this.add(g, 0.4, { vx: (dir * 0.8 + (Math.random() - 0.5)) * 50, vy: -20 - Math.random() * 30, grow: 0.7 });
    }
  }

  // Crescent that follows a sword swing.
  slash(x: number, y: number, dir: number, stage: number) {
    const big = stage === 2;
    const r = (big ? 1.7 : 1.35) * U;
    const g = new Graphics();
    const a0 = stage === 1 ? 0.5 : -1.3;
    const a1 = stage === 1 ? -1.4 : 1.1;
    g.arc(0, 0, r, a0, a1, a1 < a0).arc(0, 0, r * 0.78, a1, a0, a1 > a0).closePath();
    g.fill({ color: 0xffffff, alpha: 0.85 });
    g.position.set(px(x + dir * 0.4), py(y));
    g.scale.x = dir;
    this.add(g, 0.16, { grow: 0.5 });
  }

  // Floating text such as "Parry!".
  text(x: number, y: number, str: string, color = 0xffffff) {
    const t = new Text({ text: str, style: { fill: color, fontSize: 30, fontWeight: '900', fontFamily: 'Trebuchet MS, sans-serif', stroke: { color: 0x1a1030, width: 6 } } });
    t.anchor.set(0.5);
    t.position.set(px(x), py(y));
    this.add(t, 0.8, { vy: -70 });
  }

  ghost(actor: SpriteActor, x: number, y: number, dir: number) {
    const s = ghostOf(actor, px(x), py(y), dir);
    s.alpha = 0.55;
    this.add(s, 0.28);
  }

  // Expanding glow ring (parry, checkpoint, summon).
  ring(x: number, y: number, color: number, size = 30) {
    const g = new Graphics().circle(0, 0, size).stroke({ width: 7, color });
    g.position.set(px(x), py(y));
    this.add(g, 0.4, { grow: 3 });
  }

  update(dt: number) {
    for (const i of this.items) {
      i.life -= dt;
      i.node.x += i.vx * dt;
      i.node.y += i.vy * dt;
      if (i.grow) {
        const k = Math.max(0.01, i.node.scale.y + i.grow * dt);
        i.node.scale.set(Math.sign(i.node.scale.x || 1) * k, k);
      }
      if (i.fade) i.node.alpha = Math.max(0, Math.min(1, (i.life / i.max) * 1.6));
    }
    this.items = this.items.filter((i) => {
      if (i.life > 0) return true;
      i.node.destroy();
      return false;
    });
  }
}
