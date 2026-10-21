import * as THREE from 'three';
import { Input } from './input';
import { Hud } from './hud';
import { Menu } from './menu';
import { Save } from './save';
import { Player, Bolt } from './player';
import { Enemy } from './enemy';
import { Boss } from './boss';
import { EnemyBolt, BoltKind } from './enemybolt';
import type { Foe } from './foe';
import { buildLevel, Level } from './level';
import { LEVELS } from './data/levels';
import { ENEMIES } from './data/enemies';
import type { EnemyDef } from './data/enemies';
import { GameAudio } from './audio';
import { BRANCH_NAMES, SKILLS, statsFor } from './data/skills';

const STEP = 1 / 60;
const SAFE_SPAWN_GAP = 5; // enemies this close to the respawn point are skipped
const BOSS_REWARD_SKILL = 'hunter_3';

type Mode = 'menu' | 'play' | 'pause';

export class Game {
  save = new Save();
  level!: Level;
  player = new Player();
  enemies: Foe[] = [];
  bolts: Bolt[] = [];
  enemyBolts: EnemyBolt[] = [];
  hitStop = 0;
  shake = 0; // camera shake intensity, decays every frame
  audio = new GameAudio();

  private mode: Mode = 'menu';
  private renderer = new THREE.WebGLRenderer({ antialias: true });
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(40, 1, 0.1, 900);
  private sun = new THREE.DirectionalLight(0xffffff, 2.4);
  private hemi = new THREE.HemisphereLight(0xffffff, 0x000000, 1.0);
  private input = new Input(document.getElementById('touch')!);
  private hud = new Hud();
  private menu = new Menu();
  private flames: THREE.Object3D[] = [];
  private boss: Boss | null = null;
  private bossLocked = false;
  private acc = 0;
  private last = performance.now();
  private won = false;

  constructor() {
    if (import.meta.env.DEV) (window as unknown as { __game: Game }).__game = this; // debug hook for screenshots
    this.save.load();

    document.body.prepend(this.renderer.domElement);
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));

    this.scene.add(this.hemi);
    const moonLight = this.sun;
    moonLight.position.set(-6, 12, 10);
    this.scene.add(moonLight, this.player.group);

    this.loadLevel(Math.min(this.save.data.level, LEVELS.length - 1));

    for (const ev of ['pointerdown', 'keydown'] as const) addEventListener(ev, () => this.audio.unlock());
    addEventListener('resize', () => this.resize());
    this.resize();
    this.reset();
    this.showMainMenu();
    requestAnimationFrame(() => this.frame());
  }

  // ---- world ------------------------------------------------------------------------------

  private loadLevel(index: number) {
    if (this.level) this.scene.remove(this.level.group);
    this.save.data.level = index;
    this.level = buildLevel(LEVELS[index]);
    this.scene.add(this.level.group);
    this.flames = this.level.group.children.filter((c) => c.name === 'flame');

    const th = this.level.theme;
    const sky = new THREE.Color(th.sky);
    this.scene.background = sky;
    this.scene.fog = new THREE.Fog(sky, th.fog[0], th.fog[1]);
    this.sun.color.setHex(th.sun);
    this.hemi.color.setHex(th.hemi[0]);
    this.hemi.groundColor.setHex(th.hemi[1]);
  }

  spawnBolt(x: number, y: number, dir: number) {
    const bolt = new Bolt(x, y, dir);
    this.bolts.push(bolt);
    this.scene.add(bolt.mesh);
  }

  spawnEnemyBolt(kind: BoltKind, x: number, y: number, vx: number, vy: number, dmg: number) {
    const bolt = new EnemyBolt(kind, x, y, vx, vy, dmg);
    this.enemyBolts.push(bolt);
    this.scene.add(bolt.mesh);
  }

  // Summoned enemies rise from the ground and give no souls.
  spawnEnemy(type: string, x: number, y: number, owner?: Foe) {
    const e = new Enemy(ENEMIES[type], x, y, !!owner, owner);
    this.enemies.push(e);
    this.scene.add(e.group);
    return e;
  }

  clampToArena(x: number) {
    const a = this.level.def.boss?.arena;
    return a ? Math.min(a[1] - 1.5, Math.max(a[0] + 1.5, x)) : x;
  }

  addSouls(n: number) {
    this.save.data.souls += n;
    this.save.persist();
  }

  toast(text: string) {
    this.hud.toast(text);
  }

  onKill(def: EnemyDef, summoned: boolean) {
    if (!summoned) this.addSouls(def.souls);
    if (Math.random() < 0.5) this.player.arrows = Math.min(this.player.stats.maxArrows, this.player.arrows + 1);
  }

  onBossDefeated(def: EnemyDef) {
    this.addSouls(def.souls);
    this.unlockArena();
    this.level.goal.visible = true;
    this.hud.setBoss(null, 0);
    if (!this.save.data.skills.includes(BOSS_REWARD_SKILL)) {
      this.save.data.skills.push(BOSS_REWARD_SKILL);
      this.save.persist();
      this.player.setStats(statsFor(this.save.data.skills));
      this.toast('Carniçal Rei derrotado! Pulo duplo conquistado');
    } else {
      this.toast('Carniçal Rei derrotado!');
    }
  }

  private lockArena() {
    this.bossLocked = true;
    this.level.solids.push(...this.level.arenaWalls);
    for (const m of this.level.arenaMeshes) m.visible = true;
    this.boss?.activate();
    this.toast('O Carniçal Rei desperta!');
  }

  private unlockArena() {
    this.bossLocked = false;
    for (const w of this.level.arenaWalls) {
      const i = this.level.solids.indexOf(w);
      if (i >= 0) this.level.solids.splice(i, 1);
    }
    for (const m of this.level.arenaMeshes) m.visible = false;
  }

  // ---- menus ------------------------------------------------------------------------------

  private showMainMenu() {
    this.mode = 'menu';
    this.hud.message(null);
    const d = this.save.data;
    const hasProgress = d.checkpointX !== null || d.souls > 0 || d.skills.length > 0 || d.level > 0;
    const buttons = [];
    if (hasProgress) buttons.push({ label: 'Continuar', run: () => this.start() });
    buttons.push({
      label: hasProgress ? 'Novo jogo' : 'Jogar',
      run: () => {
        this.save.clear();
        this.start();
      },
    });
    this.menu.show('Zombie Platformer', buttons, 'Protótipo');
  }

  private start() {
    this.menu.hide();
    this.mode = 'play';
    if (this.level.def !== LEVELS[this.save.data.level]) this.loadLevel(this.save.data.level);
    this.reset();
    this.toast(this.level.def.name);
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
      const status = has ? '✓' : s.bossReward ? 'recompensa do chefe' : locked ? '🔒' : `${s.cost} almas`;
      return {
        label: `[${BRANCH_NAMES[s.branch]}] ${s.name}: ${s.desc} · ${status}`,
        disabled: has || locked || !afford || !!s.bossReward,
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

  private levelComplete() {
    this.won = true;
    this.mode = 'menu';
    const i = this.save.data.level;
    const last = i >= LEVELS.length - 1;
    this.save.data.checkpointX = null;
    if (last) {
      this.save.data.level = 0;
      this.save.persist();
      this.menu.show(
        'Fim da demo!',
        [
          { label: 'Jogar de novo', run: () => this.start() },
          { label: 'Menu principal', run: () => this.showMainMenu() },
        ],
        `Você derrotou o Carniçal Rei · Almas: ${this.save.data.souls}`,
      );
    } else {
      this.save.data.level = i + 1;
      this.save.persist();
      this.menu.show(
        `${this.level.def.name} concluída`,
        [
          { label: `Próxima fase: ${LEVELS[i + 1].name}`, run: () => this.start() },
          { label: 'Menu principal', run: () => this.showMainMenu() },
        ],
        `Almas: ${this.save.data.souls}`,
      );
    }
  }

  // ---- loop -------------------------------------------------------------------------------

  private reset() {
    for (const e of this.enemies) this.scene.remove(e.group);
    for (const b of this.bolts) this.scene.remove(b.mesh);
    for (const b of this.enemyBolts) this.scene.remove(b.mesh);
    this.bolts = [];
    this.enemyBolts = [];
    this.unlockArena();
    this.level.goal.visible = !this.level.def.boss;

    const startX = this.save.data.checkpointX ?? 0;
    const foes: Foe[] = this.level.def.spawns
      .filter((s) => Math.abs(s.x - startX) > SAFE_SPAWN_GAP)
      .map((s) => new Enemy(ENEMIES[s.type], s.x, s.y));

    this.boss = null;
    const b = this.level.def.boss;
    if (b) {
      this.boss = new Boss(ENEMIES[b.type], b.x);
      foes.push(this.boss);
    }
    this.enemies = foes;
    for (const e of foes) this.scene.add(e.group);
    this.hud.setBoss(null, 0);

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

    if (this.input.pressed.restart || (!this.player.alive && this.input.pressed.attack)) {
      this.reset();
      return;
    }
    if (this.hitStop > 0) {
      this.hitStop -= dt;
      return;
    }

    this.player.update(dt, this.input, this);
    for (const e of [...this.enemies]) e.update(dt, this);
    for (const b of this.bolts) b.update(dt, this);
    for (const b of this.enemyBolts) b.update(dt, this);

    this.enemies = this.enemies.filter((e) => {
      if (e.remove) this.scene.remove(e.group);
      return !e.remove;
    });
    this.bolts = this.bolts.filter((b) => {
      if (b.dead) this.scene.remove(b.mesh);
      return !b.dead;
    });
    this.enemyBolts = this.enemyBolts.filter((b) => {
      if (b.dead) this.scene.remove(b.mesh);
      return !b.dead;
    });

    this.checkpoints();

    const def = this.level.def;
    if (this.boss && !this.bossLocked && !this.boss.dead && this.player.alive && this.player.body.x > def.boss!.arena[0] + 4) {
      this.lockArena();
    }
    if (this.boss && this.bossLocked && !this.boss.dead) this.hud.setBoss(this.boss.def.name, this.boss.hp / this.boss.maxHp);

    if (!this.won && this.player.alive && this.level.goal.visible && this.player.body.x > def.goalX) this.levelComplete();
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
    cam.position.z = this.bossLocked ? 15 : 12; // pull back to frame the boss arena
    cam.lookAt(cam.position.x, cam.position.y - 1.4, 0);
    if (this.shake > 0.001) {
      cam.position.x += (Math.random() - 0.5) * this.shake;
      cam.position.y += (Math.random() - 0.5) * this.shake;
      this.shake *= Math.exp(-9 * frameDt);
    }

    for (const c of this.level.group.children) if (c.name === 'cloud') c.position.x += frameDt * 0.6;
    const pulse = 1 + Math.sin(now / 90) * 0.12;
    for (const f of this.flames) f.scale.set(pulse, 1 + (pulse - 1) * 2, pulse);

    this.hud.set(this.player.hp, this.player.maxHp, this.player.stamina, this.player.maxStamina, this.save.data.souls, this.player.arrows);
    this.renderer.render(this.scene, cam);
  }
}
