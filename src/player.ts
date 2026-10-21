import * as THREE from 'three';
import { Body, moveBody, sign } from './physics';
import type { Input } from './input';
import type { Game } from './game';
import type { Enemy } from './enemy';
import { BASE_STATS, Stats } from './data/skills';

type State = 'free' | 'attack' | 'block' | 'dodge' | 'hurt' | 'plunge' | 'dead';

interface Stage {
  dur: number; // total length of the swing
  from: number; // hit window start / end (seconds into the swing)
  to: number;
  dmg: number; // multiplier over stats.damage
  reach: number;
  kb: number; // knockback multiplier
  swing: [number, number]; // sword arm angle at start / end of the swing
  lunge: number; // forward push when the swing starts
  shake: number;
}

// 3-hit combo: two quick slashes, then a heavy finisher.
const STAGES: Stage[] = [
  { dur: 0.32, from: 0.08, to: 0.2, dmg: 1, reach: 2.0, kb: 1, swing: [-2.2, 1.5], lunge: 3, shake: 0 },
  { dur: 0.32, from: 0.08, to: 0.2, dmg: 1, reach: 2.1, kb: 1, swing: [-0.8, 2.4], lunge: 3, shake: 0 },
  { dur: 0.5, from: 0.18, to: 0.3, dmg: 1.6, reach: 2.3, kb: 1.8, swing: [-2.8, 1.6], lunge: 5, shake: 0.18 },
];

const JUMP = 15;
const DODGE_TIME = 0.28;
const DODGE_COST = 25;
const BLOCK_COST = 20;

const box = (w: number, h: number, d: number, color: number, emissive = 0) =>
  new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.9, emissive, emissiveIntensity: emissive ? 0.8 : 0 }),
  );

export class Player {
  body: Body = { x: 0, y: 0.5, vx: 0, vy: 0, w: 0.8, h: 1.7, onGround: false };
  facing = 1;
  stats: Stats = { ...BASE_STATS };
  hp = BASE_STATS.maxHp;
  stamina = BASE_STATS.maxStamina;
  arrows = BASE_STATS.maxArrows;
  state: State = 'free';
  group = new THREE.Group();

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

  private model = new THREE.Group();
  private legL = new THREE.Group();
  private legR = new THREE.Group();
  private swordArm = new THREE.Group();
  private shield = new THREE.Group();

  constructor() {
    const torso = box(0.7, 0.8, 0.45, 0x8a8f9c);
    torso.position.y = 1.0;
    const head = box(0.5, 0.5, 0.5, 0xe0b48c);
    head.position.y = 1.7;
    const helm = box(0.56, 0.28, 0.56, 0x6c7280);
    helm.position.y = 1.88;
    const plume = box(0.12, 0.3, 0.12, 0xc0392b);
    plume.position.y = 2.15;

    for (const [leg, z] of [[this.legL, 0.15], [this.legR, -0.15]] as const) {
      leg.position.set(0, 0.62, z);
      const m = box(0.26, 0.62, 0.26, 0x4a3b2e);
      m.position.y = -0.31;
      leg.add(m);
    }

    this.swordArm.position.set(0.1, 1.3, -0.3);
    const arm = box(0.2, 0.6, 0.2, 0x8a8f9c);
    arm.position.y = -0.3;
    const blade = box(0.12, 1.1, 0.06, 0xdfe6ee, 0x223344);
    blade.position.y = -1.15;
    const guard = box(0.4, 0.1, 0.12, 0x8a6d3b);
    guard.position.y = -0.62;
    this.swordArm.add(arm, guard, blade);

    this.shield.position.set(-0.05, 1.05, 0.38);
    const plate = box(0.1, 0.8, 0.6, 0x6b3f2a);
    const rim = box(0.14, 0.2, 0.2, 0xc9a24b);
    this.shield.add(plate, rim);

    this.model.add(torso, head, helm, plume, this.legL, this.legR, this.swordArm, this.shield);
    this.group.add(this.model);
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
        if (this.t > st.to && this.tryDodge(inp)) break;
        if (this.t >= st.dur) {
          if (this.queued && this.stage < STAGES.length - 1) this.startAttack(this.stage + 1, inp);
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

    this.animate(inp);
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
        b.vy = JUMP;
        this.jumpBuf = 0;
        this.coyote = 0;
      } else if (this.airJumpsLeft > 0) {
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
        this.startAttack(0, inp);
      }
      return;
    }
    if (this.tryDodge(inp)) return;
    if (inp.pressed.ranged && this.rangedCd <= 0 && this.arrows > 0) {
      this.rangedCd = 0.7;
      this.arrows--;
      g.spawnBolt(b.x + this.facing * 0.6, b.y + 1.2, this.facing);
    }
  }

  private tryDodge(inp: Input) {
    if (!inp.pressed.dodge || this.stamina < DODGE_COST) return false;
    if (inp.moveX !== 0) this.facing = sign(inp.moveX);
    this.stamina -= DODGE_COST;
    this.invuln = Math.max(this.invuln, DODGE_TIME + 0.08);
    this.stage = 0;
    this.setState('dodge');
    this.body.vy = Math.max(this.body.vy, 0);
    return true;
  }

  private startAttack(stage: number, inp: Input) {
    this.stage = stage;
    this.setState('attack');
    this.queued = false;
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

  takeDamage(amount: number, srcX: number, g: Game, attacker?: Enemy) {
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
        return;
      }
      this.stamina -= BLOCK_COST;
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

  private animate(inp: Input) {
    const b = this.body;
    const targetRot = this.facing > 0 ? 0 : Math.PI;
    this.model.rotation.y += (targetRot - this.model.rotation.y) * 0.35;
    this.group.position.set(b.x, b.y, 0);

    // blink while invulnerable (except dodge, which gets a ghost look)
    this.model.visible = this.invuln <= 0 || this.state === 'dodge' || Math.floor(this.t * 20 + this.invuln * 20) % 2 === 0;

    const speed = Math.abs(b.vx) / this.stats.runSpeed;
    const swing = b.onGround ? Math.sin(performance.now() / 70) * speed * 0.9 : 0.5;
    this.legL.rotation.z = swing;
    this.legR.rotation.z = -swing;

    let sword = 0.35;
    if (this.state === 'attack') {
      const st = STAGES[this.stage];
      const p = Math.min(1, this.t / (st.dur * 0.6));
      const e = 1 - (1 - p) * (1 - p);
      sword = st.swing[0] + (st.swing[1] - st.swing[0]) * e;
    } else if (this.state === 'plunge') {
      sword = 0;
    }
    this.swordArm.rotation.z = sword;

    const blocking = this.state === 'block' || (inp.held.block && this.state === 'free');
    this.shield.position.x = blocking ? 0.55 : -0.05;
    this.shield.position.z = blocking ? 0.0 : 0.38;
    this.model.position.y = this.state === 'dodge' ? -0.25 : 0;
    this.model.rotation.z = this.state === 'dodge' ? -0.5 : 0;
    this.group.rotation.z = this.state === 'dead' ? (-Math.PI / 2) * this.facing : 0;
  }
}

export class Bolt {
  mesh = box(0.5, 0.12, 0.12, 0xfff2a8, 0xffd447);
  x: number;
  y: number;
  vx: number;
  life = 1.3;
  dead = false;

  constructor(x: number, y: number, dir: number) {
    this.x = x;
    this.y = y;
    this.vx = dir * 16;
    this.mesh.position.set(x, y, 0);
  }

  update(dt: number, g: Game) {
    this.x += this.vx * dt;
    this.life -= dt;
    this.mesh.position.x = this.x;
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
