import { Application, Container } from 'pixi.js';
import { Input } from './input';
import { Hud } from './hud';
import { Menu } from './menu';
import { Save } from './save';
import { Player, Bolt } from './player';
import { Enemy } from './enemy';
import { Critter } from './critter';
import { Boss } from './boss';
import { Necromancer } from './necromancer';
import { DeadDragon } from './dragon';
import { EnemyBolt, BoltKind } from './enemybolt';
import type { Foe } from './foe';
import { buildLevel, Level, ChestObj } from './level';
import { LEVELS } from './data/levels';
import { ENEMIES } from './data/enemies';
import type { EnemyDef } from './data/enemies';
import { GameAudio } from './audio';
import { Fx } from './fx';
import { Npc } from './npc';
import { U } from './gfx';
import { BRANCH_NAMES, GEAR, SKILLS, statsFor } from './data/skills';

const STEP = 1 / 60;
const SAFE_SPAWN_GAP = 5; // enemies this close to the respawn point are skipped
const POTION_HEAL = 2;
const POTION_PRICE = 40;
const ARROWS_PRICE = 25;

type Mode = 'menu' | 'play' | 'pause' | 'shop';

const makeFoe = (def: EnemyDef, x: number, y: number, summoned = false, owner?: Foe): Foe =>
  def.monster ? new Critter(def, x, y, summoned, owner) : new Enemy(def, x, y, summoned, owner);

// Small deterministic hash so a chest always holds the same thing.
function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0) / 4294967296;
}

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
  private npcs: Npc[] = [];
  private cam = { x: 0, y: 3, zoom: 1, view: 11 };
  debug: { x: number; y: number; view: number } | null = null; // developer camera for screenshots
  private input = new Input(document.getElementById('touch')!);
  private hud = new Hud();
  private menu = new Menu();
  private boss: Foe | null = null;
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
    this.npcs = this.level.def.npcs.map((n) => new Npc(n));
    for (const n of this.npcs) this.level.back.addChild(n.view);
    this.level.light(this.save.data.checkpoint);
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
    const e = makeFoe(ENEMIES[type], x, y, !!owner, owner);
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
    const reward = SKILLS.find((s) => s.id === def.reward);
    if (reward && !this.save.data.skills.includes(reward.id)) {
      this.save.data.skills.push(reward.id);
      this.save.persist();
      this.refreshStats();
      this.toast(`${def.name} derrotado! ${reward.name}: ${reward.desc}`);
    } else {
      this.toast(`${def.name} derrotado!`);
    }
  }

  private refreshStats() {
    const d = this.save.data;
    this.player.setStats(statsFor(d.skills, d.gear, d.heartPieces));
  }

  private lockArena() {
    this.bossLocked = true;
    this.level.solids.push(...this.level.arenaWalls);
    for (const m of this.level.arenaGfx) m.visible = true;
    this.boss?.activate?.();
    this.toast(`${this.boss?.def.name} desperta!`);
  }

  private unlockArena() {
    this.bossLocked = false;
    for (const w of this.level.arenaWalls) {
      const i = this.level.solids.indexOf(w);
      if (i >= 0) this.level.solids.splice(i, 1);
    }
    for (const m of this.level.arenaGfx) m.visible = false;
  }

  // ---- breakables, chests and the merchant ----------------------------------------------------

  // Called when the hero's blade (or a plunge) sweeps an area: opens chests and breaks cracked walls.
  strike(x0: number, x1: number, y0: number, y1: number) {
    for (const c of this.level.chests) {
      if (c.opened) continue;
      if (c.def.x > x0 - 0.8 && c.def.x < x1 + 0.8 && c.def.y > y0 - 1 && c.def.y < y1) this.openChest(c);
    }
    for (const s of this.level.secrets) {
      if (s.broken) continue;
      const b = s.def.box;
      if (b.x1 > x0 && b.x0 < x1 && b.y1 > y0 && b.y0 < y1) {
        this.level.breakSecret(s.def.id);
        this.save.data.broken.push(s.def.id);
        this.save.persist();
        this.fx.hit((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, 0xc9b79c, 14);
        this.fx.dust((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2);
        this.audio.play('heavy');
        this.shake = Math.max(this.shake, 0.3);
        this.toast('Uma passagem secreta!');
      }
    }
  }

  private openChest(c: ChestObj) {
    c.open();
    this.audio.play('fire');
    const d = this.save.data;
    d.opened.push(c.def.id);
    const r = hash(c.def.id);
    let text: string;
    if (c.def.rich) {
      const souls = 150 + Math.floor(hash(`${c.def.id}a`) * 150);
      d.souls += souls;
      if (r < 0.5) {
        d.heartPieces++;
        const full = d.heartPieces % 3 === 0;
        text = full ? `Baú raro: ${souls} almas e um coração completo!` : `Baú raro: ${souls} almas e um pedaço de coração (${d.heartPieces % 3}/3)`;
        if (full) this.refreshStats();
      } else {
        d.potions += 2;
        text = `Baú raro: ${souls} almas e 2 poções`;
      }
    } else if (r < 0.55) {
      const souls = 25 + Math.floor(hash(`${c.def.id}a`) * 50);
      d.souls += souls;
      text = `+${souls} almas`;
    } else if (r < 0.8) {
      this.player.arrows = Math.min(this.player.stats.maxArrows, this.player.arrows + 6);
      text = '+6 flechas';
    } else {
      d.potions++;
      text = '+1 poção de cura';
    }
    this.save.persist();
    this.fx.hit(c.def.x, c.def.y + 1.2, 0xffe066, 10);
    this.fx.ring(c.def.x, c.def.y + 1, 0xffe066, 40);
    this.toast(text);
  }

  private usePotion() {
    const d = this.save.data;
    if (d.potions <= 0 || !this.player.alive) return;
    if (this.player.hp >= this.player.maxHp) {
      this.toast('Vida já está cheia');
      return;
    }
    d.potions--;
    this.player.hp = Math.min(this.player.maxHp, this.player.hp + POTION_HEAL);
    this.save.persist();
    this.audio.play('fire');
    this.fx.ring(this.player.body.x, this.player.body.y + 1.1, 0x6ee06e, 40);
    this.fx.text(this.player.body.x, this.player.body.y + 2.6, '+vida', 0x6ee06e);
  }

  private interact() {
    const p = this.player.body;
    for (const c of this.level.chests) {
      if (!c.opened && Math.abs(c.def.x - p.x) < 1.8 && Math.abs(c.def.y - p.y) < 2) {
        this.openChest(c);
        return;
      }
    }
    if (this.npcs.some((n) => n.near(p.x, p.y))) this.showShop();
  }

  // ---- menus ------------------------------------------------------------------------------

  private showMainMenu() {
    this.mode = 'menu';
    this.hud.message(null);
    const d = this.save.data;
    const hasProgress = d.checkpoint !== null || d.souls > 0 || d.skills.length > 0 || d.level > 0;
    const buttons = [];
    if (hasProgress) buttons.push({ label: 'Continuar', run: () => this.start() });
    buttons.push({
      label: hasProgress ? 'Novo jogo' : 'Jogar',
      run: () => {
        this.save.clear();
        this.start();
      },
    });
    buttons.push({ label: 'Créditos', run: () => this.showCredits() });
    this.menu.show('Zombie Platformer', buttons, 'Protótipo');
  }

  private showCredits() {
    this.menu.show('Créditos', [{ label: 'Voltar', run: () => this.showMainMenu() }], [
      'Herói, dragão e princesa: Knight, Princess and Dragon 2, de akylrum (CC0)',
      'Zumbi: "Zombie animations", de Irina Mir / irmirx (CC BY 3.0)',
      'Zumbi criança: 2D Zombie Kids, de CraftPix / Free Game Assets',
      'Monstros: coleção Land Monster, de Bevouliin (CC0)',
      'Cenário do cemitério: Free Graveyard Platformer Tileset, de pzUH (CC0)',
      'Sons e música: sintetizados no próprio jogo',
    ].join('
'));
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
    } else if (this.mode === 'pause' || this.mode === 'shop') {
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
          this.refreshStats();
          this.showSkills();
        },
      };
    });
    buttons.push({ label: 'Voltar', disabled: false, run: () => this.showPause() });
    this.menu.show('Habilidades', buttons, `Almas: ${this.save.data.souls}`);
  }

  private showShop() {
    this.mode = 'shop';
    const d = this.save.data;
    const buy = (cost: number, apply: () => void) => () => {
      d.souls -= cost;
      apply();
      this.save.persist();
      this.refreshStats();
      this.audio.play('fire');
      this.showShop();
    };
    const buttons = [
      { label: `Poção de cura · ${POTION_PRICE} almas (você tem ${d.potions})`, disabled: d.souls < POTION_PRICE, run: buy(POTION_PRICE, () => d.potions++) },
      {
        label: `Encher a aljava · ${ARROWS_PRICE} almas`,
        disabled: d.souls < ARROWS_PRICE || this.player.arrows >= this.player.stats.maxArrows,
        run: buy(ARROWS_PRICE, () => (this.player.arrows = this.player.stats.maxArrows)),
      },
      ...GEAR.filter((g) => !d.gear.includes(g.id)).map((g) => {
        const locked = !!g.requires && !d.gear.includes(g.requires);
        return {
          label: `${g.name}: ${g.desc} · ${locked ? '🔒' : `${g.cost} almas`}`,
          disabled: locked || d.souls < g.cost,
          run: buy(g.cost, () => d.gear.push(g.id)),
        };
      }),
      { label: 'Sair', disabled: false, run: () => this.togglePause() },
    ];
    this.menu.show('Mercador', buttons, `Almas: ${d.souls}`);
  }

  private levelComplete() {
    this.won = true;
    this.mode = 'menu';
    const i = this.save.data.level;
    const last = i >= LEVELS.length - 1;
    this.save.data.checkpoint = null;
    if (last) {
      this.save.data.level = 0;
      this.save.persist();
      this.menu.show(
        'Fim da demo!',
        [
          { label: 'Jogar de novo', run: () => this.start() },
          { label: 'Menu principal', run: () => this.showMainMenu() },
        ],
        `Você venceu a última fase · Almas: ${this.save.data.souls}`,
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
    const def = this.level.def;
    this.level.goal.visible = !def.boss;

    // chests and walls opened earlier stay opened
    const d = this.save.data;
    for (const c of this.level.chests) if (d.opened.includes(c.def.id) && !c.opened) c.open();
    for (const s of this.level.secrets) if (d.broken.includes(s.def.id) && !s.broken) this.level.breakSecret(s.def.id);

    const cp = d.checkpoint !== null ? def.checkpoints[d.checkpoint] : undefined;
    const spawn = cp ?? def.start;
    const foes: Foe[] = def.spawns
      .filter((s) => Math.hypot(s.x - spawn.x, s.y - spawn.y) > SAFE_SPAWN_GAP)
      .map((s) => makeFoe(ENEMIES[s.type], s.x, s.y));

    this.boss = null;
    if (def.boss) {
      const bd = ENEMIES[def.boss.type];
      this.boss = def.boss.type === 'carnical_rei' ? new Boss(bd, def.boss.x, def.boss.y) : def.boss.type === 'necromante' ? new Necromancer(bd, def.boss.x, def.boss.y) : def.boss.type === 'dragao' ? new DeadDragon(bd, def.boss.x, def.boss.y) : makeFoe(bd, def.boss.x, def.boss.y);
      foes.push(this.boss);
    }
    this.enemies = foes;
    for (const e of foes) this.foes.addChild(e.view);
    this.hud.setBoss(null, 0);

    this.player.reset(spawn.x, spawn.y, statsFor(d.skills, d.gear, d.heartPieces));
    this.won = false;
    this.hud.message(null);
    this.cam.x = spawn.x;
    this.cam.y = spawn.y + 2.4;
    this.level.light(d.checkpoint);
  }

  private resize() {
    this.app.renderer.resize(innerWidth, innerHeight);
    this.level.resizeSky(innerWidth, innerHeight);
  }

  private checkpoints() {
    const p = this.player.body;
    this.level.def.checkpoints.forEach((cp, i) => {
      if (Math.abs(p.x - cp.x) > 1.5 || Math.abs(p.y - cp.y) > 2 || !p.onGround || this.save.data.checkpoint === i) return;
      this.save.data.checkpoint = i;
      this.save.persist();
      this.player.hp = this.player.maxHp;
      this.player.stamina = this.player.maxStamina;
      this.player.arrows = this.player.stats.maxArrows;
      this.audio.play('fire');
      this.level.light(i);
      this.fx.ring(cp.x, cp.y + 1, 0xffa040, 50);
      this.hud.toast('Fogueira acesa · vida restaurada');
    });
  }

  private step(dt: number) {
    this.input.update();
    if (this.input.pressed.mute) this.toast(this.audio.toggleMute() ? 'Som desligado' : 'Som ligado');
    if (this.mode === 'menu') return;

    if (this.input.pressed.pause) this.togglePause();
    if (this.mode === 'pause' || this.mode === 'shop') return;

    if (this.input.pressed.restart || (!this.player.alive && this.input.pressed.attack)) {
      this.reset();
      return;
    }
    if (this.hitStop > 0) {
      this.hitStop -= dt;
      return;
    }

    if (this.input.pressed.potion) this.usePotion();
    if (this.input.pressed.interact) this.interact();

    this.player.update(dt, this.input, this);
    for (const e of [...this.enemies]) e.update(dt, this);
    for (const b of this.bolts) b.update(dt, this);
    for (const b of this.enemyBolts) b.update(dt, this);
    for (const n of this.npcs) n.update(dt, this.player.body.x);

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
    const p = this.player.body;
    if (this.boss && !this.bossLocked && !this.boss.dead && this.player.alive && p.x > def.boss!.arena[0] + 4 && p.x < def.boss!.arena[1] && p.y > def.boss!.y - 2 && p.y < def.boss!.y + 14) {
      this.lockArena();
    }
    if (this.boss && this.bossLocked && !this.boss.dead) this.hud.setBoss(this.boss.def.name, this.boss.hp / (this.boss.maxHp ?? this.boss.def.hp));

    if (!this.won && this.player.alive && this.level.goal.visible && Math.abs(p.x - def.goal.x) < 1.5 && Math.abs(p.y - def.goal.y) < 3) this.levelComplete();
    if (!this.player.alive) this.hud.message('Você caiu...', 'Atacar ou R para voltar à última fogueira');
  }

  private updateCamera(dt: number) {
    const p = this.player.body;
    const c = this.cam;
    const b = this.level.def.bounds;
    const k = 1 - Math.exp(-5 * dt);
    // frame the arena a little wider during the boss fight; show more on narrow screens
    const wantView = Math.max(this.bossLocked ? 14.5 : 11, 15 / (innerWidth / innerHeight));
    c.view += (wantView - c.view) * (1 - Math.exp(-3 * dt));
    const halfH = c.view / 2;
    const halfW = (c.view * (innerWidth / innerHeight)) / 2;
    let tx = p.x + this.player.facing * 2.5;
    let ty = p.y + 2.2 + (p.vy < -12 ? p.vy * 0.06 : 0);
    // never show beyond the level edges
    tx = Math.min(b.x1 - halfW, Math.max(b.x0 + halfW, tx));
    ty = Math.min(b.y1 - halfH, Math.max(b.y0 + halfH + 1, ty));
    if (this.bossLocked && this.level.def.boss) {
      const a = this.level.def.boss.arena;
      tx = Math.min(a[1] - halfW, Math.max(a[0] + halfW, tx));
    }
    c.x += (tx - c.x) * k;
    c.y += (ty - c.y) * (1 - Math.exp(-6 * dt));
    if (this.debug) {
      c.x = this.debug.x;
      c.y = this.debug.y;
      c.view = this.debug.view;
    }
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
    this.level.update(c.x, c.y, dt, (c.view * (innerWidth / innerHeight)) / 2, c.view / 2);
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
    const d = this.save.data;
    this.hud.set(this.player.hp, this.player.maxHp, this.player.stamina, this.player.maxStamina, d.souls, this.player.arrows, d.potions);
    this.app.render();
  }
}
