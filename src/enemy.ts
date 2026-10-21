import { Container } from 'pixi.js';
import { Body, Box, moveBody, sign } from './physics';
import type { Game } from './game';
import type { EnemyDef } from './data/enemies';
import type { Foe } from './foe';
import { SpriteActor, px, py } from './gfx';

type State = 'idle' | 'chase' | 'windup' | 'attack' | 'recover' | 'hurt' | 'stun' | 'dead';

const STUN_TIME = 1.4;
const RISE_TIME = 0.8;
const MAX_MINIONS = 2;
const SUMMON_COOLDOWN = 7;

// True if there is a floor under (x, y), used so keep-away movement does not walk off ledges.
export function hasGround(solids: Box[], x: number, y: number) {
  return solids.some((s) => x >= s.x0 && x <= s.x1 && Math.abs(s.y1 - y) < 0.6);
}

export class Enemy implements Foe {
  body: Body;
  hp: number;
  facing = -1;
  view = new Container();
  remove = false;

  private state: State = 'idle';
  private t = 0;
  private struck = false;
  private castCd = 3;
  private rise = 0;
  private actor: SpriteActor;

  constructor(readonly def: EnemyDef, x: number, y = 0.05, public summoned = false, readonly owner?: Foe) {
    this.hp = def.hp;
    this.body = { x, y, vx: 0, vy: 0, w: def.w, h: def.h, onGround: false };
    this.actor = new SpriteActor(def.sprite, def.body);
    this.view.addChild(this.actor.root);
    if (summoned) this.rise = RISE_TIME;
  }

  get dead() {
    return this.state === 'dead';
  }

  // A parried enemy is left open: hits on it deal double damage.
  stun() {
    if (this.dead) return;
    this.body.vx = 0;
    this.go('stun');
  }

  hurt(dmg: number, dir: number, g: Game, kb = 1) {
    if (this.dead) return;
    this.hp -= this.state === 'stun' ? dmg * 2 : dmg;
    g.hitStop = Math.max(g.hitStop, 0.06);
    const heavy = this.def.scale > 1.2 ? 0.4 : 1;
    this.body.vx = dir * 6 * heavy * kb;
    this.body.vy = 4 * heavy;
    this.go(this.hp <= 0 ? 'dead' : 'hurt');
    this.actor.flash(0xff9a9a);
    g.fx.hit(this.body.x, this.body.y + this.body.h * 0.6);
    g.audio.play(this.hp <= 0 ? 'death' : kb > 1.5 ? 'heavy' : 'hit');
    if (this.hp <= 0) g.onKill(this.def, this.summoned);
  }

  update(dt: number, g: Game) {
    const b = this.body;
    this.t += dt;

    if (this.rise > 0) {
      this.rise -= dt;
      b.vx = 0;
      this.actor.scrub('die', Math.max(0, this.rise / RISE_TIME));
      if (this.rise < dt * 1.5) g.fx.dust(b.x, b.y, 0);
      moveBody(b, dt, g.level.solids);
      this.view.position.set(px(b.x), py(b.y));
      this.actor.setFacing(this.facing);
      this.actor.update(dt);
      return;
    }

    if (!this.common()) {
      switch (this.def.kind) {
        case 'archer': this.updateArcher(g); break;
        case 'hound': this.updateHound(g); break;
        case 'necro': this.updateNecro(dt, g); break;
        default: this.updateMelee(g);
      }
    }

    moveBody(b, dt, g.level.solids);
    if (b.y < g.level.def.killY) this.remove = true;

    this.view.position.set(px(b.x), py(b.y));
    this.view.alpha = this.state === 'dead' ? Math.max(0, 1.6 - this.t) : 1;
    this.actor.setFacing(this.facing);
    this.animate(dt);
  }

  private awake(g: Game) {
    const p = g.player;
    const dx = p.body.x - this.body.x;
    const dy = p.body.y - this.body.y;
    const reachY = this.def.kind === 'archer' ? 9 : 3.5;
    return { dx, dy, near: Math.abs(dx) < this.def.detect && Math.abs(dy) < reachY && p.alive };
  }

  // States every enemy shares: being hurt, stunned (parried) or dead.
  private common() {
    const b = this.body;
    switch (this.state) {
      case 'hurt':
        b.vx *= 0.9;
        if (this.t > 0.4) this.go(this.def.kind === 'archer' ? 'idle' : 'chase');
        return true;
      case 'stun':
        b.vx = 0;
        this.actor.flash(0x8fa8ff, 1);
        if (this.t > STUN_TIME) this.go(this.def.kind === 'archer' ? 'idle' : 'chase');
        return true;
      case 'dead':
        b.vx *= 0.9;
        if (this.t > 1.6) this.remove = true;
        return true;
    }
    return false;
  }

  private updateMelee(g: Game) {
    const b = this.body;
    const d = this.def;
    const p = g.player;
    const { dx, dy, near } = this.awake(g);

    switch (this.state) {
      case 'idle':
        b.vx = 0;
        if (near) this.go('chase');
        break;
      case 'chase':
        this.facing = sign(dx);
        b.vx = this.facing * d.speed;
        if (!near && Math.abs(dx) > d.detect + 4) this.go('idle');
        else if (Math.abs(dx) < d.reach && Math.abs(dy) < 1.5 && p.alive) {
          g.audio.play('growl');
          this.go('windup');
        }
        break;
      case 'windup':
        b.vx = 0;
        this.actor.flash(0xff9a9a, 0.7);
        if (this.t > d.windup) this.go('attack');
        break;
      case 'attack':
        b.vx = this.facing;
        if (!this.struck) {
          this.struck = true;
          if (Math.abs(dx) < d.reach + 0.5 && Math.abs(dy) < d.h * 0.85 && dx * this.facing > -0.3) {
            p.takeDamage(d.damage, b.x, g, this);
          }
        }
        if (this.t > d.active) this.go('recover');
        break;
      case 'recover':
        b.vx = 0;
        if (this.t > d.recover) this.go('chase');
        break;
    }
  }

  private updateArcher(g: Game) {
    const b = this.body;
    const d = this.def;
    const { dx, near } = this.awake(g);
    b.vx = 0;
    switch (this.state) {
      case 'idle':
        if (near) {
          this.facing = sign(dx);
          this.go('windup');
        }
        break;
      case 'windup':
        this.facing = sign(dx);
        this.actor.flash(0xff9a9a, 0.7);
        if (this.t > d.windup) {
          const p = g.player.body;
          const sx = b.x + this.facing * 0.7;
          const sy = b.y + 1.2;
          const ex = p.x - sx;
          const ey = p.y + 1.0 - sy;
          const len = Math.hypot(ex, ey) || 1;
          g.spawnEnemyBolt('arrow', sx, sy, (ex / len) * 13, (ey / len) * 13, d.damage);
          g.audio.play('bow');
          this.go('attack');
        }
        break;
      case 'attack':
        if (this.t > d.active) this.go('recover');
        break;
      case 'recover':
        if (this.t > d.recover) this.go('idle');
        break;
      default:
        this.go('idle');
    }
  }

  private updateHound(g: Game) {
    const b = this.body;
    const d = this.def;
    const p = g.player;
    const { dx, dy, near } = this.awake(g);

    switch (this.state) {
      case 'idle':
        b.vx = 0;
        if (near) this.go('chase');
        break;
      case 'chase':
        this.facing = sign(dx);
        b.vx = this.facing * d.speed;
        if (!near && Math.abs(dx) > d.detect + 4) this.go('idle');
        else if (Math.abs(dx) < d.reach && Math.abs(dy) < 1.8 && p.alive) {
          g.audio.play('growl');
          this.go('windup');
        }
        break;
      case 'windup':
        b.vx = 0;
        this.facing = sign(dx);
        this.actor.flash(0xff9a9a, 0.7);
        if (this.t > d.windup) {
          this.go('attack');
          b.vx = this.facing * 10;
          b.vy = 8;
        }
        break;
      case 'attack':
        if (!this.struck && Math.abs(dx) < 1.0 && Math.abs(dy) < 1.3 && p.alive) {
          this.struck = true;
          p.takeDamage(d.damage, b.x, g, this);
        }
        if (this.t > d.active || (this.t > 0.25 && b.onGround)) this.go('recover');
        break;
      case 'recover':
        b.vx *= 0.8;
        if (this.t > d.recover) this.go('chase');
        break;
    }
  }

  private minions(g: Game) {
    return g.enemies.filter((e) => e instanceof Enemy && e.owner === this && !e.dead).length;
  }

  private updateNecro(dt: number, g: Game) {
    const b = this.body;
    const d = this.def;
    const { dx, near } = this.awake(g);
    this.castCd -= dt;

    switch (this.state) {
      case 'idle':
        b.vx = 0;
        if (near) this.go('chase');
        break;
      case 'chase': {
        this.facing = sign(dx);
        const away = -this.facing;
        const tooClose = Math.abs(dx) < 5;
        b.vx = tooClose && hasGround(g.level.solids, b.x + away * 0.9, b.y) ? away * d.speed : 0;
        if (!near && Math.abs(dx) > d.detect + 4) this.go('idle');
        else if (near && this.castCd <= 0 && this.minions(g) < MAX_MINIONS) this.go('windup');
        break;
      }
      case 'windup':
        b.vx = 0;
        this.facing = sign(dx);
        this.actor.flash(0xd29aff, 0.7);
        if (this.t > d.windup) {
          const side = hasGround(g.level.solids, b.x - this.facing * 2.5, b.y) ? -this.facing : this.facing;
          g.spawnEnemy('walker', b.x + side * 2.5, b.y + 0.05, this);
          g.fx.ring(b.x + side * 2.5, b.y + 0.4, 0xb84dff, 26);
          this.castCd = SUMMON_COOLDOWN;
          this.go('attack');
        }
        break;
      case 'attack':
        b.vx = 0;
        if (this.t > d.active) this.go('recover');
        break;
      case 'recover':
        b.vx = 0;
        if (this.t > d.recover) this.go('chase');
        break;
    }
  }

  private animate(dt: number) {
    const a = this.actor;
    const d = this.def;
    const k = d.kind;
    switch (this.state) {
      case 'idle':
      case 'recover':
        a.play('idle');
        break;
      case 'chase':
        if (k === 'necro') a.play(Math.abs(this.body.vx) > 0.1 ? 'walk' : 'idle');
        else if (d.speed > 4) a.play('run', { speed: d.speed / 5 });
        else a.play('walk', { speed: Math.max(0.7, d.speed / 2.2) });
        break;
      case 'windup':
        // wind-up frames, ending on the frame just before the baked-in slash
        a.scrub('attack', (0.7 * this.t) / Math.max(0.01, d.windup));
        break;
      case 'attack':
        a.scrub('attack', Math.min(0.98, 0.7 + (0.28 * this.t) / Math.max(0.01, d.active)));
        break;
      case 'hurt':
        a.scrub('idle', 0);
        break;
      case 'stun':
        a.scrub('idle', 0.25);
        break;
      case 'dead':
        a.play('die', { once: true, fit: 0.9 });
        break;
    }
    a.update(dt);
  }

  private go(s: State) {
    this.state = s;
    this.t = 0;
    this.struck = false;
  }
}
