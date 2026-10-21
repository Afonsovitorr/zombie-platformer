import { Container } from 'pixi.js';
import { Body, moveBody, sign } from './physics';
import type { Game } from './game';
import type { EnemyDef } from './data/enemies';
import type { Foe, Hit } from './foe';
import { SpriteActor, px, py } from './gfx';

type State =
  | 'dormant' | 'idle' | 'approach' | 'bite' | 'tail' | 'breath'
  | 'takeoff' | 'hover' | 'dive' | 'crash' | 'land' | 'recover' | 'stun' | 'dead';

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

// The Dead Dragon. Phase 1 fights on the ground: bite, tail sweep (a shockwave) and a fiery breath.
// Phase 2 (<66% hp): it takes to the air, rains fire and dives; a dive that misses leaves it crashed and open.
// Phase 3 (<33% hp): faster, and the ceiling starts to fall in.
export class DeadDragon implements Foe {
  body: Body;
  hp: number;
  readonly maxHp: number;
  facing = -1;
  view = new Container();
  remove = false;
  summoned = false;

  private state: State = 'dormant';
  private t = 0;
  private clock = 0;
  private actor: SpriteActor;
  private struck = false;
  private bombCd = 0;
  private flyCd = 5;
  private forceFly = false;
  private stunImmune = 0;
  private rubbleCd = 4;
  private diveTarget = { x: 0, y: 0 };

  constructor(readonly def: EnemyDef, x: number, y = 0.05) {
    this.hp = def.hp;
    this.maxHp = def.hp;
    this.body = { x, y: y + 0.05, vx: 0, vy: 0, w: def.w, h: def.h, onGround: false };
    this.actor = new SpriteActor(def.sprite, def.body);
    this.view.addChild(this.actor.root);
  }

  get dead() {
    return this.state === 'dead';
  }

  private get phase() {
    const r = this.hp / this.maxHp;
    return r > 0.66 ? 1 : r > 0.33 ? 2 : 3;
  }

  activate() {
    if (this.state === 'dormant') this.go('idle');
  }

  stun() {
    if (this.dead || this.stunImmune > 0 || (this.state !== 'bite' && this.state !== 'tail')) return;
    this.body.vx = 0;
    this.stunImmune = 3;
    this.go('stun');
  }

  hurt(dmg: number, _dir: number, g: Game, _kb = 1, _how: Hit = 'melee') {
    if (this.dead || this.state === 'dormant') return;
    const before = this.phase;
    this.hp -= this.state === 'stun' || this.state === 'crash' ? dmg * 1.5 : dmg;
    g.hitStop = Math.max(g.hitStop, 0.04);
    this.actor.flash(0xff8080);
    g.fx.hit(this.body.x, this.body.y + this.body.h * 0.5, 0xffe066, 10);
    g.audio.play(this.hp <= 0 ? 'death' : 'heavy');
    if (this.hp <= 0) {
      this.hp = 0;
      this.body.fly = false;
      this.body.vx = 0;
      this.go('dead');
      g.shake = Math.max(g.shake, 0.8);
      g.onBossDefeated(this.def);
      return;
    }
    if (this.phase > before) {
      g.toast(this.phase === 2 ? 'O Dragão-morto levanta voo!' : 'O Dragão-morto está furioso!');
      g.shake = Math.max(g.shake, 0.6);
      this.forceFly = true;
    }
  }

  update(dt: number, g: Game) {
    const b = this.body;
    const p = g.player.body;
    const arena = g.level.def.boss!.arena;
    const floor = g.level.def.boss!.y;
    this.t += dt;
    this.clock += dt;
    this.stunImmune = Math.max(0, this.stunImmune - dt);
    this.flyCd -= dt;
    const dx = p.x - b.x;
    const fast = this.phase === 3 ? 0.75 : 1;
    const once = (at: number) => this.t >= at && this.t - dt < at;

    switch (this.state) {
      case 'dormant':
        b.vx = 0;
        break;
      case 'idle':
        b.vx = 0;
        this.facing = sign(dx);
        if (!g.player.alive || this.t < 0.4 * fast) break;
        this.choose(g, Math.abs(dx));
        break;
      case 'approach':
        this.facing = sign(dx);
        b.vx = this.facing * 2.8 * (this.phase === 3 ? 1.3 : 1);
        if (Math.abs(dx) < 4.2 || this.t > 2.5) this.go('idle');
        break;
      case 'bite':
        b.vx = 0;
        this.facing = sign(dx);
        this.actor.flash(0xff9a9a, 0.6);
        if (once(0.7 * fast)) {
          if (Math.abs(dx) < 5 && Math.abs(p.y - b.y) < 3 && dx * this.facing > -0.5) g.player.takeDamage(this.def.damage, b.x, g, this);
          g.audio.play('swing');
        }
        if (this.t > 1.1 * fast) this.go('recover');
        break;
      case 'tail':
        b.vx = 0;
        this.actor.flash(0xff9a9a, 0.6);
        if (once(0.8 * fast)) {
          g.shake = Math.max(g.shake, 0.5);
          g.audio.play('heavy');
          g.fx.dust(b.x - 2, b.y);
          g.fx.dust(b.x + 2, b.y);
          for (const side of [-1, 1]) g.spawnEnemyBolt('wave', b.x + side * 2.2, b.y + 0.4, side * 8.5, 0, 1);
          if (Math.abs(dx) < 3.4 && Math.abs(p.y - b.y) < 2) g.player.takeDamage(this.def.damage, b.x, g, this);
        }
        if (this.t > 1.3 * fast) this.go('recover');
        break;
      case 'breath':
        b.vx = 0;
        this.facing = sign(dx);
        this.actor.flash(0xffb060, 0.7);
        if (once(0.9 * fast)) {
          for (const [oy, d] of [[0.6, 0], [1.6, 0.12], [2.6, 0.24]] as const) {
            g.spawnEnemyBolt('fire', b.x + this.facing * 3, b.y + oy + 0.4, this.facing * 9.5, d * 3 * -1, 1);
          }
          g.audio.play('bow');
        }
        if (this.t > 1.5 * fast) this.go('recover');
        break;
      case 'recover':
        b.vx = 0;
        if (this.t > 1.0 * fast) this.go('idle');
        break;
      case 'takeoff':
        b.fly = true;
        b.vx = 0;
        b.vy = 7;
        if (b.y > floor + 4.6) this.go('hover');
        break;
      case 'hover': {
        // sways above the hero, dropping fireballs; after a while it picks a dive
        this.facing = sign(dx);
        const tx = clamp(p.x + Math.sin(this.clock * 0.9) * 6, arena[0] + 4, arena[1] - 4);
        b.vx = clamp((tx - b.x) * 1.4, -6, 6);
        b.vy = clamp((floor + 4.6 + Math.sin(this.clock * 2) * 0.6 - b.y) * 3, -4, 4);
        this.bombCd -= dt;
        if (this.bombCd <= 0) {
          this.bombCd = 0.85 * fast;
          g.spawnEnemyBolt('fire', b.x, b.y + 0.5, (dx > 0 ? 1 : -1) * 1.5, -7, 1);
          g.audio.play('bow');
        }
        if (this.t > 4.2 * fast) {
          this.diveTarget = { x: p.x, y: p.y };
          this.go('dive');
        }
        break;
      }
      case 'dive': {
        this.facing = sign(this.diveTarget.x - b.x) || this.facing;
        if (this.t < 0.6) {
          // shakes in place: the telegraph
          b.vx = 0;
          b.vy = 0;
          this.actor.flash(0xff6a6a, 0.9);
          break;
        }
        const tx = this.diveTarget.x - b.x;
        const ty = this.diveTarget.y + 0.5 - b.y;
        const len = Math.hypot(tx, ty) || 1;
        b.vx = (tx / len) * 17;
        b.vy = (ty / len) * 17;
        if (!this.struck && Math.abs(p.x - b.x) < 2.6 && Math.abs(p.y + 1 - (b.y + 1.2)) < 2.6) {
          this.struck = true;
          g.player.takeDamage(this.def.damage, b.x, g, this);
        }
        if (b.y <= floor + 1.2 || this.t > 1.8) {
          b.vx = 0;
          b.vy = 0;
          g.shake = Math.max(g.shake, 0.7);
          g.audio.play('heavy');
          g.fx.dust(b.x - 1.5, b.y);
          g.fx.dust(b.x + 1.5, b.y);
          for (const side of [-1, 1]) g.spawnEnemyBolt('wave', b.x + side * 2, floor + 0.5, side * 8, 0, 1);
          this.go('crash');
        }
        break;
      }
      case 'crash':
        // stuck in the floor: the moment to strike
        b.fly = false;
        b.vx = 0;
        this.actor.flash(0x9fb4ff, 0.8);
        if (this.t > 1.8) {
          this.flyCd = this.phase === 3 ? 9 : 13;
          this.go('land');
        }
        break;
      case 'land':
        b.fly = false;
        b.vx = 0;
        if (this.t > 0.3) this.go('idle');
        break;
      case 'stun':
        b.vx = 0;
        this.actor.flash(0x9fb4ff, 1);
        if (this.t > 1.4) this.go('idle');
        break;
      case 'dead':
        b.vx = 0;
        if (this.t > 3) this.remove = true;
        break;
    }

    // phase 3: bits of the ceiling fall in
    if (this.phase === 3 && this.state !== 'dormant' && this.state !== 'dead') {
      this.rubbleCd -= dt;
      if (this.rubbleCd <= 0) {
        this.rubbleCd = 1.6;
        g.spawnEnemyBolt('fire', clamp(p.x + (Math.random() - 0.5) * 8, arena[0] + 2, arena[1] - 2), floor + 11, 0, -8, 1);
      }
    }

    if (!b.fly || this.state === 'dead') moveBody(b, dt, g.level.solids);
    else {
      // flying: collide with walls/ceiling through the same physics, without gravity
      moveBody(b, dt, g.level.solids);
    }
    this.view.position.set(px(b.x), py(b.y));
    this.view.alpha = this.state === 'dead' ? Math.max(0, 1 - Math.max(0, this.t - 1.6) / 1.4) : 1;
    this.actor.setFacing(this.facing);
    this.animate(dt, b);
  }

  private choose(g: Game, dist: number) {
    if (this.forceFly || (this.phase >= 2 && this.flyCd <= 0)) {
      this.forceFly = false;
      this.go('takeoff');
      this.bombCd = 0.5;
      return;
    }
    if (dist > 7) this.go(Math.random() < 0.55 ? 'breath' : 'approach');
    else if (dist > 4.2) this.go('approach');
    else this.go(Math.random() < 0.5 ? 'bite' : 'tail');
    void g;
  }

  private animate(dt: number, b: Body) {
    const a = this.actor;
    switch (this.state) {
      case 'bite':
        a.scrub('attack', Math.min(0.97, (this.t / 1.1) * 0.9));
        break;
      case 'tail':
        a.scrub('attack2', Math.min(0.97, (this.t / 1.3) * 0.9));
        break;
      case 'breath':
        a.scrub('attack', Math.min(0.97, 0.3 + (this.t / 1.5) * 0.5));
        break;
      case 'approach':
        a.play('walk', { speed: 1.1 });
        break;
      case 'takeoff':
      case 'hover':
      case 'dive':
        a.play('run', { speed: this.state === 'dive' ? 1.8 : 1.2 });
        break;
      case 'crash':
      case 'stun':
        a.scrub('idle', 0.4);
        break;
      case 'dead':
        a.play('die', { once: true, fit: 1.4 });
        break;
      default:
        a.play('idle');
    }
    a.root.rotation = this.state === 'dive' && this.t >= 0.6 ? Math.atan2(-b.vy, Math.abs(b.vx) + 0.1) * -0.5 * this.facing : 0;
    a.update(dt);
  }

  private go(s: State) {
    this.state = s;
    this.t = 0;
    if (s === 'dive') this.struck = false;
  }
}
