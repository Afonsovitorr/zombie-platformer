import { Container, Graphics } from 'pixi.js';
import { Body, moveBody, sign } from './physics';
import type { Game } from './game';
import type { EnemyDef } from './data/enemies';
import type { Foe } from './foe';
import { SpriteActor, px, py } from './gfx';
import { Enemy } from './enemy';

type State = 'dormant' | 'idle' | 'windup' | 'attack' | 'recover' | 'stun' | 'dead';
type Atk = 'slam' | 'swipe' | 'charge' | 'summon';

// seconds: telegraph, active, recovery
const TIMES: Record<Atk, [number, number, number]> = {
  slam: [0.9, 0.3, 0.9],
  swipe: [0.5, 0.2, 0.6],
  charge: [0.7, 0.75, 1.2],
  summon: [1.0, 0.3, 0.8],
};
const STUN_TIME = 1.2;
const STUN_IMMUNE = 3;
const MAX_MINIONS = 2;

// The Carniçal Rei. Phase 1: slam and swipe. Phase 2 (<66% hp): also raises zombies.
// Phase 3 (<33% hp): enraged, faster, and adds a charge that leaves it open if it hits a wall.
export class Boss implements Foe {
  body: Body;
  hp: number;
  facing = -1;
  view = new Container();
  remove = false;
  summoned = false;

  private state: State = 'dormant';
  private atk: Atk = 'swipe';
  private t = 0;
  private struck = false;
  private summonCd = 4;
  private chargeCd = 5;
  private stunImmune = 0;
  private forceNext: Atk | null = null;
  private actor: SpriteActor;
  private crown = new Graphics();

  constructor(readonly def: EnemyDef, x: number, y = 0.05) {
    this.hp = def.hp;
    this.body = { x, y: y + 0.05, vx: 0, vy: 0, w: def.w, h: def.h, onGround: false };
    this.actor = new SpriteActor(def.sprite, def.body);
    this.view.addChild(this.actor.root);

    // gold crown sitting on the head
    const c = this.crown;
    c.poly([-26, 0, -30, -34, -13, -17, 0, -42, 13, -17, 30, -34, 26, 0]).fill({ color: 0xffc83d }).stroke({ width: 4, color: 0x1a1030, join: 'round' });
    c.circle(0, -12, 5).fill({ color: 0xe0443a }).stroke({ width: 2.5, color: 0x1a1030 });
    c.scale.set(def.body / 3.2);
    this.view.addChild(c);
    this.crown.position.set(-0.06 * px(def.body), -px(def.body) * 0.9);
  }

  get dead() {
    return this.state === 'dead';
  }

  get maxHp() {
    return this.def.hp;
  }

  private get phase() {
    const r = this.hp / this.def.hp;
    return r > 0.66 ? 1 : r > 0.33 ? 2 : 3;
  }

  activate() {
    if (this.state === 'dormant') this.go('idle');
  }

  reset() {
    this.hp = this.def.hp;
  }

  // Parrying interrupts a telegraphed or active attack and leaves the boss open.
  stun() {
    if (this.dead || this.stunImmune > 0) return;
    if (this.state !== 'windup' && this.state !== 'attack') return;
    this.body.vx = 0;
    this.stunImmune = STUN_IMMUNE;
    this.go('stun');
  }

  hurt(dmg: number, _dir: number, g: Game) {
    if (this.dead || this.state === 'dormant') return;
    const before = this.phase;
    this.hp -= this.state === 'stun' ? dmg * 1.5 : dmg;
    g.hitStop = Math.max(g.hitStop, 0.04);
    this.actor.flash(0xff6a6a);
    g.fx.hit(this.body.x, this.body.y + this.body.h * 0.6, 0xffe066, 9);
    g.audio.play(this.hp <= 0 ? 'death' : 'heavy');
    if (this.hp <= 0) {
      this.hp = 0;
      this.body.vx = 0;
      this.go('dead');
      g.onBossDefeated(this.def);
      return;
    }
    if (this.phase > before) {
      this.forceNext = this.phase === 2 ? 'summon' : 'slam';
      g.toast(this.phase === 2 ? 'O Carniçal Rei ruge e chama os mortos!' : 'O Carniçal Rei está furioso!');
      g.shake = Math.max(g.shake, 0.5);
    }
  }

  update(dt: number, g: Game) {
    const b = this.body;
    const p = g.player;
    this.t += dt;
    this.stunImmune = Math.max(0, this.stunImmune - dt);
    this.summonCd -= dt;
    this.chargeCd -= dt;

    const dx = p.body.x - b.x;
    const dy = p.body.y - b.y;
    const enraged = this.phase === 3;
    const speedMul = enraged ? 0.7 : 1; // enraged boss telegraphs and recovers faster

    switch (this.state) {
      case 'dormant':
        b.vx = 0;
        break;
      case 'idle': {
        this.facing = sign(dx);
        b.vx = 0;
        if (!p.alive || this.t < 0.35) break;
        const next = this.forceNext ?? this.pickAttack(g, Math.abs(dx));
        if (next) {
          this.forceNext = null;
          this.begin(next);
        } else {
          b.vx = this.facing * this.def.speed * (enraged ? 1.4 : 1);
        }
        break;
      }
      case 'windup': {
        const [wind] = TIMES[this.atk];
        b.vx = 0;
        if (this.t < wind * speedMul * 0.6) this.facing = sign(dx); // stops tracking right before the blow
        this.actor.flash(0xff9a9a, 0.7);
        if (this.t > wind * speedMul) this.enterAttack(g);
        break;
      }
      case 'attack': {
        const [, act] = TIMES[this.atk];
        if (this.atk === 'charge') {
          b.vx = this.facing * 12;
          if (!this.struck && Math.abs(dx) < 1.9 && Math.abs(dy) < 2.6 && p.alive) {
            this.struck = true;
            p.takeDamage(this.def.damage, b.x, g, this);
          }
          if (this.t > 0.15 && b.vx === 0) {
            // slammed into a wall: stunned and open for a while
            g.shake = Math.max(g.shake, 0.6);
            g.audio.play('heavy');
            this.go('stun');
            break;
          }
        } else {
          b.vx = 0;
        }
        if (this.t > act) this.go('recover');
        break;
      }
      case 'recover': {
        const [, , rec] = TIMES[this.atk];
        b.vx *= 0.8;
        if (this.t > rec * speedMul) this.go('idle');
        break;
      }
      case 'stun':
        b.vx = 0;
        this.actor.flash(0x8fa8ff, 1);
        if (this.t > STUN_TIME) this.go('idle');
        break;
      case 'dead':
        b.vx = 0;
        if (this.t > 3) this.remove = true;
        break;
    }

    moveBody(b, dt, g.level.solids);
    this.view.position.set(px(b.x), py(b.y));
    this.view.alpha = this.state === 'dead' ? Math.max(0, 1 - Math.max(0, this.t - 1.5) / 1.4) : 1;
    this.actor.setFacing(this.facing);
    this.animate(dt);
  }

  private minions(g: Game) {
    return g.enemies.filter((e) => e instanceof Enemy && e.owner === this && !e.dead).length;
  }

  private pickAttack(g: Game, dist: number): Atk | null {
    if (this.phase >= 2 && this.summonCd <= 0 && this.minions(g) < MAX_MINIONS) return 'summon';
    if (this.phase === 3 && this.chargeCd <= 0 && dist > 4.5) return 'charge';
    if (dist < 3.4) return Math.random() < 0.5 ? 'slam' : 'swipe';
    return null; // too far: keep walking toward the player
  }

  private begin(a: Atk) {
    this.atk = a;
    this.go('windup');
  }

  private enterAttack(g: Game) {
    const b = this.body;
    const p = g.player;
    const dx = p.body.x - b.x;
    const dy = p.body.y - b.y;
    const inFront = dx * this.facing > -0.5;
    this.go('attack');

    switch (this.atk) {
      case 'slam':
        if (Math.abs(dx) < 3.6 && Math.abs(dy) < 2.2 && inFront) p.takeDamage(this.def.damage, b.x, g, this);
        // the shockwave rolls along the ground; jump over it
        g.spawnEnemyBolt('wave', b.x + this.facing * 1.6, b.y + 0.45, this.facing * 9, 0, 1);
        g.shake = Math.max(g.shake, 0.6);
        g.audio.play('heavy');
        break;
      case 'swipe':
        if (Math.abs(dx) < 3.0 && Math.abs(dy) < 2.2 && inFront) p.takeDamage(1, b.x, g, this);
        g.audio.play('swing');
        break;
      case 'charge':
        this.chargeCd = 8;
        g.audio.play('growl');
        break;
      case 'summon':
        this.summonCd = 12;
        for (const side of [-1, 1]) g.spawnEnemy('walker', g.clampToArena(b.x + side * 4.5), b.y + 0.05, this);
        g.audio.play('growl');
        break;
    }
  }

  private animate(dt: number) {
    const a = this.actor;
    const [wind, act] = TIMES[this.atk];
    const speedMul = this.phase === 3 ? 0.7 : 1;
    switch (this.state) {
      case 'dormant':
      case 'recover':
        a.play('idle');
        break;
      case 'idle':
        if (Math.abs(this.body.vx) > 0.2) a.play('walk', { speed: this.phase === 3 ? 1.5 : 1 });
        else a.play('idle');
        break;
      case 'windup':
      case 'attack': {
        const clip = this.atk === 'swipe' ? 'attack2' : 'attack';
        const strike = a.strike(clip);
        if (this.atk === 'charge') a.play(this.state === 'windup' ? 'idle' : 'run', { speed: 1.4 });
        else if (this.atk === 'summon') a.scrub('attack', this.state === 'windup' ? 0.05 : 0.1);
        else if (this.state === 'windup') a.scrub(clip, (strike * this.t) / Math.max(0.01, wind * speedMul));
        else a.scrub(clip, Math.min(0.98, strike + ((0.98 - strike) * this.t) / Math.max(0.01, act)));
        break;
      }
      case 'stun':
        a.scrub('idle', 0.3);
        break;
      case 'dead':
        a.play('die', { once: true, fit: 1.2 });
        break;
    }
    a.update(dt);
    this.crown.visible = this.state !== 'dead';
  }

  private go(s: State) {
    this.state = s;
    this.t = 0;
    this.struck = false;
  }
}
