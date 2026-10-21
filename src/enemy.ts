import * as THREE from 'three';
import { Body, moveBody, sign } from './physics';
import type { Game } from './game';
import type { EnemyDef } from './data/enemies';
import { Actor } from './actor';

type State = 'idle' | 'chase' | 'windup' | 'attack' | 'recover' | 'hurt' | 'stun' | 'dead';

const STUN_TIME = 1.4;

export class Enemy {
  body: Body;
  hp: number;
  facing = -1;
  group = new THREE.Group();
  remove = false;

  private state: State = 'idle';
  private t = 0;
  private struck = false;
  private actor: Actor;
  private model: THREE.Group;

  constructor(readonly def: EnemyDef, x: number) {
    this.hp = def.hp;
    this.body = { x, y: 0.05, vx: 0, vy: 0, w: def.w, h: def.h, onGround: false };
    this.actor = new Actor(def.model, def.h * 1.15, def.tint);
    this.model = this.actor.root;
    this.group.add(this.model);
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
    this.actor.setEmissive(0xffffff);
    g.audio.play(this.hp <= 0 ? 'death' : kb > 1.5 ? 'heavy' : 'hit');
    if (this.hp <= 0) g.onKill(this.def);
  }

  update(dt: number, g: Game) {
    const b = this.body;
    const p = g.player;
    const d = this.def;
    this.t += dt;
    const dx = p.body.x - b.x;
    const dy = p.body.y - b.y;
    const near = Math.abs(dx) < d.detect && Math.abs(dy) < 3.5 && p.alive;
    this.actor.fadeEmissive(0.3);

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
        this.actor.setEmissive(0x661111);
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
      case 'hurt':
        b.vx *= 0.9;
        if (this.t > 0.4) this.go('chase');
        break;
      case 'stun':
        b.vx = 0;
        this.actor.setEmissive(0x2244aa);
        if (this.t > STUN_TIME) this.go('chase');
        break;
      case 'dead':
        b.vx *= 0.9;
        if (this.t > 1.6) this.remove = true;
        break;
    }

    moveBody(b, dt, g.level.solids);
    if (b.y < -20) this.remove = true;

    this.group.position.set(b.x, b.y, 0);
    const targetRot = this.facing > 0 ? 0 : Math.PI;
    this.model.rotation.y += (targetRot - this.model.rotation.y) * 0.3;
    this.animate(dt);
  }

  private animate(dt: number) {
    const a = this.actor;
    const d = this.def;
    switch (this.state) {
      case 'idle':
        a.play('idle');
        break;
      case 'chase':
        a.play(d.speed > 4 ? 'sprint' : 'walk', { speed: Math.max(0.6, d.speed / 2.6) });
        break;
      case 'windup':
        a.play('holding-both', { fade: 0.15 });
        break;
      case 'attack':
        a.play('attack-melee-right', { fit: d.active + 0.1 });
        break;
      case 'recover':
        a.play('idle');
        break;
      case 'hurt':
        a.play('fall', { fit: 0.4 });
        break;
      case 'stun':
        a.play('crouch');
        break;
      case 'dead':
        a.play('die', { once: true });
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
