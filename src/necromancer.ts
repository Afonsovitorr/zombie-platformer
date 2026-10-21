import { Container } from 'pixi.js';
import { Body, moveBody, sign } from './physics';
import type { Game } from './game';
import type { EnemyDef } from './data/enemies';
import type { Foe, Hit } from './foe';
import { SpriteActor, px, py } from './gfx';

type State = 'dormant' | 'idle' | 'vanish' | 'appear' | 'barrage' | 'summon' | 'rain' | 'melee' | 'recover' | 'stun' | 'dead';

const STUN_TIME = 1.4;
const STUN_IMMUNE = 3;
const MAX_MINIONS = 3;

// The Necromancer: teleports around the arena and casts. Phase 1: bolt barrages and a staff swing.
// Phase 2 (<66% hp): raises flying skulls. Phase 3 (<33% hp): faster, and calls a rain of fire.
// He is open to attack while he recovers from a spell; parrying the staff swing stuns him.
export class Necromancer implements Foe {
  body: Body;
  hp: number;
  readonly maxHp: number;
  facing = -1;
  view = new Container();
  remove = false;
  summoned = false;

  private state: State = 'dormant';
  private t = 0;
  private actor: SpriteActor;
  private actions = 0;
  private summonCd = 3;
  private rainCd = 4;
  private stunImmune = 0;
  private forceNext: 'summon' | 'rain' | null = null;
  private target = 0;

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

  get intangible() {
    return this.state === 'vanish' || this.state === 'appear' || this.state === 'dormant';
  }

  private get phase() {
    const r = this.hp / this.maxHp;
    return r > 0.66 ? 1 : r > 0.33 ? 2 : 3;
  }

  activate() {
    if (this.state === 'dormant') this.go('idle');
  }

  stun() {
    if (this.dead || this.stunImmune > 0) return;
    if (this.state !== 'melee' && this.state !== 'barrage') return;
    this.body.vx = 0;
    this.stunImmune = STUN_IMMUNE;
    this.go('stun');
  }

  hurt(dmg: number, _dir: number, g: Game, _kb = 1, _how: Hit = 'melee') {
    if (this.dead || this.intangible) return;
    const before = this.phase;
    this.hp -= this.state === 'stun' ? dmg * 1.5 : dmg;
    g.hitStop = Math.max(g.hitStop, 0.04);
    this.actor.flash(0xff8080);
    g.fx.hit(this.body.x, this.body.y + this.body.h * 0.6, 0xd29aff, 9);
    g.audio.play(this.hp <= 0 ? 'death' : 'heavy');
    if (this.hp <= 0) {
      this.hp = 0;
      this.body.vx = 0;
      this.go('dead');
      g.fx.ring(this.body.x, this.body.y + 1.4, 0xb84dff, 80);
      g.onBossDefeated(this.def);
      return;
    }
    if (this.phase > before) {
      this.forceNext = this.phase === 2 ? 'summon' : 'rain';
      g.toast(this.phase === 2 ? 'O Necromante invoca os mortos!' : 'O Necromante está furioso!');
      g.shake = Math.max(g.shake, 0.5);
      this.go('vanish');
    }
  }

  update(dt: number, g: Game) {
    const b = this.body;
    const p = g.player.body;
    this.t += dt;
    this.stunImmune = Math.max(0, this.stunImmune - dt);
    this.summonCd -= dt;
    this.rainCd -= dt;
    const dx = p.x - b.x;
    const fast = this.phase === 3 ? 0.75 : 1;

    switch (this.state) {
      case 'dormant':
        b.vx = 0;
        break;
      case 'idle':
        b.vx = 0;
        this.facing = sign(dx);
        if (!g.player.alive || this.t < 0.5 * fast) break;
        this.choose(g, Math.abs(dx));
        break;
      case 'vanish':
        b.vx = 0;
        if (this.t === dt) g.fx.ring(b.x, b.y + 1.4, 0xb84dff, 40);
        if (this.t > 0.3) {
          // reappear on the far side of the hero, inside the arena
          const side = p.x > (g.level.def.boss!.arena[0] + g.level.def.boss!.arena[1]) / 2 ? -1 : 1;
          b.x = g.clampToArena(p.x + side * (5 + Math.random() * 4));
          b.y = Math.max(b.y, g.level.def.boss!.y + 0.05);
          this.go('appear');
          g.fx.ring(b.x, b.y + 1.4, 0xb84dff, 40);
        }
        break;
      case 'appear':
        this.facing = sign(dx);
        if (this.t > 0.3) this.go('idle');
        break;
      case 'barrage': {
        b.vx = 0;
        this.facing = sign(dx);
        this.actor.flash(0xd29aff, 0.7);
        if (this.t > 0.7 * fast && this.t - dt <= 0.7 * fast) {
          const n = this.phase === 3 ? 5 : 3;
          const sx = b.x + this.facing * 0.8;
          const sy = b.y + 2.0;
          const base = Math.atan2(p.y + 1.0 - sy, p.x - sx);
          for (let i = 0; i < n; i++) {
            const a = base + (i - (n - 1) / 2) * 0.22;
            g.spawnEnemyBolt('fire', sx, sy, Math.cos(a) * 7.5, Math.sin(a) * 7.5, 1);
          }
          g.audio.play('bow');
        }
        if (this.t > 1.2 * fast) this.go('recover');
        break;
      }
      case 'summon':
        b.vx = 0;
        this.actor.flash(0xd29aff, 0.7);
        if (this.t > 1.0 * fast && this.t - dt <= 1.0 * fast) {
          const a = g.level.def.boss!.arena;
          const minions = g.enemies.filter((e) => e.def.id === 'skull' && !e.dead).length;
          for (let i = minions; i < MAX_MINIONS; i++) g.spawnEnemy('skull', a[0] + 4 + Math.random() * (a[1] - a[0] - 8), b.y + 1.5, this);
          g.audio.play('growl');
          g.shake = Math.max(g.shake, 0.3);
        }
        if (this.t > 1.6 * fast) this.go('recover');
        break;
      case 'rain':
        b.vx = 0;
        this.actor.flash(0xff9a6a, 0.7);
        if (this.t > 1.0 * fast && this.t - dt <= 1.0 * fast) {
          const a = g.level.def.boss!.arena;
          for (let x = a[0] + 3; x < a[1] - 2; x += 3.2) g.spawnEnemyBolt('fire', x + (Math.random() - 0.5) * 1.5, b.y + 10 + Math.random() * 2, 0, -8.5, 1);
          g.audio.play('heavy');
          g.shake = Math.max(g.shake, 0.4);
        }
        if (this.t > 1.8 * fast) this.go('recover');
        break;
      case 'melee':
        b.vx = 0;
        this.facing = sign(dx);
        this.actor.flash(0xff9a9a, 0.7);
        if (this.t > 0.55 * fast && this.t - dt <= 0.55 * fast) {
          if (Math.abs(dx) < 3 && Math.abs(p.y - b.y) < 2.5) g.player.takeDamage(1, b.x, g, this);
          g.audio.play('swing');
        }
        if (this.t > 0.9 * fast) this.go('recover');
        break;
      case 'recover':
        b.vx = 0;
        if (this.t > 1.1 * fast) {
          this.actions++;
          this.go(this.actions % 2 === 0 ? 'vanish' : 'idle');
        }
        break;
      case 'stun':
        b.vx = 0;
        this.actor.flash(0x9fb4ff, 1);
        if (this.t > STUN_TIME) this.go('idle');
        break;
      case 'dead':
        b.vx = 0;
        if (this.t > 3) this.remove = true;
        break;
    }

    moveBody(b, dt, g.level.solids);
    this.view.position.set(px(b.x), py(b.y));
    const fade = this.state === 'vanish' ? 1 - this.t / 0.3 : this.state === 'appear' ? this.t / 0.3 : 1;
    this.view.alpha = this.state === 'dead' ? Math.max(0, 1 - Math.max(0, this.t - 1.5) / 1.4) : Math.max(0, Math.min(1, fade));
    this.actor.setFacing(this.facing);
    this.animate(dt);
    void this.target;
  }

  private choose(g: Game, dist: number) {
    if (this.forceNext) {
      const f = this.forceNext;
      this.forceNext = null;
      if (f === 'summon') this.summonCd = 10;
      else this.rainCd = 9;
      this.go(f);
      return;
    }
    if (this.phase >= 2 && this.summonCd <= 0) {
      this.summonCd = 11;
      this.go('summon');
    } else if (this.phase === 3 && this.rainCd <= 0) {
      this.rainCd = 9;
      this.go('rain');
    } else if (dist < 2.8) this.go('melee');
    else this.go('barrage');
    void g;
  }

  private animate(dt: number) {
    const a = this.actor;
    switch (this.state) {
      case 'barrage':
      case 'summon':
      case 'rain':
        a.scrub('attack', Math.min(0.95, (this.t * 0.7) / 0.9));
        break;
      case 'melee':
        a.scrub('attack2', Math.min(0.95, (this.t / 0.9) * 0.7));
        break;
      case 'stun':
        a.scrub('idle', 0.3);
        break;
      case 'dead':
        a.play('die', { once: true, fit: 1.2 });
        break;
      default:
        a.play('idle');
    }
    a.update(dt);
  }

  private go(s: State) {
    this.state = s;
    this.t = 0;
  }
}
