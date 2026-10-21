import * as THREE from 'three';
import { Input } from './input';
import { Hud } from './hud';
import { Menu } from './menu';
import { Save } from './save';
import { Player, Bolt } from './player';
import { Enemy } from './enemy';
import { buildLevel, Level } from './level';
import { LEVELS } from './data/levels';
import { ENEMIES } from './data/enemies';
import type { EnemyDef } from './data/enemies';
import { GameAudio } from './audio';
import { BRANCH_NAMES, SKILLS, statsFor } from './data/skills';

const STEP = 1 / 60;
const SAFE_SPAWN_GAP = 5; // enemies this close to the respawn point are skipped

type Mode = 'menu' | 'play' | 'pause';

export class Game {
  save = new Save();
  level: Level;
  player = new Player();
  enemies: Enemy[] = [];
  bolts: Bolt[] = [];
  hitStop = 0;
  shake = 0; // camera shake intensity, decays every frame
  audio = new GameAudio();

  private mode: Mode = 'menu';
  private renderer = new THREE.WebGLRenderer({ antialias: true });
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(40, 1, 0.1, 300);
  private input = new Input(document.getElementById('touch')!);
  private hud = new Hud();
  private menu = new Menu();
  private flames: THREE.Object3D[] = [];
  private acc = 0;
  private last = performance.now();
  private won = false;

  constructor() {
    if (import.meta.env.DEV) (window as unknown as { __game: Game }).__game = this; // debug hook for screenshots
    this.save.load();
    this.level = buildLevel(LEVELS[this.save.data.level] ?? LEVELS[0]);
    this.flames = this.level.group.children.filter((c) => c.name === 'flame');

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
    for (const ev of ['pointerdown', 'keydown'] as const) addEventListener(ev, () => this.audio.unlock());
    addEventListener('resize', () => this.resize());
    this.resize();
    this.reset();
    this.showMainMenu();
    requestAnimationFrame(() => this.frame());
  }

  spawnBolt(x: number, y: number, dir: number) {
    const bolt = new Bolt(x, y, dir);
    this.bolts.push(bolt);
    this.scene.add(bolt.mesh);
  }

  addSouls(n: number) {
    this.save.data.souls += n;
    this.save.persist();
  }

  toast(text: string) {
    this.hud.toast(text);
  }

  onKill(def: EnemyDef) {
    this.addSouls(def.souls);
    if (Math.random() < 0.5) this.player.arrows = Math.min(this.player.stats.maxArrows, this.player.arrows + 1);
  }

  private showMainMenu() {
    this.mode = 'menu';
    this.hud.message(null);
    const d = this.save.data;
    const hasProgress = d.checkpointX !== null || d.souls > 0 || d.skills.length > 0;
    const buttons = [];
    if (hasProgress) buttons.push({ label: 'Continuar', run: () => this.start() });
    buttons.push({
      label: hasProgress ? 'Novo jogo' : 'Jogar',
      run: () => {
        this.save.clear();
        this.start();
      },
    });
    this.menu.show('Zombie Platformer', buttons, 'Protótipo · Cemitério da Vila');
  }

  private start() {
    this.menu.hide();
    this.mode = 'play';
    this.reset();
  }

  private togglePause() {
    if (this.mode === 'play') {
      this.mode = 'pause';
      this.showPause();
    } else if (this.mode === 'pause') {
      this.mode = 'play';
      this.menu.hide();
    }
  }

  private showPause() {
    this.menu.show('Pausado', [
      { label: 'Continuar', run: () => this.togglePause() },
      { label: 'Habilidades', run: () => this.showSkills() },
      {
        label: this.audio.muted ? 'Som: desligado' : 'Som: ligado',
        run: () => {
          this.audio.toggleMute();
          this.showPause();
        },
      },
      { label: 'Menu principal', run: () => this.showMainMenu() },
    ]);
  }

  private showSkills() {
    const owned = this.save.data.skills;
    const buttons = SKILLS.map((s) => {
      const has = owned.includes(s.id);
      const locked = !!s.requires && !owned.includes(s.requires);
      const afford = this.save.data.souls >= s.cost;
      const status = has ? '✓' : locked ? '🔒' : `${s.cost} almas`;
      return {
        label: `[${BRANCH_NAMES[s.branch]}] ${s.name}: ${s.desc} · ${status}`,
        disabled: has || locked || !afford,
        run: () => {
          this.save.data.souls -= s.cost;
          this.save.data.skills.push(s.id);
          this.save.persist();
          this.player.setStats(statsFor(this.save.data.skills));
          this.showSkills();
        },
      };
    });
    buttons.push({ label: 'Voltar', disabled: false, run: () => this.showPause() });
    this.menu.show('Habilidades', buttons, `Almas: ${this.save.data.souls}`);
  }

  private reset() {
    for (const e of this.enemies) this.scene.remove(e.group);
    for (const b of this.bolts) this.scene.remove(b.mesh);
    this.bolts = [];

    const startX = this.save.data.checkpointX ?? 0;
    this.enemies = this.level.def.spawns
      .filter((s) => Math.abs(s.x - startX) > SAFE_SPAWN_GAP)
      .map((s) => {
        const e = new Enemy(ENEMIES[s.type], s.x);
        this.scene.add(e.group);
        return e;
      });

    this.player.group.rotation.set(0, 0, 0);
    this.player.reset(startX, statsFor(this.save.data.skills));
    this.won = false;
    this.hud.message(null);
    this.camera.position.set(startX, 4, 12);
  }

  private resize() {
    this.renderer.setSize(innerWidth, innerHeight, false);
    this.camera.aspect = innerWidth / innerHeight;
    // keep roughly the same horizontal view on portrait / narrow screens
    this.camera.fov = this.camera.aspect < 1.4 ? 52 : 40;
    this.camera.updateProjectionMatrix();
  }

  private checkpoints() {
    const p = this.player.body;
    for (const x of this.level.def.checkpoints) {
      if (Math.abs(p.x - x) > 1.5 || !p.onGround || this.save.data.checkpointX === x) continue;
      this.save.data.checkpointX = x;
      this.save.persist();
      this.player.hp = this.player.maxHp;
      this.player.stamina = this.player.maxStamina;
      this.player.arrows = this.player.stats.maxArrows;
      this.audio.play('fire');
      this.hud.toast('Fogueira acesa · vida restaurada');
    }
  }

  private step(dt: number) {
    this.input.update();
    if (this.input.pressed.mute) this.toast(this.audio.toggleMute() ? 'Som desligado' : 'Som ligado');
    if (this.mode === 'menu') return;

    if (this.input.pressed.pause) this.togglePause();
    if (this.mode === 'pause') return;

    if (this.input.pressed.restart || ((!this.player.alive || this.won) && this.input.pressed.attack)) {
      if (this.won) this.save.data.checkpointX = null;
      this.reset();
      return;
    }
    if (this.hitStop > 0) {
      this.hitStop -= dt;
      return;
    }

    this.player.update(dt, this.input, this);
    for (const e of this.enemies) e.update(dt, this);
    for (const b of this.bolts) b.update(dt, this);

    this.enemies = this.enemies.filter((e) => {
      if (e.remove) this.scene.remove(e.group);
      return !e.remove;
    });
    this.bolts = this.bolts.filter((b) => {
      if (b.dead) this.scene.remove(b.mesh);
      return !b.dead;
    });

    this.checkpoints();

    if (!this.won && this.player.alive && this.player.body.x > this.level.def.goalX) {
      this.won = true;
      this.mode = 'menu';
      this.menu.show(
        'Fim da demo da Fase 1',
        [
          {
            label: 'Jogar de novo',
            run: () => {
              this.save.data.checkpointX = null;
              this.save.persist();
              this.start();
            },
          },
          { label: 'Menu principal', run: () => this.showMainMenu() },
        ],
        `${this.level.def.name} concluído`,
      );
    }
    if (!this.player.alive) this.hud.message('Você caiu...', 'Atacar ou R para voltar à última fogueira');
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
    cam.position.z = 12;
    cam.lookAt(cam.position.x, cam.position.y - 1.4, 0);
    if (this.shake > 0.001) {
      cam.position.x += (Math.random() - 0.5) * this.shake;
      cam.position.y += (Math.random() - 0.5) * this.shake;
      this.shake *= Math.exp(-9 * frameDt);
    }

    const pulse = 1 + Math.sin(now / 90) * 0.12;
    for (const f of this.flames) f.scale.set(pulse, 1 + (pulse - 1) * 2, pulse);

    this.hud.set(this.player.hp, this.player.maxHp, this.player.stamina, this.player.maxStamina, this.save.data.souls, this.player.arrows);
    this.renderer.render(this.scene, cam);
  }
}
