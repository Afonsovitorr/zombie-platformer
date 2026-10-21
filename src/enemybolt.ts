import * as THREE from 'three';
import type { Game } from './game';
import { sign } from './physics';

export type BoltKind = 'arrow' | 'wave';

const arrowMat = new THREE.MeshStandardMaterial({ color: 0xd8d2c0, emissive: 0x554433, flatShading: true });
const waveMat = new THREE.MeshStandardMaterial({ color: 0xb06cff, emissive: 0x7a2cff, emissiveIntensity: 0.9, flatShading: true });

// Hostile projectile. Arrows fly straight; waves travel along the ground and must be jumped over.
export class EnemyBolt {
  mesh: THREE.Mesh;
  dead = false;
  private life: number;

  constructor(readonly kind: BoltKind, public x: number, public y: number, private vx: number, private vy: number, private dmg: number) {
    this.mesh =
      kind === 'arrow'
        ? new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.07, 0.07), arrowMat)
        : new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.1, 5), waveMat);
    if (kind === 'wave') this.mesh.rotation.z = -Math.PI / 2 * sign(vx);
    this.mesh.position.set(x, y, 0);
    this.life = kind === 'arrow' ? 2.5 : 3.5;
  }

  update(dt: number, g: Game) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.life -= dt;
    this.mesh.position.set(this.x, this.y, 0);
    if (this.kind === 'arrow') this.mesh.rotation.z = Math.atan2(this.vy, this.vx);
    if (this.life <= 0) this.dead = true;

    if (this.kind === 'arrow') {
      for (const s of g.level.solids) {
        if (this.x > s.x0 && this.x < s.x1 && this.y > s.y0 && this.y < s.y1) this.dead = true;
      }
    }

    const p = g.player.body;
    const hit = Math.abs(this.x - p.x) < p.w / 2 + 0.3 && this.y > p.y - 0.2 && this.y < p.y + p.h;
    // a wave rolls along the floor, so a player who is airborne passes over it
    const clears = this.kind === 'wave' && p.y > this.y + 0.5;
    if (hit && !clears && !this.dead) {
      this.dead = true;
      g.player.takeDamage(this.dmg, this.x - sign(this.vx) * 0.5, g);
    }
  }
}
