import { Application, Container } from 'pixi.js';
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
import { Fx } from './fx';
import { U } from './gfx';
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
  fx = new Fx();

  private mode: Mode = 'menu';
  private world = new Container();
  private foes = new Container();
  private shots = new Container();
  private cam = { x: 0, y: 3, zoom: 1, view: 11 };
  private input = new Input(document.getElementById('touch')!);
  private hud = new Hud();
  private menu = new Menu();
  private boss: Boss | null = null;
  private bossLocked = false;
  private acc = 0;
  private last = performance.now();
  private won = false;

  constructor(private app: Application) {
    if (import.meta.env.DEV) (window as unknown as { __game: Game }).__game = this; // debug hook for screenshots
    this.save.load();

    document.body.prepend(app.canvas);
    app.stage.addChild(this.world);
    this.world.addChild(this.foes, this.player.view, this.shots, this.fx.layer);

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
    if (this.level) {
      this.world.removeChild(this.level.back);
      this.app.stage.removeChild(this.level.sky);
      this.level.back.destroy({ children: true });
      this.level.sky.destroy();
    }
    this.save.data.level = index;
    this.level = buildLevel(LEVELS[index]);
    this.app.stage.addChildAt(this.level.sky, 0);
    this.world.addChildAt(this.level.back, 0);
    this.level.resizeSky(innerWidth, innerHeight);
    this.level.light(this.save.data.checkpointX);
  }

  spawnBolt(x: number, y: number, dir: number) {
    const bolt = new Bolt(x, y, dir);
    this.bolts.push(bolt);
    this.shots.addChild(bolt.view);
  }

  spawnEnemyBolt(kind: BoltKind, x: number, y: number, vx: number, vy: number, dmg: number) {
    const bolt = new EnemyBolt(kind, x, y, vx, vy, dmg);
    this.enemyBolts.push(bolt);
    this.shots.addChild(bolt.view);
  }

  // Summoned enemies rise from the ground and give no souls.
  spawnEnemy(type: string, x: number, y: number, owner?: Foe) {
    const e = new Enemy(ENEMIES[type], x, y, !!owner, owner);
    this.enemies.push(e);
    this.foes.addChild(e.view);
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
    this.fx.ring(this.player.body.x, this.player.body.y + 1.2, 0xffd447, 60);
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
    for (const m of this.level.arenaGfx) m.visible = true;
    this.boss?.activate();
    this.toast('O Carniçal Rei desperta!');
  }

  private unlockArena() {
    this.bossLocked = false;
    for (const w of this.level.arenaWalls) {
      const i = this.level.solids.indexOf(w);
      if (i >= 0) this.level.solids.splice(i, 1);
    }
    for (const m of this.level.arenaGfx) m.visible = false;
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
    for (const e of this.enemies) e.view.destroy({ children: true });
    for (const b of this.bolts) b.view.destroy();
    for (const b of this.enemyBolts) b.view.destroy();
    this.fx.clear();
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
    for (const e of foes) this.foes.addChild(e.view);
    this.hud.setBoss(null, 0);

    this.player.reset(startX, statsFor(this.save.data.skills));
    this.won = false;
    this.hud.message(null);
    this.cam.x = startX;
    this.cam.y = 3;
    this.level.light(this.save.data.checkpointX);
  }

  private resize() {
    this.app.renderer.resize(innerWidth, innerHeight);
    this.level.resizeSky(innerWidth, innerHeight);
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
      this.level.light(x);
      this.fx.ring(x, 1, 0xffa040, 50);
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
      if (e.remove) e.view.destroy({ children: true });
      return !e.remove;
    });
    this.bolts = this.bolts.filter((b) => {
      if (b.dead) b.view.destroy();
      return !b.dead;
    });
    this.enemyBolts = this.enemyBolts.filter((b) => {
      if (b.dead) b.view.destroy();
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

  private updateCamera(dt: number) {
    const p = this.player.body;
    const c = this.cam;
    const k = 1 - Math.exp(-5 * dt);
    c.x += (p.x + this.player.facing * 2.5 - c.x) * k;
    c.y += (2.4 + Math.max(0, p.y) * 0.55 - c.y) * k;
    // frame the arena a little wider during the boss fight; show more on narrow screens
    const wantView = Math.max(this.bossLocked ? 13.5 : 11, 15 / (innerWidth / innerHeight));
    c.view += (wantView - c.view) * (1 - Math.exp(-3 * dt));
    c.zoom = innerHeight / (c.view * U);
    let sx = 0;
    let sy = 0;
    if (this.shake > 0.001) {
      sx = (Math.random() - 0.5) * this.shake;
      sy = (Math.random() - 0.5) * this.shake;
      this.shake *= Math.exp(-9 * dt);
    }
    this.world.scale.set(c.zoom);
    this.world.position.set(innerWidth / 2 - (c.x + sx) * U * c.zoom, innerHeight / 2 + (c.y + sy) * U * c.zoom);
    this.level.update(c.x, c.y, dt);
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

    this.fx.update(frameDt);
    this.updateCamera(frameDt);
    this.hud.set(this.player.hp, this.player.maxHp, this.player.stamina, this.player.maxStamina, this.save.data.souls, this.player.arrows);
    this.app.render();
  }
}
