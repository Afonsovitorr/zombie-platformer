import { Container, Graphics } from 'pixi.js';
import { Body, moveBody, sign } from './physics';
import type { Game } from './game';
import type { EnemyDef } from './data/enemies';
import type { Foe, Hit } from './foe';
import { MonsterActor, px, py } from './gfx';
import { hasGround } from './enemy';

type State = 'dormant' | 'rise' | 'idle' | 'chase' | 'windup' | 'attack' | 'recover' | 'hurt' | 'stun' | 'dead';

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

// Every monster that is animated in code. One class, one small behaviour per `def.kind`.
export class Critter implements Foe {
  body: Body;
  hp: number;
  facing = -1;
  view = new Container();
  remove = false;

  private state: State = 'idle';
  private t = 0;
  private clock = Math.random() * 10;
  private struck = false;
  private cd = 1 + Math.random() * 2;
  private touchCd = 0;
  private hopCd = 0;
  private actor: MonsterActor;
  private stars = new Graphics();
  private homeY: number;
  private dir = Math.random() < 0.5 ? -1 : 1; // patrol direction
  private alpha = 1;

  constructor(readonly def: EnemyDef, x: number, y = 0.05, public summoned = false, readonly owner?: Foe) {
    this.hp = def.hp;
    const flies = def.kind === 'flyer' || def.kind === 'phantom' || (def.kind === 'spitter' && def.id !== 'cyclops');
    const lift = flies ? 1.6 : 0;
    this.body = { x, y: y + lift, vx: 0, vy: 0, w: def.w, h: def.h, onGround: false, fly: flies, ghost: def.kind === 'phantom' };
    this.homeY = y + lift;
    this.actor = new MonsterActor(def.sprite, def.body);
    this.view.addChild(this.actor.root, this.stars);
    this.stars.visible = false;
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      this.stars.star(Math.cos(a) * 34, Math.sin(a) * 9, 4, 8, 3.5).fill({ color: 0xffe066 }).stroke({ width: 2, color: 0x1a1030 });
    }
    if (def.id === 'gargoyle') this.go('dormant');
    if (def.id === 'tomb') this.go('dormant');
    if (def.kind === 'spiky') this.go('chase');
    if (this.state === 'dormant') this.actor.sprite.tint = def.id === 'tomb' ? 0xffffff : 0x8a8aa0;
  }

  get dead() {
    return this.state === 'dead';
  }

  get maxHp() {
    return this.def.hp;
  }

  get intangible() {
    return this.def.kind === 'phantom' && this.alpha < 0.7;
  }

  stun() {
    if (this.dead || this.state === 'dormant' || this.def.kind === 'plant') return;
    this.body.vx = 0;
    this.go('stun');
  }

  hurt(dmg: number, dir: number, g: Game, kb = 1, how: Hit = 'melee') {
    if (this.dead || this.state === 'dormant' || this.intangible) return;
    const d = this.def;
    if (d.kind === 'spiky' && how === 'melee' && this.state !== 'stun') {
      // spines: a sword bounces off; arrows, a plunge or a parry get through
      g.fx.hit(this.body.x - dir * 0.6, this.body.y + 0.8, 0xdfe6f5, 4);
      g.fx.text(this.body.x, this.body.y + 2, 'Clang!', 0xdfe6f5);
      g.player.body.vx = -dir * 5;
      g.hitStop = Math.max(g.hitStop, 0.05);
      g.audio.play('block');
      return;
    }
    this.hp -= this.state === 'stun' ? dmg * 2 : dmg;
    g.hitStop = Math.max(g.hitStop, 0.06);
    this.actor.flash(0xff8080);
    this.actor.showHit = 0.3;
    g.fx.hit(this.body.x, this.body.y + this.body.h * 0.6);
    g.audio.play(this.hp <= 0 ? 'death' : kb > 1.5 ? 'heavy' : 'hit');
    if (this.hp <= 0) {
      this.die(g, dir, true);
      return;
    }
    const heavy = d.scale > 1.2 ? 0.35 : 1;
    this.body.vx = dir * 5 * heavy * kb;
    if (!this.body.fly) this.body.vy = 3.5 * heavy;
    // big monsters keep attacking through a hit
    if (d.kind === 'golem' || d.kind === 'ogre' || d.kind === 'plant' || this.state === 'attack') return;
    this.go('hurt');
  }

  private die(g: Game, dir: number, rewards: boolean) {
    this.body.fly = false;
    this.body.ghost = false;
    this.body.vx = dir * 3;
    this.body.vy = 6;
    this.go('dead');
    this.alpha = 1;
    g.fx.dust(this.body.x, this.body.y + 0.3);
    if (rewards) {
      if (!this.summoned && g.level.def.boss?.type === this.def.id) g.onBossDefeated(this.def);
      else g.onKill(this.def, this.summoned);
    }
  }

  update(dt: number, g: Game) {
    const b = this.body;
    this.t += dt;
    this.clock += dt;
    this.touchCd = Math.max(0, this.touchCd - dt);
    this.cd -= dt;
    this.hopCd -= dt;
    const p = g.player.body;
    const dx = p.x - b.x;
    const dy = p.y - b.y;
    const near = g.player.alive && Math.abs(dx) < this.def.detect && Math.abs(dy) < (b.fly ? 9 : 4.5);

    // states every monster shares
    let handled = true;
    switch (this.state) {
      case 'dead':
        b.vx *= 0.96;
        if (this.t > 0.8) this.remove = true;
        break;
      case 'hurt':
        b.vx *= 0.9;
        if (b.fly) b.vy *= 0.9;
        if (this.t > 0.3) this.go(this.def.kind === 'plant' ? 'idle' : 'chase');
        break;
      case 'stun':
        b.vx = 0;
        if (b.fly) b.vy = Math.sin(this.clock * 6) * 0.4;
        this.actor.flash(0x9fb4ff, 1);
        if (this.t > 1.4) this.go('chase');
        break;
      case 'dormant':
        b.vx = 0;
        if (near && Math.abs(dx) < (this.def.id === 'gargoyle' ? 6 : this.def.detect)) {
          g.fx.dust(b.x, b.y + 0.3);
          this.actor.flash(0xffffff, 1);
          this.go(this.def.id === 'tomb' ? 'rise' : 'chase');
          if (this.def.id === 'gargoyle') b.fly = true;
        }
        break;
      case 'rise':
        b.vx = 0;
        if (this.t > 0.6) this.go('chase');
        break;
      default:
        handled = false;
    }

    if (!handled) this.behave(dt, g, dx, dy, near);

    moveBody(b, dt, g.level.solids);
    if (b.y < g.level.def.killY) this.remove = true;
    this.pose(dt, dx);
  }

  private touching(g: Game, pad = 0.15) {
    const p = g.player.body;
    const b = this.body;
    return g.player.alive && Math.abs(p.x - b.x) < (b.w + p.w) / 2 + pad && p.y < b.y + b.h && p.y + p.h > b.y;
  }

  private hit(g: Game, damage = this.def.damage) {
    g.player.takeDamage(damage, this.body.x, g, this);
  }

  private behave(dt: number, g: Game, dx: number, dy: number, near: boolean) {
    const b = this.body;
    const d = this.def;
    const p = g.player.body;
    const toward = sign(dx);

    switch (d.kind) {
      // ---- floats above the hero and dives at them ----
      case 'flyer':
        switch (this.state) {
          case 'idle':
            b.vx = Math.sin(this.clock * 1.4) * 0.8;
            b.vy = (this.homeY + Math.sin(this.clock * 2) * 0.3 - b.y) * 2;
            if (near) this.go('chase');
            break;
          case 'chase': {
            this.facing = toward;
            const tx = p.x + Math.sin(this.clock * 1.1) * 3;
            const ty = p.y + 2.6 + Math.sin(this.clock * 2.3) * 0.4;
            b.vx = clamp((tx - b.x) * 1.8, -d.speed, d.speed);
            b.vy = clamp((ty - b.y) * 3, -d.speed, d.speed);
            if (!near && Math.abs(dx) > d.detect + 5) this.go('idle');
            else if (this.cd <= 0 && Math.abs(dx) < d.reach && g.player.alive) this.go('windup');
            break;
          }
          case 'windup':
            b.vx = b.vy = 0;
            this.facing = toward;
            if (this.t > d.windup) {
              const tx = p.x - b.x;
              const ty = p.y + 0.9 - b.y;
              const len = Math.hypot(tx, ty) || 1;
              b.vx = (tx / len) * 11;
              b.vy = (ty / len) * 11;
              this.go('attack');
            }
            break;
          case 'attack':
            if (!this.struck && this.touching(g)) {
              this.struck = true;
              this.hit(g);
            }
            if (this.t > d.active) this.go('recover');
            break;
          case 'recover':
            b.vx *= 0.9;
            b.vy = Math.min(3, (p.y + 2.6 - b.y) * 2);
            if (this.t > d.recover) {
              this.cd = 2.6 + Math.random() * 1.6;
              this.go('chase');
            }
            break;
        }
        break;

      // ---- keeps its distance and spits fire ----
      case 'spitter':
        switch (this.state) {
          case 'idle':
            b.vx = 0;
            if (b.fly) b.vy = (this.homeY + Math.sin(this.clock * 2) * 0.3 - b.y) * 2;
            if (near) this.go('chase');
            break;
          case 'chase': {
            this.facing = toward;
            const dist = Math.abs(dx);
            const want = dist < 4.5 ? -toward : dist > 9 ? toward : 0;
            b.vx = want * d.speed;
            if (!b.fly && want !== 0 && !hasGround(g.level.solids, b.x + want * 0.9, b.y)) b.vx = 0;
            if (b.fly) b.vy = clamp((p.y + 2.4 + Math.sin(this.clock * 2) * 0.3 - b.y) * 2.5, -3, 3);
            if (!near && dist > d.detect + 4) this.go('idle');
            else if (this.cd <= 0 && dist < d.reach && g.player.alive) this.go('windup');
            break;
          }
          case 'windup':
            b.vx = 0;
            if (b.fly) b.vy = 0;
            this.facing = toward;
            if (this.t > d.windup) {
              const sx = b.x + this.facing * 0.5;
              const sy = b.y + b.h * 0.6;
              const tx = p.x - sx;
              const ty = p.y + 1.0 - sy;
              const len = Math.hypot(tx, ty) || 1;
              g.spawnEnemyBolt('fire', sx, sy, (tx / len) * 7, (ty / len) * 7, d.damage);
              g.audio.play('bow');
              this.go('attack');
            }
            break;
          case 'attack':
            if (this.t > d.active) this.go('recover');
            break;
          case 'recover':
            if (this.t > d.recover) {
              this.cd = 0.5;
              this.go('chase');
            }
            break;
        }
        break;

      // ---- fades in and out; only solid while visible ----
      case 'phantom':
        this.alpha = 0.55 + 0.45 * Math.sin(this.clock * 1.7);
        if (this.state === 'idle') {
          b.vx = 0;
          b.vy = Math.sin(this.clock * 2) * 0.4;
          if (near) this.go('chase');
          break;
        }
        this.facing = toward;
        b.vx = toward * d.speed * (this.alpha > 0.7 ? 1 : 0.6);
        b.vy = clamp((p.y + 0.4 - b.y) * 1.5, -2, 2);
        if (this.alpha > 0.75 && this.touchCd <= 0 && this.touching(g, 0)) {
          this.touchCd = 1.1;
          this.hit(g);
        }
        break;

      // ---- a gravestone that jumps up and hops after the hero ----
      case 'ambush':
        if (this.state === 'idle') this.go('chase');
        this.facing = toward;
        if (b.onGround) {
          b.vx *= 0.6;
          if (this.hopCd <= 0 && g.player.alive) {
            b.vy = 8.5;
            b.vx = toward * d.speed;
            this.hopCd = 0.85;
            this.struck = false;
          }
        }
        if (!this.struck && this.touching(g, 0)) {
          this.struck = true;
          this.hit(g);
        }
        break;

      // ---- rooted: bites anything that walks by ----
      case 'plant':
        b.vx = 0;
        switch (this.state) {
          case 'idle':
          case 'chase':
            if (near && Math.abs(dx) < d.reach && Math.abs(dy) < 2.5) {
              this.facing = toward;
              this.go('windup');
            }
            break;
          case 'windup':
            this.facing = toward;
            if (this.t > d.windup) {
              this.go('attack');
              if (Math.abs(dx) < d.reach + 0.4 && Math.abs(dy) < 2.5) this.hit(g);
            }
            break;
          case 'attack':
            if (this.t > d.active) this.go('recover');
            break;
          case 'recover':
            if (this.t > d.recover) this.go('idle');
            break;
        }
        break;

      // ---- slow brute: slams the ground and sends a shockwave ----
      case 'golem':
      case 'ogre':
        this.slammer(g, dx, dy, near, toward);
        break;

      // ---- patrols; its spines turn swords away ----
      case 'spiky': {
        b.vx = this.dir * d.speed;
        const ahead = hasGround(g.level.solids, b.x + this.dir * (b.w / 2 + 0.3), b.y);
        if ((!ahead && b.onGround) || (this.t > 0.3 && b.vx !== 0 && Math.abs(b.vx) < 0.1)) {
          this.dir = -this.dir;
          this.t = 0;
        }
        this.facing = this.dir;
        if (this.touchCd <= 0 && this.touching(g, 0)) {
          this.touchCd = 0.8;
          this.hit(g);
        }
        if (this.state !== 'chase' && this.state !== 'hurt') this.go('chase');
        break;
      }

      // ---- charges in a straight line; hitting a wall leaves it dazed ----
      case 'charger':
        switch (this.state) {
          case 'idle':
            b.vx = 0;
            if (near) this.go('chase');
            break;
          case 'chase':
            this.facing = toward;
            b.vx = toward * d.speed;
            if (b.onGround && !hasGround(g.level.solids, b.x + toward * 0.9, b.y)) b.vx = 0;
            if (!near && Math.abs(dx) > d.detect + 4) this.go('idle');
            else if (this.cd <= 0 && Math.abs(dx) < d.reach && Math.abs(dy) < 2 && g.player.alive) this.go('windup');
            break;
          case 'windup':
            b.vx = 0;
            this.facing = toward;
            this.actor.flash(0xff6a6a, 0.8);
            if (this.t > d.windup) this.go('attack');
            break;
          case 'attack':
            b.vx = this.facing * 9.5;
            if (!this.struck && this.touching(g, 0)) {
              this.struck = true;
              this.hit(g);
            }
            if (this.t > 0.2 && Math.abs(b.vx) < 0.5) {
              g.shake = Math.max(g.shake, 0.2);
              g.audio.play('heavy');
              this.go('stun');
            } else if (this.t > d.active) this.go('recover');
            break;
          case 'recover':
            b.vx *= 0.85;
            if (this.t > d.recover) {
              this.cd = 1.5;
              this.go('chase');
            }
            break;
        }
        break;

      // ---- tiny and quick: hops in swarms ----
      case 'hopper':
        if (this.state === 'idle') {
          b.vx = 0;
          if (near) this.go('chase');
          break;
        }
        this.facing = toward;
        if (b.onGround) {
          b.vx *= 0.5;
          if (this.hopCd <= 0 && g.player.alive) {
            b.vy = 8.5 + Math.random() * 2;
            b.vx = toward * d.speed * (0.7 + Math.random() * 0.4);
            this.hopCd = 0.55 + Math.random() * 0.35;
          }
        }
        if (this.touchCd <= 0 && this.touching(g, 0)) {
          this.touchCd = 0.8;
          this.hit(g);
        }
        if (!near && Math.abs(dx) > d.detect + 4) this.go('idle');
        break;

      // ---- runs at the hero, swells up and explodes ----
      case 'bomber':
        switch (this.state) {
          case 'idle':
            b.vx = 0;
            if (near) this.go('chase');
            break;
          case 'chase':
            this.facing = toward;
            b.vx = toward * d.speed;
            if (b.onGround && !hasGround(g.level.solids, b.x + toward * 0.8, b.y)) b.vx = 0;
            if (!near && Math.abs(dx) > d.detect + 4) this.go('idle');
            else if (Math.abs(dx) < d.reach && Math.abs(dy) < 2 && g.player.alive) this.go('windup');
            break;
          case 'windup':
            b.vx = 0;
            this.actor.flash(Math.floor(this.t * 10) % 2 ? 0xffffff : 0xff4a3a, 0.9);
            if (this.t > d.windup) this.explode(g);
            break;
        }
        break;

      // ---- plain walker with a lunge ----
      default: {
        switch (this.state) {
          case 'idle':
            b.vx = 0;
            if (near) this.go('chase');
            break;
          case 'chase':
            this.facing = toward;
            b.vx = toward * d.speed;
            if (b.onGround && !hasGround(g.level.solids, b.x + toward * 0.8, b.y)) b.vx = 0;
            if (!near && Math.abs(dx) > d.detect + 4) this.go('idle');
            else if (Math.abs(dx) < d.reach && Math.abs(dy) < 1.8 && g.player.alive) this.go('windup');
            break;
          case 'windup':
            b.vx = 0;
            if (this.t > d.windup) {
              this.go('attack');
              b.vx = this.facing * 5;
            }
            break;
          case 'attack':
            if (!this.struck && this.touching(g, 0.3)) {
              this.struck = true;
              this.hit(g);
            }
            if (this.t > d.active) this.go('recover');
            break;
          case 'recover':
            b.vx *= 0.8;
            if (this.t > d.recover) this.go('chase');
            break;
        }
      }
    }
    void dt;
  }

  private slammer(g: Game, dx: number, dy: number, near: boolean, toward: number) {
    const b = this.body;
    const d = this.def;
    const ogre = d.kind === 'ogre';
    switch (this.state) {
      case 'idle':
        b.vx = 0;
        if (near) this.go('chase');
        break;
      case 'chase':
        this.facing = toward;
        b.vx = toward * d.speed;
        if (b.onGround && !hasGround(g.level.solids, b.x + toward * (b.w / 2 + 0.4), b.y)) b.vx = 0;
        if (!near && Math.abs(dx) > d.detect + 4) this.go('idle');
        else if (Math.abs(dy) < 2 && g.player.alive) {
          if (Math.abs(dx) < d.reach) this.go('windup');
          else if (ogre && this.cd <= 0 && Math.abs(dx) < 9) {
            this.struck = false;
            this.go('windup');
            this.leap = true;
          }
        }
        break;
      case 'windup':
        b.vx = 0;
        this.facing = toward;
        this.actor.flash(0xff9a9a, 0.7);
        if (this.t > d.windup) {
          if (this.leap) {
            b.vy = 13;
            b.vx = clamp(dx / 0.95, -9, 9);
          }
          this.go('attack');
        }
        break;
      case 'attack':
        if (this.leap) {
          // airborne until it lands
          if (this.t > 0.2 && b.onGround) this.land(g);
        } else if (!this.struck) {
          this.struck = true;
          this.land(g);
        }
        if (this.t > d.active + (this.leap ? 1.5 : 0)) this.go('recover');
        break;
      case 'recover':
        b.vx *= 0.8;
        if (this.t > d.recover) {
          this.cd = 3 + Math.random() * 2;
          this.leap = false;
          this.go('chase');
        }
        break;
    }
  }

  private leap = false;

  private land(g: Game) {
    const b = this.body;
    const d = this.def;
    if (this.struck && this.leap) return;
    this.struck = true;
    b.vx = 0;
    g.shake = Math.max(g.shake, 0.45);
    g.audio.play('heavy');
    g.fx.dust(b.x - 0.8, b.y);
    g.fx.dust(b.x + 0.8, b.y);
    g.fx.ring(b.x, b.y + 0.2, 0xffffff, 40);
    const p = g.player.body;
    if (Math.abs(p.x - b.x) < d.reach + 0.6 && Math.abs(p.y - b.y) < 2.2) this.hit(g);
    // shockwaves race along the floor; jump over them
    for (const side of [-1, 1]) g.spawnEnemyBolt('wave', b.x + side * (b.w / 2 + 0.3), b.y + 0.4, side * 8, 0, 1);
  }

  private explode(g: Game) {
    const b = this.body;
    const p = g.player.body;
    g.shake = Math.max(g.shake, 0.55);
    g.audio.play('heavy');
    g.fx.hit(b.x, b.y + 0.7, 0xff9a3a, 14);
    g.fx.ring(b.x, b.y + 0.7, 0xffd447, 70);
    g.fx.ring(b.x, b.y + 0.7, 0xff6a3a, 40);
    if (g.player.alive && Math.hypot(p.x - b.x, p.y + 0.9 - (b.y + 0.7)) < 2.8) this.hit(g);
    this.hp = 0;
    this.die(g, 0, false);
  }

  private pose(dt: number, dx: number) {
    const a = this.actor;
    const b = this.body;
    const d = this.def;
    const t = this.clock;
    let sx = 1;
    let sy = 1;
    let tilt = 0;
    let lift = 0;

    // idle life: gentle breathing / bobbing
    const breathe = Math.sin(t * 4);
    sx = 1 - breathe * 0.02;
    sy = 1 + breathe * 0.03;
    if (b.fly) lift = 0;

    switch (d.kind) {
      case 'ambush':
      case 'hopper':
        if (!b.onGround) {
          const s = clamp(b.vy / 14, -0.4, 0.4);
          sy = 1 + s * 0.35;
          sx = 1 - s * 0.25;
        } else {
          sy = 0.88 + Math.max(0, this.hopCd) * 0.1;
          sx = 1.1;
        }
        if (this.state === 'rise') {
          const k = clamp(this.t / 0.6, 0, 1);
          sy = 0.2 + k * 0.8 + Math.sin(k * Math.PI) * 0.15;
          sx = 1.25 - k * 0.25;
        }
        tilt = clamp(b.vx * 0.03, -0.25, 0.25);
        break;
      case 'flyer':
      case 'spitter':
      case 'phantom':
        tilt = clamp(b.vx * 0.04, -0.3, 0.3);
        if (this.state === 'windup') {
          const k = clamp(this.t / d.windup, 0, 1);
          sx = 1 + k * 0.25;
          sy = 1 - k * 0.15;
          tilt = Math.sin(t * 60) * 0.12;
        } else if (this.state === 'attack') {
          sx = 0.85;
          sy = 1.2;
          tilt = Math.atan2(b.vy, Math.abs(b.vx) + 0.01) * -0.5 * sign(b.vx);
        }
        break;
      case 'golem':
      case 'ogre':
        if (this.state === 'windup') {
          const k = clamp(this.t / d.windup, 0, 1);
          sy = 1 + k * 0.18;
          sx = 1 - k * 0.1;
          lift = this.leap ? 0 : k * 0.35;
          tilt = Math.sin(t * 50) * 0.04 * k;
        } else if (this.state === 'attack') {
          sy = this.leap && !b.onGround ? 1.15 : 0.8;
          sx = this.leap && !b.onGround ? 0.9 : 1.2;
        } else if (Math.abs(b.vx) > 0.3) {
          lift = Math.abs(Math.sin(t * 6)) * 0.08;
          tilt = Math.sin(t * 6) * 0.05;
        }
        break;
      case 'plant':
        tilt = Math.sin(t * 2.2) * 0.07;
        if (this.state === 'windup') {
          const k = clamp(this.t / d.windup, 0, 1);
          tilt = -0.35 * k;
          sy = 1 - k * 0.12;
        } else if (this.state === 'attack') {
          tilt = 0.4;
          sx = 1.25;
          sy = 0.9;
        }
        break;
      case 'bomber':
        if (this.state === 'windup') {
          const k = clamp(this.t / d.windup, 0, 1);
          sx = sy = 1 + k * 0.7;
        } else lift = Math.abs(Math.sin(t * 9)) * 0.12;
        break;
      case 'charger':
        if (this.state === 'windup') {
          sy = 0.85;
          sx = 1.2;
          tilt = Math.sin(t * 60) * 0.1;
        } else if (this.state === 'attack') {
          tilt = 0.25 * this.facing;
          sx = 1.2;
          sy = 0.9;
        } else lift = Math.abs(Math.sin(t * 8)) * 0.1;
        break;
      case 'spiky':
        lift = Math.abs(Math.sin(t * 7)) * 0.06;
        tilt = Math.sin(t * 7) * 0.06;
        break;
      default:
        // blob and friends: squash while walking, crouch before a lunge
        if (this.state === 'windup') {
          sy = 0.8;
          sx = 1.2;
        } else if (this.state === 'attack') {
          sy = 1.15;
          sx = 0.9;
        } else if (Math.abs(b.vx) > 0.3) {
          lift = Math.abs(Math.sin(t * 8)) * 0.12;
          tilt = Math.sin(t * 8) * 0.06;
        }
    }

    if (this.state === 'hurt') {
      sx = 1.12;
      sy = 0.88;
    }
    if (this.state === 'stun') {
      tilt = Math.sin(t * 8) * 0.18;
      sy = 0.92;
    }
    if (this.state === 'dead') {
      const k = clamp(this.t / 0.7, 0, 1);
      tilt = this.facing * k * 2.4;
      sx = sy = 1 - k * 0.7;
      this.view.alpha = 1 - k;
    } else {
      this.view.alpha = d.kind === 'phantom' ? this.alpha : 1;
    }

    a.squashX = sx;
    a.squashY = sy;
    a.tilt = tilt;
    a.lift = lift;
    a.setFacing(this.state === 'dormant' ? 1 : this.facing);
    a.update(dt, Math.abs(b.vx) > 0.4 && b.onGround);
    this.view.position.set(px(b.x), py(b.y));

    // dizzy stars over a stunned monster
    this.stars.visible = this.state === 'stun';
    if (this.stars.visible) {
      this.stars.position.set(0, -d.body * 64 - 10);
      this.stars.rotation = t * 4;
    }
    void dx;
  }

  private go(s: State) {
    this.state = s;
    this.t = 0;
    this.struck = false;
  }
}
