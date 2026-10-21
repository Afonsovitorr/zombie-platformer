import { Container, Graphics } from 'pixi.js';
import { Body, moveBody, sign } from './physics';
import type { Input } from './input';
import type { Game } from './game';
import type { Foe } from './foe';
import { BASE_STATS, Stats } from './data/skills';
import { SpriteActor, px, py } from './gfx';

type State = 'free' | 'attack' | 'block' | 'dodge' | 'hurt' | 'plunge' | 'dead';

interface Stage {
  dur: number; // total length of the swing
  from: number; // hit window start / end (seconds into the swing)
  to: number;
  dmg: number; // multiplier over stats.damage
  reach: number;
  kb: number; // knockback multiplier
  lunge: number; // forward push when the swing starts
  shake: number;
}

// 3-hit combo: two quick slashes, then a heavy finisher.
const STAGES: Stage[] = [
  { dur: 0.4, from: 0.16, to: 0.3, dmg: 1, reach: 2.0, kb: 1, lunge: 3, shake: 0 },
  { dur: 0.4, from: 0.16, to: 0.3, dmg: 1, reach: 2.1, kb: 1, lunge: 3, shake: 0 },
  { dur: 0.55, from: 0.26, to: 0.4, dmg: 1.6, reach: 2.3, kb: 1.8, lunge: 5, shake: 0.18 },
];

const JUMP = 15;
const DODGE_TIME = 0.28;
const DODGE_COST = 25;
const BLOCK_COST = 20;

export class Player {
  body: Body = { x: 0, y: 0.5, vx: 0, vy: 0, w: 0.8, h: 1.7, onGround: false };
  facing = 1;
  stats: Stats = { ...BASE_STATS };
  hp = BASE_STATS.maxHp;
  stamina = BASE_STATS.maxStamina;
  arrows = BASE_STATS.maxArrows;
  state: State = 'free';
  view = new Container();

  private t = 0;
  private invuln = 0;
  private coyote = 0;
  private jumpBuf = 0;
  private rangedCd = 0;
  private stage = 0;
  private queued = false;
  private blockT = 99;
  private airJumpsLeft = 0;
  private hit = new Set<object>();
  private safe = { x: 0, y: 0.5 };
  private safeTimer = 0;

  private actor = new SpriteActor('hero', 2.25);
  private shield = new Graphics();
  private wasAir = false;
  private ghostT = 0;
  private slashed = false;

  constructor() {
    this.shield.arc(0, 0, 70, -1.2, 1.2).stroke({ width: 8, color: 0x7fe0ff, alpha: 0.9, cap: 'round' });
    this.shield.arc(0, 0, 58, -1.0, 1.0).stroke({ width: 4, color: 0xffffff, alpha: 0.6, cap: 'round' });
    this.shield.visible = false;
    this.view.addChild(this.actor.root, this.shield);
  }

  get maxHp() {
    return this.stats.maxHp;
  }

  get maxStamina() {
    return this.stats.maxStamina;
  }

  get alive() {
    return this.state !== 'dead';
  }

  reset(x: number, stats: Stats) {
    this.stats = stats;
    Object.assign(this.body, { x, y: 0.5, vx: 0, vy: 0 });
    this.hp = stats.maxHp;
    this.stamina = stats.maxStamina;
    this.arrows = stats.maxArrows;
    this.state = 'free';
    this.stage = 0;
    this.invuln = 0;
    this.facing = 1;
    this.safe = { x, y: 0.5 };
  }

  // Applies new stats mid-run (e.g. after buying a skill); max increases also heal that amount.
  setStats(next: Stats) {
    this.hp += Math.max(0, next.maxHp - this.stats.maxHp);
    this.stamina += Math.max(0, next.maxStamina - this.stats.maxStamina);
    this.arrows += Math.max(0, next.maxArrows - this.stats.maxArrows);
    this.stats = next;
  }

  update(dt: number, inp: Input, g: Game) {
    const b = this.body;
    this.t += dt;
    this.invuln = Math.max(0, this.invuln - dt);
    this.rangedCd -= dt;
    this.coyote = b.onGround ? 0.1 : this.coyote - dt;
    this.jumpBuf = inp.pressed.jump ? 0.12 : this.jumpBuf - dt;
    if (b.onGround) this.airJumpsLeft = this.stats.airJumps;

    switch (this.state) {
      case 'free':
      case 'block':
        this.control(dt, inp, g);
        break;
      case 'attack': {
        const st = STAGES[this.stage];
        b.vx *= 0.9;
        if (inp.pressed.attack && this.t > 0.08) this.queued = true;
        this.attackTick(g, st);
        if (this.t > st.to && this.tryDodge(inp, g)) break;
        if (this.t >= st.dur) {
          if (this.queued && this.stage < STAGES.length - 1) this.startAttack(this.stage + 1, inp, g);
          else this.endAttack();
        }
        break;
      }
      case 'dodge':
        b.vx = this.facing * 13;
        if (this.t >= DODGE_TIME) this.setState('free');
        break;
      case 'plunge':
        b.vx = 0;
        b.vy = -20;
        this.plungeTick(g);
        if (b.onGround) {
          g.audio.play('land');
          g.shake = Math.max(g.shake, 0.2);
          this.setState('free');
        }
        break;
      case 'hurt':
        b.vx *= 0.92;
        if (this.t >= 0.35) this.setState('free');
        break;
      case 'dead':
        b.vx = 0;
        break;
    }

    if (this.state !== 'block' && this.state !== 'dodge' && this.alive) {
      this.stamina = Math.min(this.maxStamina, this.stamina + 28 * dt);
    }

    moveBody(b, dt, g.level.solids);

    if (b.onGround) {
      this.safeTimer += dt;
      if (this.safeTimer > 0.3) this.safe = { x: b.x, y: b.y + 0.1 };
    } else {
      this.safeTimer = 0;
    }
    if (b.y < -14 && this.alive) {
      this.hp -= 1;
      Object.assign(b, { x: this.safe.x - this.facing * 0.5, y: this.safe.y, vx: 0, vy: 0 });
      this.invuln = 1.2;
      this.setState('free');
      if (this.hp <= 0) this.die();
    }

    this.animate(dt, g);
  }

  private setState(s: State) {
    this.state = s;
    this.t = 0;
    this.hit.clear();
  }

  private endAttack() {
    this.stage = 0;
    this.setState('free');
  }

  private control(dt: number, inp: Input, g: Game) {
    const b = this.body;
    const wasBlock = this.state === 'block';
    const wantBlock = inp.held.block && b.onGround && this.stamina > 0;
    this.state = wantBlock ? 'block' : 'free';
    const blocking = wantBlock;
    this.blockT = blocking ? (wasBlock ? this.blockT + dt : 0) : 99;

    const target = inp.moveX * (blocking ? 1.5 : this.stats.runSpeed);
    const accel = b.onGround ? 60 : 35;
    const diff = target - b.vx;
    b.vx += Math.sign(diff) * Math.min(Math.abs(diff), accel * dt);
    if (inp.moveX !== 0) this.facing = sign(inp.moveX);

    if (this.jumpBuf > 0 && !blocking) {
      if (this.coyote > 0) {
        g.audio.play('jump');
        b.vy = JUMP;
        this.jumpBuf = 0;
        this.coyote = 0;
      } else if (this.airJumpsLeft > 0) {
        g.audio.play('jump');
        b.vy = JUMP * 0.92;
        this.airJumpsLeft--;
        this.jumpBuf = 0;
      }
    }
    if (!inp.held.jump && b.vy > 0) b.vy -= 45 * dt; // shorter hop when released early

    if (inp.pressed.attack) {
      if (!b.onGround && inp.held.block) {
        this.setState('plunge');
      } else {
        this.startAttack(0, inp, g);
      }
      return;
    }
    if (this.tryDodge(inp, g)) return;
    if (inp.pressed.ranged && this.rangedCd <= 0 && this.arrows > 0) {
      this.rangedCd = 0.7;
      this.arrows--;
      g.audio.play('bow');
      g.spawnBolt(b.x + this.facing * 0.6, b.y + 1.2, this.facing);
    }
  }

  private tryDodge(inp: Input, g: Game) {
    if (!inp.pressed.dodge || this.stamina < DODGE_COST) return false;
    if (inp.moveX !== 0) this.facing = sign(inp.moveX);
    g.audio.play('dodge');
    this.stamina -= DODGE_COST;
    this.invuln = Math.max(this.invuln, DODGE_TIME + 0.08);
    this.stage = 0;
    this.setState('dodge');
    this.body.vy = Math.max(this.body.vy, 0);
    return true;
  }

  private startAttack(stage: number, inp: Input, g: Game) {
    this.stage = stage;
    this.setState('attack');
    this.queued = false;
    g.audio.play('swing');
    if (inp.moveX !== 0) this.facing = sign(inp.moveX);
    this.body.vx = this.facing * STAGES[stage].lunge * (this.body.onGround ? 1 : 0.5);
  }

  private attackTick(g: Game, st: Stage) {
    if (this.t < st.from || this.t > st.to) return;
    const b = this.body;
    const x0 = Math.min(b.x + this.facing * 0.3, b.x + this.facing * st.reach);
    const x1 = Math.max(b.x + this.facing * 0.3, b.x + this.facing * st.reach);
    for (const z of g.enemies) {
      if (z.dead || this.hit.has(z)) continue;
      const zb = z.body;
      if (zb.x + zb.w / 2 > x0 && zb.x - zb.w / 2 < x1 && zb.y < b.y + 1.9 && zb.y + zb.h > b.y) {
        this.hit.add(z);
        z.hurt(this.stats.damage * st.dmg, this.facing, g, st.kb);
        g.shake = Math.max(g.shake, st.shake);
      }
    }
  }

  // Downward strike: falls fast and bounces off the first enemy it lands on.
  private plungeTick(g: Game) {
    const b = this.body;
    for (const z of g.enemies) {
      if (z.dead) continue;
      const zb = z.body;
      const top = zb.y + zb.h;
      if (Math.abs(zb.x - b.x) < zb.w / 2 + 0.5 && b.y <= top + 0.3 && b.y >= zb.y + zb.h * 0.4) {
        z.hurt(this.stats.damage * 1.5, this.facing, g, 0.6);
        b.vy = 14;
        this.airJumpsLeft = this.stats.airJumps;
        g.shake = Math.max(g.shake, 0.15);
        this.setState('free');
        return;
      }
    }
  }

  takeDamage(amount: number, srcX: number, g: Game, attacker?: Foe) {
    if (!this.alive || this.invuln > 0) return;
    const b = this.body;
    const away = sign(b.x - srcX);
    const frontal = (srcX - b.x) * this.facing > 0;

    if (this.state === 'block' && frontal) {
      if (this.blockT <= this.stats.parryWindow) {
        // parry: no damage, no stamina cost, attacker is stunned
        this.stamina = Math.min(this.maxStamina, this.stamina + 15);
        attacker?.stun();
        g.hitStop = 0.14;
        g.shake = Math.max(g.shake, 0.3);
        g.toast('Parry!');
        g.fx.ring(b.x + this.facing * 0.9, b.y + 1.1, 0x7fe0ff, 34);
        g.fx.text(b.x, b.y + 2.6, 'Parry!', 0x7fe0ff);
        g.audio.play('parry');
        return;
      }
      this.stamina -= BLOCK_COST;
      g.audio.play('block');
      g.fx.hit(b.x + this.facing * 0.9, b.y + 1.1, 0x7fe0ff, 5);
      b.vx = away * 4;
      g.hitStop = 0.04;
      if (this.stamina <= 0) {
        this.stamina = 0;
        b.vx = away * 7; // guard broken
        this.setState('hurt');
      }
      return;
    }

    this.hp -= amount;
    this.actor.flash(0xff9a9a);
    g.fx.hit(b.x, b.y + 1.1, 0xff6a6a, 6);
    g.audio.play(this.hp <= 0 ? 'death' : 'hurt');
    g.hitStop = 0.08;
    g.shake = Math.max(g.shake, 0.25);
    b.vx = away * 7;
    b.vy = 7;
    this.invuln = 1;
    this.stage = 0;
    if (this.hp <= 0) return this.die();
    this.setState('hurt');
  }

  private die() {
    this.hp = 0;
    this.setState('dead');
  }

  // Maps the swing clock onto the clip: wind-up frames, then the baked-in slash, then recovery.
  private swingProgress(st: Stage, strike: number) {
    const t = this.t;
    if (t < st.from) return (strike * t) / st.from;
    if (t < st.to) return strike + (0.2 * (t - st.from)) / (st.to - st.from);
    return strike + 0.2 + (0.08 * (t - st.to)) / Math.max(0.01, st.dur - st.to);
  }

  private animate(dt: number, g: Game) {
    const b = this.body;
    const a = this.actor;
    this.view.position.set(px(b.x), py(b.y));
    a.setFacing(this.facing);
    this.view.rotation = 0;

    // blink while invulnerable (dodge gets a ghost trail instead)
    this.view.visible = this.invuln <= 0 || this.state === 'dodge' || Math.floor(this.t * 20 + this.invuln * 20) % 2 === 0;
    this.shield.visible = this.state === 'block';
    this.shield.position.set(this.facing * 0.85 * 64, -1.1 * 64);
    this.shield.scale.x = this.facing;
    a.root.alpha = this.state === 'dodge' ? 0.6 : 1;
    a.root.rotation = 0;

    if (b.onGround && this.wasAir) g.fx.dust(b.x, b.y, 0);
    this.wasAir = !b.onGround;

    const moving = Math.abs(b.vx);
    switch (this.state) {
      case 'dead':
        a.play('die', { once: true, fit: 0.9 });
        a.update(dt);
        return;
      case 'attack': {
        const st = STAGES[this.stage];
        const clip = this.stage === 1 ? 'attack2' : 'attack';
        a.scrub(clip, this.swingProgress(st, this.stage === 1 ? 0.62 : 0.7));
        if (!this.slashed && this.t >= st.from) {
          this.slashed = true;
          if (this.stage === 2) g.fx.ring(b.x + this.facing * 1.4, b.y + 1.1, 0xffffff, 22);
        }
        if (this.t < st.from) this.slashed = false;
        break;
      }
      case 'plunge':
        a.scrub('jump', 0.3);
        a.root.rotation = this.facing * 0.5;
        break;
      case 'dodge':
        a.play('run', { speed: 2 });
        a.update(dt);
        this.ghostT -= dt;
        if (this.ghostT <= 0) {
          this.ghostT = 0.05;
          g.fx.ghost(a, b.x, b.y, this.facing);
        }
        return;
      case 'hurt':
        a.scrub('idle', 0);
        a.root.rotation = -this.facing * 0.18;
        break;
      case 'block':
        a.scrub('idle', 0.2);
        break;
      default:
        if (!b.onGround) a.scrub('jump', b.vy > 1 ? 0.3 : 0.45);
        else if (moving > 5) a.play('run', { speed: Math.max(0.8, moving / this.stats.runSpeed) });
        else if (moving > 0.5) a.play('walk', { speed: Math.max(0.8, moving / 2.4) });
        else a.play('idle');
    }
    a.update(dt);
  }

}

export class Bolt {
  view = new Graphics();
  x: number;
  y: number;
  vx: number;
  life = 1.3;
  dead = false;

  constructor(x: number, y: number, dir: number) {
    this.x = x;
    this.y = y;
    this.vx = dir * 16;
    this.view.poly([-22, -3, 14, -3, 14, -8, 26, 0, 14, 8, 14, 3, -22, 3]).fill({ color: 0xfff2a8 }).stroke({ width: 3, color: 0x1a1030, join: 'round' });
    this.view.rect(-26, -6, 8, 12).fill({ color: 0xe0443a });
    this.view.scale.x = dir;
    this.view.position.set(px(x), py(y));
  }

  update(dt: number, g: Game) {
    this.x += this.vx * dt;
    this.life -= dt;
    this.view.position.x = px(this.x);
    if (this.life <= 0) this.dead = true;
    for (const s of g.level.solids) {
      if (this.x > s.x0 && this.x < s.x1 && this.y > s.y0 && this.y < s.y1) this.dead = true;
    }
    for (const z of g.enemies) {
      if (z.dead) continue;
      const zb = z.body;
      if (Math.abs(this.x - zb.x) < zb.w / 2 + 0.25 && this.y > zb.y && this.y < zb.y + zb.h) {
        z.hurt(1, sign(this.vx), g);
        this.dead = true;
        break;
      }
    }
  }
}
