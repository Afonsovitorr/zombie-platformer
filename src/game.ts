import * as THREE from 'three';
import { Input } from './input';
import { Hud } from './hud';
import { Player, Bolt } from './player';
import { Zombie } from './enemy';
import { buildLevel, Level } from './level';

const STEP = 1 / 60;

export class Game {
  level: Level = buildLevel();
  player = new Player();
  zombies: Zombie[] = [];
  bolts: Bolt[] = [];
  hitStop = 0;

  private renderer = new THREE.WebGLRenderer({ antialias: true });
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(40, 1, 0.1, 300);
  private input = new Input(document.getElementById('touch')!);
  private hud = new Hud();
  private acc = 0;
  private last = performance.now();
  private won = false;

  constructor() {
    document.body.prepend(this.renderer.domElement);
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));

    const sky = new THREE.Color(0x14102a);
    this.scene.background = sky;
    this.scene.fog = new THREE.Fog(sky, 25, 70);
    this.scene.add(new THREE.HemisphereLight(0x8c9bd6, 0x2a1f33, 1.1));
    const moonLight = new THREE.DirectionalLight(0xdfe6ff, 1.6);
    moonLight.position.set(-6, 12, 10);
    this.scene.add(moonLight);

    this.scene.add(this.level.group, this.player.group);
    addEventListener('resize', () => this.resize());
    this.resize();
    this.reset();
    requestAnimationFrame(() => this.frame());
  }

  spawnBolt(x: number, y: number, dir: number) {
    const bolt = new Bolt(x, y, dir);
    this.bolts.push(bolt);
    this.scene.add(bolt.mesh);
  }

  private reset() {
    for (const z of this.zombies) this.scene.remove(z.group);
    for (const b of this.bolts) this.scene.remove(b.mesh);
    this.bolts = [];
    this.zombies = this.level.spawns.map((x) => {
      const z = new Zombie(x);
      this.scene.add(z.group);
      return z;
    });
    this.player.group.rotation.set(0, 0, 0);
    this.player.reset(0);
    this.won = false;
    this.hud.message(null);
    this.camera.position.set(0, 4, 14);
  }

  private resize() {
    this.renderer.setSize(innerWidth, innerHeight, false);
    this.camera.aspect = innerWidth / innerHeight;
    // keep roughly the same horizontal view on portrait / narrow screens
    this.camera.fov = this.camera.aspect < 1.4 ? 52 : 40;
    this.camera.updateProjectionMatrix();
  }

  private step(dt: number) {
    this.input.update();
    if (this.input.pressed.restart || ((!this.player.alive || this.won) && this.input.pressed.attack)) {
      this.reset();
      return;
    }
    if (this.hitStop > 0) {
      this.hitStop -= dt;
      return;
    }

    this.player.update(dt, this.input, this);
    for (const z of this.zombies) z.update(dt, this);
    for (const b of this.bolts) b.update(dt, this);

    this.zombies = this.zombies.filter((z) => {
      if (z.remove) this.scene.remove(z.group);
      return !z.remove;
    });
    this.bolts = this.bolts.filter((b) => {
      if (b.dead) this.scene.remove(b.mesh);
      return !b.dead;
    });

    if (!this.won && this.player.alive && this.player.body.x > this.level.goalX) {
      this.won = true;
      this.hud.message('Fim da demo da Fase 1', 'Atacar ou R para jogar de novo');
    }
    if (!this.player.alive) this.hud.message('Você caiu...', 'Atacar ou R para tentar de novo');
  }

  private frame() {
    requestAnimationFrame(() => this.frame());
    const now = performance.now();
    const frameDt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;

    this.acc += frameDt;
    while (this.acc >= STEP) {
      this.step(STEP);
      this.acc -= STEP;
    }

    const p = this.player.body;
    const cam = this.camera;
    const tx = p.x + this.player.facing * 2.5;
    const ty = 3.6 + Math.max(0, p.y) * 0.55;
    const k = 1 - Math.exp(-5 * frameDt);
    cam.position.x += (tx - cam.position.x) * k;
    cam.position.y += (ty - cam.position.y) * k;
    cam.position.z = 14;
    cam.lookAt(cam.position.x, cam.position.y - 1.4, 0);

    this.hud.set(this.player.hp, this.player.maxHp, this.player.stamina, this.player.maxStamina);
    this.renderer.render(this.scene, cam);
  }
}
