import * as THREE from 'three';
import { Body, moveBody, sign } from './physics';
import type { Game } from './game';
import type { EnemyDef } from './data/enemies';

type State = 'idle' | 'chase' | 'windup' | 'attack' | 'recover' | 'hurt' | 'dead';

const box = (w: number, h: number, d: number, color: number) =>
  new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 1 }));

export class Enemy {
  body: Body;
  hp: number;
  facing = -1;
  group = new THREE.Group();
  remove = false;

  private state: State = 'idle';
  private t = 0;
  private struck = false;
  private model = new THREE.Group();
  private arms = new THREE.Group();
  private skin: THREE.MeshStandardMaterial;

  constructor(readonly def: EnemyDef, x: number) {
    this.hp = def.hp;
    this.body = { x, y: 1, vx: 0, vy: 0, w: def.w, h: def.h, onGround: false };
    this.skin = new THREE.MeshStandardMaterial({ color: def.skin, flatShading: true, roughness: 1 });

    const torso = box(0.75, 0.9, 0.45, def.cloth);
    torso.position.y = 1.05;
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), this.skin);
    head.position.set(0.1, 1.75, 0);
    const eye = box(0.08, 0.08, 0.52, 0xff3b30);
    eye.position.set(0.28, 1.8, 0);
    const legs = box(0.6, 0.65, 0.4, 0x3b3a30);
    legs.position.y = 0.33;
    this.arms.position.set(0.2, 1.4, 0);
    const armL = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.18, 0.18), this.skin);
    armL.position.set(0.4, 0, 0.25);
    const armR = armL.clone();
    armR.position.z = -0.25;
    this.arms.add(armL, armR);
    this.model.add(torso, head, eye, legs, this.arms);
    this.model.scale.setScalar(def.scale);
    this.group.add(this.model);
  }

  get dead() {
    return this.state === 'dead';
  }

  hurt(dmg: number, dir: number, g: Game) {
    if (this.dead) return;
    this.hp -= dmg;
    g.hitStop = 0.06;
    const heavy = this.def.scale > 1.2 ? 0.4 : 1;
    this.body.vx = dir * 6 * heavy;
    this.body.vy = 4 * heavy;
    this.go(this.hp <= 0 ? 'dead' : 'hurt');
    this.skin.emissive.setHex(0xffffff);
    if (this.hp <= 0) g.addSouls(this.def.souls);
  }

  update(dt: number, g: Game) {
    const b = this.body;
    const p = g.player;
    const d = this.def;
    this.t += dt;
    const dx = p.body.x - b.x;
    const dy = p.body.y - b.y;
    const near = Math.abs(dx) < d.detect && Math.abs(dy) < 3.5 && p.alive;
    this.skin.emissive.lerp(new THREE.Color(0), 0.3);

    switch (this.state) {
      case 'idle':
        b.vx = 0;
        if (near) this.go('chase');
        break;
      case 'chase':
        this.facing = sign(dx);
        b.vx = this.facing * d.speed;
        if (!near && Math.abs(dx) > d.detect + 4) this.go('idle');
        else if (Math.abs(dx) < d.reach && Math.abs(dy) < 1.5 && p.alive) this.go('windup');
        break;
      case 'windup':
        b.vx = 0;
        this.skin.emissive.setHex(0x661111);
        if (this.t > d.windup) this.go('attack');
        break;
      case 'attack':
        b.vx = this.facing;
        if (!this.struck) {
          this.struck = true;
          if (Math.abs(dx) < d.reach + 0.5 && Math.abs(dy) < d.h * 0.85 && dx * this.facing > -0.3) {
            p.takeDamage(d.damage, b.x, g);
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
      case 'dead':
        b.vx *= 0.9;
        if (this.t > 1.2) this.remove = true;
        break;
    }

    moveBody(b, dt, g.level.solids);
    if (b.y < -20) this.remove = true;

    this.group.position.set(b.x, b.y, 0);
    const targetRot = this.facing > 0 ? 0 : Math.PI;
    this.model.rotation.y += (targetRot - this.model.rotation.y) * 0.3;
    const lean = this.state === 'windup' ? -0.35 : this.state === 'attack' ? 0.3 : 0;
    this.model.rotation.z += (lean - this.model.rotation.z) * 0.4;
    this.arms.rotation.z = this.state === 'windup' ? 0.9 : this.state === 'attack' ? -0.5 : Math.sin(this.t * 6) * 0.08;
    if (this.state === 'dead') {
      this.group.rotation.z = Math.min(this.t * 6, 1.5) * -this.facing;
      this.group.position.y -= Math.min(this.t * 2, 0.5) * 0.5;
    }
  }

  private go(s: State) {
    this.state = s;
    this.t = 0;
    this.struck = false;
  }
}
