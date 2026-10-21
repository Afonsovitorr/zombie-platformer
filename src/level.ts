import { Container, FillGradient, Graphics, Sprite } from 'pixi.js';
import type { Box } from './physics';
import { CELL, type ChestDef, type LevelDef, type SecretDef } from './data/levels';
import { U, px, py, sceneryTex, scenerySlice, skyTex } from './gfx';

export const OUTLINE = 0x1a1030;
const OL = { width: 5, color: OUTLINE, join: 'round' as const, cap: 'round' as const };

export interface Theme {
  skyTop: number;
  skyBottom: number;
  sun: number; // moon / sun disc
  star: boolean;
  far: number;
  mid: number;
  grass: number;
  grassLight: number;
  earth: number;
  earthDark: number;
  stone: boolean; // paved tops instead of grass
}

export const THEMES: Record<LevelDef['theme'], Theme> = {
  cemetery: { skyTop: 0x2a1f5c, skyBottom: 0x9b7fe0, sun: 0xfff2b8, star: true, far: 0x5a47a6, mid: 0x3f3180, grass: 0x2c5560, grassLight: 0x3f7480, earth: 0x3d2617, earthDark: 0x2a190f, stone: false },
  forest: { skyTop: 0x143f4a, skyBottom: 0x62d0a8, sun: 0xe6ffd0, star: false, far: 0x2f8f72, mid: 0x1f6b55, grass: 0x78cf50, grassLight: 0xa0e870, earth: 0x7d5434, earthDark: 0x5f3f27, stone: false },
  crypt: { skyTop: 0x0b1a26, skyBottom: 0x3a6c7a, sun: 0xd6ecff, star: true, far: 0x2d5668, mid: 0x1c3a4c, grass: 0x8fb0b8, grassLight: 0xbad4da, earth: 0x58727e, earthDark: 0x40596a, stone: true },
  castle: { skyTop: 0x35122f, skyBottom: 0xf08a82, sun: 0xffd9a0, star: false, far: 0x8a4a70, mid: 0x5e2c52, grass: 0x9a93c0, grassLight: 0xc3bdea, earth: 0x6c668f, earthDark: 0x544e78, stone: true },
};

export interface Layer {
  c: Container;
  f: number; // 1 = moves with the world, 0 = fixed to the screen
}

export interface ChestObj {
  def: ChestDef;
  view: Container;
  lid: Graphics;
  glow: Graphics;
  opened: boolean;
  open(): void;
}

export interface SecretObj {
  def: SecretDef;
  view: Container;
  broken: boolean;
}

export interface Level {
  def: LevelDef;
  back: Container; // everything behind the characters
  front: Container;
  sky: Container;
  solids: Box[]; // mutable: breakable walls are removed from here
  hazards: Box[];
  theme: Theme;
  goal: Container;
  arenaWalls: Box[]; // become solid while the boss fight is locked
  arenaGfx: Container[];
  chests: ChestObj[];
  secrets: SecretObj[];
  update(camX: number, camY: number, dt: number, halfW: number, halfH: number): void;
  light(upTo: number | null): void; // campfires with an index up to this one are lit
  breakSecret(id: string): SecretObj | null;
  resizeSky(w: number, h: number): void;
}

function rng(seed: number) {
  return () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
}

// ---- small drawing helpers (all coordinates in pixels, feet at y = 0 unless said otherwise) ------

function flame(w: number, h: number, color: number, inner: number) {
  const g = new Graphics();
  g.moveTo(0, 0).quadraticCurveTo(-w, -h * 0.45, -w * 0.15, -h).quadraticCurveTo(w * 0.9, -h * 0.55, 0, 0);
  g.fill({ color }).stroke({ ...OL, width: 3 });
  g.moveTo(0, -2).quadraticCurveTo(-w * 0.5, -h * 0.35, 0, -h * 0.65).quadraticCurveTo(w * 0.5, -h * 0.35, 0, -2).fill({ color: inner });
  return g;
}

function pumpkin(r: number) {
  const g = new Graphics();
  g.ellipse(-r * 0.45, -r * 0.8, r * 0.6, r * 0.8).fill({ color: 0xf0861f }).stroke({ ...OL, width: 3 });
  g.ellipse(r * 0.45, -r * 0.8, r * 0.6, r * 0.8).fill({ color: 0xf0861f }).stroke({ ...OL, width: 3 });
  g.ellipse(0, -r * 0.8, r * 0.62, r * 0.85).fill({ color: 0xff9c2e }).stroke({ ...OL, width: 3 });
  g.rect(-4, -r * 1.75, 8, 12).fill({ color: 0x4b7a2a }).stroke({ ...OL, width: 3 });
  g.poly([-r * 0.35, -r * 0.95, -r * 0.1, -r * 1.1, -r * 0.1, -r * 0.8]).fill({ color: 0xffe066 });
  g.poly([r * 0.35, -r * 0.95, r * 0.1, -r * 1.1, r * 0.1, -r * 0.8]).fill({ color: 0xffe066 });
  g.moveTo(-r * 0.4, -r * 0.45).lineTo(-r * 0.2, -r * 0.55).lineTo(0, -r * 0.42).lineTo(r * 0.2, -r * 0.55).lineTo(r * 0.4, -r * 0.45).stroke({ width: 4, color: OUTLINE, join: 'round' });
  return g;
}

function bush(r: number, color: number) {
  const g = new Graphics();
  for (const [x, y, rr] of [[-r * 0.7, -r * 0.5, r * 0.6], [r * 0.7, -r * 0.5, r * 0.6], [0, -r * 0.8, r * 0.75]] as const) g.circle(x, y, rr).fill({ color }).stroke({ ...OL, width: 4 });
  g.circle(-r * 0.2, -r * 1.05, r * 0.2).fill({ color: 0xffffff, alpha: 0.2 });
  return g;
}

function mushroom(r: number) {
  const g = new Graphics();
  g.roundRect(-r * 0.22, -r * 0.7, r * 0.44, r * 0.7, 6).fill({ color: 0xf6efd8 }).stroke({ ...OL, width: 3 });
  g.moveTo(-r * 0.8, -r * 0.6).quadraticCurveTo(0, -r * 1.7, r * 0.8, -r * 0.6).closePath().fill({ color: 0xe0443a }).stroke({ ...OL, width: 3 });
  for (const [x, y] of [[-0.35, -0.95], [0.1, -1.15], [0.4, -0.85]] as const) g.circle(x * r, y * r, r * 0.12).fill({ color: 0xffffff });
  return g;
}

function rock(w: number) {
  const g = new Graphics();
  g.poly([-w, 0, -w * 0.8, -w * 0.55, -w * 0.2, -w * 0.8, w * 0.5, -w * 0.6, w, 0]).fill({ color: 0x9a96b8 }).stroke(OL);
  g.poly([-w * 0.7, -w * 0.45, -w * 0.2, -w * 0.7, -w * 0.1, -w * 0.4]).fill({ color: 0xffffff, alpha: 0.25 });
  return g;
}

function barrel() {
  const g = new Graphics();
  g.roundRect(-22, -56, 44, 56, 12).fill({ color: 0x9a6a3a }).stroke(OL);
  for (const y of [-42, -14]) g.rect(-22, y - 3, 44, 7).fill({ color: 0x5a5a72 }).stroke({ ...OL, width: 2.5 });
  g.rect(-14, -50, 5, 44).fill({ color: 0xffffff, alpha: 0.18 });
  return g;
}

function crate() {
  const g = new Graphics();
  g.rect(-26, -52, 52, 52).fill({ color: 0xb98550 }).stroke(OL);
  g.moveTo(-26, -52).lineTo(26, 0).moveTo(26, -52).lineTo(-26, 0).stroke({ width: 4, color: 0x7a5530 });
  g.rect(-26, -52, 52, 52).stroke({ width: 4, color: OUTLINE });
  return g;
}

function column(h: number, color: number) {
  const g = new Graphics();
  g.roundRect(-34, -22, 68, 22, 5).fill({ color }).stroke(OL);
  g.rect(-24, -h + 22, 48, h - 40).fill({ color }).stroke(OL);
  g.rect(-14, -h + 30, 8, h - 56).fill({ color: 0xffffff, alpha: 0.2 });
  g.roundRect(-36, -h, 72, 24, 5).fill({ color }).stroke(OL);
  return g;
}

function banner(h: number) {
  const g = new Graphics();
  g.rect(-30, -h - 8, 60, 8).fill({ color: 0xf2c14e }).stroke({ ...OL, width: 3 });
  g.poly([-26, -h, 26, -h, 26, -h * 0.3, 0, -h * 0.15, -26, -h * 0.3]).fill({ color: 0xc43a4a }).stroke(OL);
  g.star(0, -h * 0.58, 5, 13, 6).fill({ color: 0xf2c14e }).stroke({ ...OL, width: 2.5 });
  return g;
}

function torch() {
  const g = new Graphics();
  g.roundRect(-6, -40, 12, 40, 3).fill({ color: 0x6b4a2a }).stroke({ ...OL, width: 3 });
  g.roundRect(-12, -52, 24, 16, 4).fill({ color: 0x8a8aa8 }).stroke({ ...OL, width: 3 });
  return g;
}

function campfire() {
  const g = new Graphics();
  g.ellipse(0, 0, 44, 10).fill({ color: 0x000000, alpha: 0.3 });
  for (const a of [-0.5, 0.5]) {
    g.roundRect(-36, -12, 72, 14, 7).fill({ color: 0x7a4a24 }).stroke({ ...OL, width: 3.5 });
    g.rotation = 0;
    void a;
  }
  const logs = new Graphics();
  logs.roundRect(-38, -14, 76, 15, 7).fill({ color: 0x7a4a24 }).stroke({ ...OL, width: 3.5 });
  logs.rotation = 0.18;
  logs.y = -4;
  const logs2 = new Graphics();
  logs2.roundRect(-38, -14, 76, 15, 7).fill({ color: 0x8a5a2c }).stroke({ ...OL, width: 3.5 });
  logs2.rotation = -0.18;
  logs2.y = -4;
  const c = new Container();
  c.addChild(g, logs, logs2);
  for (const sx of [-38, -18, 20, 40]) c.addChild(new Graphics().circle(sx, -2, 8).fill({ color: 0x9a96b8 }).stroke({ ...OL, width: 3 }));
  return c;
}

// ---- parallax layers ------------------------------------------------------------------------

function hills(from: number, to: number, base: number, amp: number, color: number, seed: number, outline = true) {
  const rand = rng(seed);
  const p1 = rand() * 6;
  const p2 = rand() * 6;
  const pts: number[] = [from, base + 3000];
  for (let x = from; x <= to; x += 24) pts.push(x, base - amp * (0.55 + 0.3 * Math.sin(x / 520 + p1) + 0.15 * Math.sin(x / 170 + p2)));
  pts.push(to, base + 3000);
  const g = new Graphics().poly(pts).fill({ color });
  if (outline) {
    const top: number[] = [];
    for (let i = 2; i < pts.length - 2; i += 2) top.push(pts[i], pts[i + 1]);
    g.poly(top, false).stroke({ ...OL, width: 4, color: OUTLINE });
  }
  return g;
}

function roundTree(h: number, leaf: number, trunk = 0x6b4a2e) {
  const g = new Graphics();
  g.roundRect(-h * 0.07, -h * 0.5, h * 0.14, h * 0.5, 6).fill({ color: trunk }).stroke({ ...OL, width: 4 });
  for (const [x, y, r] of [[-h * 0.2, -h * 0.62, h * 0.24], [h * 0.2, -h * 0.64, h * 0.24], [0, -h * 0.82, h * 0.3]] as const) g.circle(x, y, r).fill({ color: leaf }).stroke({ ...OL, width: 4 });
  g.circle(-h * 0.1, -h * 0.92, h * 0.1).fill({ color: 0xffffff, alpha: 0.14 });
  return g;
}

function pineTree(h: number, leaf: number) {
  const g = new Graphics();
  g.rect(-h * 0.05, -h * 0.2, h * 0.1, h * 0.2).fill({ color: 0x5a3a24 }).stroke({ ...OL, width: 4 });
  for (let i = 0; i < 3; i++) {
    const y = -h * (0.2 + i * 0.26);
    const w = h * (0.34 - i * 0.07);
    g.poly([-w, y, 0, y - h * 0.4, w, y]).fill({ color: leaf }).stroke({ ...OL, width: 4 });
  }
  return g;
}

function castleSilhouette(w: number, h: number, color: number, rand: () => number) {
  const g = new Graphics();
  // wall with crenellations
  g.rect(0, -h * 0.45, w, h * 0.45).fill({ color }).stroke({ ...OL, width: 4 });
  for (let x = 0; x < w; x += 46) g.rect(x + 4, -h * 0.45 - 20, 28, 22).fill({ color }).stroke({ ...OL, width: 3 });
  for (let x = 40; x < w - 40; x += 90 + rand() * 40) {
    g.moveTo(x - 14, -h * 0.1).lineTo(x - 14, -h * 0.28).arc(x, -h * 0.28, 14, Math.PI, 0).lineTo(x + 14, -h * 0.1).closePath().fill({ color: 0xffc27a, alpha: 0.9 }).stroke({ ...OL, width: 3 });
  }
  // towers
  for (const tx of [w * 0.12, w * 0.5, w * 0.86]) {
    const th = h * (0.75 + rand() * 0.25);
    g.rect(tx - 38, -th, 76, th).fill({ color }).stroke({ ...OL, width: 4 });
    g.poly([tx - 50, -th, tx, -th - 70, tx + 50, -th]).fill({ color: 0x3b1c3a }).stroke({ ...OL, width: 4 });
    g.moveTo(tx - 10, -th * 0.7).lineTo(tx - 10, -th * 0.55).arc(tx, -th * 0.55, 10, Math.PI, 0).lineTo(tx + 10, -th * 0.7).closePath().fill({ color: 0xffc27a }).stroke({ ...OL, width: 3 });
  }
  return g;
}

function shade(color: number, k: number) {
  const r = Math.min(255, Math.round(((color >> 16) & 255) * k));
  const g = Math.min(255, Math.round(((color >> 8) & 255) * k));
  const b = Math.min(255, Math.round((color & 255) * k));
  return (r << 16) | (g << 8) | b;
}

// ---- grid terrain ---------------------------------------------------------------------------

const CP = CELL * U; // pixels per grid cell

// Strokes the exposed outline of a window of cells: merges neighbouring edge pieces into long lines.
function outlineCells(g: Graphics, cells: Set<string>, win: Win, cellPx: (c: number, r: number) => [number, number]) {
  const has = (c: number, r: number) => cells.has(`${c},${r}`);
  for (let r = win.r0; r <= win.r1; r++) {
    let c = win.c0;
    while (c < win.c1) {
      // boundary r lies between row r-1 and row r; draw where exactly one side is filled
      const edge = (cc: number) => has(cc, r - 1) !== has(cc, r);
      if (!edge(c)) { c++; continue; }
      const c0 = c;
      while (c < win.c1 && edge(c)) c++;
      const [x0, y] = cellPx(c0, r);
      const [x1] = cellPx(c, r);
      g.moveTo(x0, y).lineTo(x1, y);
    }
  }
  for (let c = win.c0; c <= win.c1; c++) {
    let r = win.r0;
    while (r < win.r1) {
      const edge = (rr: number) => has(c - 1, rr) !== has(c, rr);
      if (!edge(r)) { r++; continue; }
      const r0 = r;
      while (r < win.r1 && edge(r)) r++;
      const [x, y0] = cellPx(c, r0);
      const [, y1] = cellPx(c, r);
      g.moveTo(x, y0).lineTo(x, y1);
    }
  }
  g.stroke(OL);
}

interface Win {
  c0: number; // first column
  c1: number; // one past the last column
  r0: number;
  r1: number;
}

function crackLines(g: Graphics, x: number, y: number, w: number, h: number, rand: () => number) {
  for (let i = 0; i < 3; i++) {
    const sx = x + 10 + rand() * (w - 20);
    const sy = y + 10 + rand() * (h - 20);
    g.moveTo(sx, sy).lineTo(sx + (rand() - 0.5) * 36, sy + 10 + rand() * 16).lineTo(sx + (rand() - 0.5) * 30, sy + 30 + rand() * 14).stroke({ width: 3, color: OUTLINE, alpha: 0.7, cap: 'round', join: 'round' });
  }
}

function spikesGfx(w: number) {
  const g = new Graphics();
  const n = Math.max(1, Math.round(w / 32));
  const sw = w / n;
  for (let i = 0; i < n; i++) {
    g.poly([i * sw + 2, 0, i * sw + sw / 2, -50, i * sw + sw - 2, 0]).fill({ color: 0xcfd6e6 }).stroke({ ...OL, width: 3 });
    g.poly([i * sw + sw / 2 - 2, -42, i * sw + sw / 2 - 8, -8, i * sw + sw / 2 - 2, -8]).fill({ color: 0xffffff, alpha: 0.5 });
  }
  return g;
}

function chestGfx() {
  const base = new Graphics();
  base.roundRect(-30, -30, 60, 30, 5).fill({ color: 0x9a5a2a }).stroke(OL);
  base.rect(-30, -18, 60, 6).fill({ color: 0x7a4420 });
  base.rect(-4, -26, 8, 16).fill({ color: 0xf2c14e }).stroke({ ...OL, width: 2.5 });
  const glow = new Graphics().circle(0, -34, 52).fill({ color: 0xffe066, alpha: 0.26 });
  glow.visible = false;
  const lid = new Graphics();
  lid.moveTo(-30, 0).quadraticCurveTo(0, -36, 30, 0).closePath().fill({ color: 0xb8702f }).stroke(OL);
  lid.rect(-4, -16, 8, 14).fill({ color: 0xf2c14e }).stroke({ ...OL, width: 2.5 });
  lid.position.set(0, -30);
  return { base, lid, glow };
}

// ---- level ----------------------------------------------------------------------------------

export function buildLevel(def: LevelDef): Level {
  const theme = THEMES[def.theme];
  const rand = rng(7);
  const back = new Container();
  const front = new Container();
  const layers: Layer[] = [];

  const { cols, rows, grid } = def;
  // world position helpers: cell (c,r) has its lower edge at y = (rows - r - 1) * CELL - yOffset
  const cellTopY = (r: number) => (rows - r) * CELL - def.yOffset;
  const cellPx = (c: number, r: number): [number, number] => [c * CP, -cellTopY(r) * U];
  const ch = (c: number, r: number) => (r < 0 || r >= rows || c < 0 || c >= cols ? '#' : grid[r][c]);
  const isEarth = (c: number, r: number) => ch(c, r) === '#';
  const isBlock = (c: number, r: number) => ch(c, r) === '#' || ch(c, r) === 'S';

  const solids: Box[] = [...def.solids, ...def.oneWay, ...def.secrets.map((s) => ({ ...s.box }))];
  const first = 0;
  const last = def.bounds.x1;
  const horizonY = 0;

  // sky: screen-fixed gradient (resized with the window)
  const sky = new Container();
  const skyGfx = new Graphics();
  sky.addChild(skyGfx);
  const tiled = def.theme === 'cemetery'; // drawn with the graveyard tile set
  const skyPic = tiled ? new Sprite(skyTex()) : null;
  if (skyPic) {
    skyPic.anchor.set(0.5);
    sky.addChild(skyPic);
  }

  const addLayer = (f: number, build: (c: Container, from: number, to: number) => void) => {
    const c = new Container();
    // layer space covers what the camera can see: world x range scaled by f, plus a screen's worth of margin
    build(c, px(first - 20) * f - 2200, px(last + 20) * f + 2200);
    c.y = horizonY;
    back.addChild(c);
    layers.push({ c, f });
    return c;
  };

  // celestial body and stars
  if (!tiled) addLayer(0.04, (c, from, to) => {
    const mid = (from + to) / 2;
    c.addChild(new Graphics().circle(mid + 560, -330, 120).fill({ color: theme.sun, alpha: 0.18 }));
    c.addChild(new Graphics().circle(mid + 560, -330, 84).fill({ color: theme.sun }).stroke({ ...OL, width: 4 }));
    if (def.theme === 'cemetery') c.addChild(new Graphics().circle(mid + 530, -360, 14).fill({ color: 0xd8cfa0 }).circle(mid + 590, -300, 9).fill({ color: 0xd8cfa0 }));
    if (theme.star) {
      for (let i = 0; i < 70; i++) c.addChild(new Graphics().star(mid + (rand() - 0.5) * 3600, -800 + rand() * 640, 4, 3 + rand() * 4, 1.5).fill({ color: 0xffffff, alpha: 0.4 + rand() * 0.5 }));
    }
  });

  // drifting clouds
  const clouds: Container[] = [];
  if (!tiled) addLayer(0.1, (c, from, to) => {
    for (let x = from; x < to; x += 420 + rand() * 360) {
      const cl = new Container();
      const w = 80 + rand() * 70;
      for (const [dx, dy, r] of [[-w * 0.5, 0, 0.55], [0, -14, 0.75], [w * 0.5, 0, 0.55]] as const) {
        cl.addChild(new Graphics().circle(dx, dy, w * r * 0.55).fill({ color: 0xffffff, alpha: 0.2 }));
      }
      cl.position.set(x, -520 - rand() * 220);
      clouds.push(cl);
      c.addChild(cl);
    }
  });

  if (tiled) {
    const silhouette = (name: string, tint: number, scale: number, y: number) => {
      const sp = new Sprite(sceneryTex(name));
      sp.anchor.set(0.5, 1);
      sp.scale.set(scale);
      sp.tint = tint;
      sp.y = y;
      return sp;
    };
    addLayer(0.3, (c, from, to) => {
      for (let x = from; x < to; x += 330 + rand() * 240) {
        const t = silhouette('tree', 0x172229, 2.6 + rand() * 0.9, 40);
        t.x = x;
        c.addChild(t);
      }
    });
    addLayer(0.55, (c, from, to) => {
      for (let x = from; x < to; x += 190 + rand() * 170) {
        const names = ['tomb1', 'tomb2', 'deadbush', 'bush1', 'bush2'];
        const t = silhouette(names[Math.floor(rand() * names.length)], 0x223239, 1.7 + rand() * 0.5, 30);
        t.x = x;
        c.addChild(t);
      }
    });
  } else if (def.theme === 'forest') {
    addLayer(0.25, (c, from, to) => {
      c.addChild(hills(from, to, 60, 300, 0x2a7f66, 4));
      for (let x = from; x < to; x += 70 + rand() * 40) {
        const t = pineTree(220 + rand() * 120, 0x2e8a6c);
        t.position.set(x, 30);
        c.addChild(t);
      }
    });
    addLayer(0.5, (c, from, to) => {
      for (let x = from; x < to; x += 150 + rand() * 80) {
        const t = roundTree(250 + rand() * 130, 0x2a7a54);
        t.position.set(x, 60);
        c.addChild(t);
      }
    });
  } else {
    addLayer(0.25, (c, from, to) => {
      c.addChild(hills(from, to, 60, 180, 0x72384f, 8));
      for (let x = from + 100; x < to; x += 900 + rand() * 500) {
        const cs = castleSilhouette(520 + rand() * 260, 380, theme.far, rand);
        cs.position.set(x, 50);
        c.addChild(cs);
      }
    });
    addLayer(0.5, (c, from, to) => {
      for (let x = from; x < to; x += 420) {
        const w = new Graphics();
        w.rect(x, -330, 420, 330).fill({ color: theme.mid }).stroke({ ...OL, width: 4 });
        for (let r = 0; r < 4; r++) w.moveTo(x, -330 + r * 82).lineTo(x + 420, -330 + r * 82).stroke({ width: 2.5, color: 0x4a2044 });
        w.moveTo(x + 70, 0).lineTo(x + 70, -170).arc(x + 140, -170, 70, Math.PI, 0).lineTo(x + 210, 0).closePath().fill({ color: 0x2a0f28 }).stroke({ ...OL, width: 4 });
        w.moveTo(x + 280, -150).lineTo(x + 280, -240).arc(x + 320, -240, 40, Math.PI, 0).lineTo(x + 360, -150).closePath().fill({ color: 0xffc27a, alpha: 0.85 }).stroke({ ...OL, width: 4 });
        c.addChild(w);
      }
    });
  }

  // ---- gameplay layer ----
  const stage = new Container();
  back.addChild(stage);
  const flames: Container[] = [];
  const glows: Graphics[] = [];

  // The terrain is drawn in chunks that are hidden when off screen (cheaper on tablets).
  const CHW = 16;
  const CHH = 12;
  interface Chunk { node: Container; cave: Graphics; deco: Container; terrain: Graphics; tiles: Container; win: Win; x0: number; x1: number; yTop: number; yBot: number }
  const chunks: Chunk[] = [];
  const chunkMap = new Map<string, Chunk>();
  const chunkOf = (c: number, r: number) => {
    const cc = Math.min(cols - 1, Math.max(0, c));
    const rr = Math.min(rows - 1, Math.max(0, r));
    const key = `${Math.floor(cc / CHW)},${Math.floor(rr / CHH)}`;
    let k = chunkMap.get(key);
    if (!k) {
      const win: Win = { c0: Math.floor(cc / CHW) * CHW, c1: Math.min(cols, Math.floor(cc / CHW) * CHW + CHW), r0: Math.floor(rr / CHH) * CHH, r1: Math.min(rows, Math.floor(rr / CHH) * CHH + CHH) };
      const node = new Container();
      const cave = new Graphics();
      const deco = new Container();
      const terrain = new Graphics();
      const tiles = new Container();
      node.addChild(cave, deco, terrain, tiles);
      k = { node, cave, deco, terrain, tiles, win, x0: win.c0 * CELL, x1: win.c1 * CELL, yTop: cellTopY(win.r0), yBot: cellTopY(win.r1) };
      chunkMap.set(key, k);
      chunks.push(k);
      stage.addChild(node);
    }
    return k;
  };
  const rowOf = (y: number) => rows - 1 - Math.floor((y + def.yOffset) / CELL);

  const place = (g: Container, x: number, y: number, scale = 1) => {
    g.position.set(px(x), py(y));
    g.scale.set(scale);
    chunkOf(Math.floor(x / CELL), rowOf(y)).deco.addChild(g);
    return g;
  };

  // cave backdrop: every empty cell that is not open to the sky (flood-filled from the top), plus deep narrow canyons
  const outdoor = new Set<string>();
  {
    const stack: [number, number][] = [];
    for (let c = 0; c < cols; c++) stack.push([c, 0]);
    while (stack.length) {
      const [c, r] = stack.pop()!;
      if (c < 0 || c >= cols || r < 0 || r >= rows || isBlock(c, r) || outdoor.has(`${c},${r}`)) continue;
      outdoor.add(`${c},${r}`);
      stack.push([c + 1, r], [c - 1, r], [c, r + 1], [c, r - 1]);
    }
  }
  const canyon = (c: number, r: number) => {
    let l = false;
    let rr = false;
    for (let i = 1; i <= 10; i++) {
      if (!l && isBlock(c - i, r)) l = true;
      if (!rr && isBlock(c + i, r)) rr = true;
    }
    return l && rr;
  };
  const caveColor = tiled ? 0x14191d : def.theme === 'castle' ? 0x2c1a34 : def.theme === 'crypt' ? 0x14222c : def.theme === 'forest' ? 0x1d3a2e : 0x231a40;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (isBlock(c, r)) continue;
      if (outdoor.has(`${c},${r}`) && !canyon(c, r)) continue;
      const [x, y] = cellPx(c, r);
      const cave = chunkOf(c, r).cave;
      cave.rect(x, y, CP + 1, CP + 1).fill({ color: caveColor });
      if ((c + r) % 2 === 0) cave.rect(x + 8, y + 10, CP - 16, 6).fill({ color: 0xffffff, alpha: 0.04 });
    }
  }

  // surfaces for decor: cells of earth whose upper neighbour is open
  interface Run { x0: number; x1: number; y: number }
  const runs: Run[] = [];
  for (let r = 0; r < rows; r++) {
    let c = 0;
    while (c < cols) {
      const top = (cc: number) => isEarth(cc, r) && !isBlock(cc, r - 1) && ch(cc, r - 1) !== '=' && r > 0;
      if (!top(c)) { c++; continue; }
      const c0 = c;
      while (c < cols && top(c)) c++;
      runs.push({ x0: c0 * CELL, x1: c * CELL, y: cellTopY(r) });
    }
  }
  const reserved = [...def.checkpoints, ...def.npcs, ...def.chests, def.goal, ...(def.boss ? [def.boss] : [])];
  const free = (x: number) => !reserved.some((p) => Math.abs(p.x - x) < 2.2);

  const scatter = (every: number, make: () => Container, jitter = 0.8) => {
    for (const run of runs) {
      for (let x = run.x0 + 1; x < run.x1 - 0.5; x += every * (0.7 + rand() * 0.6)) {
        if (rand() < 0.3 || !free(x)) continue;
        place(make(), x + (rand() - 0.5) * jitter, run.y);
      }
    }
  };
  if (tiled) {
    const prop = (name: string, scale: number) => {
      const sp = new Sprite(sceneryTex(name));
      sp.anchor.set(0.5, 1);
      sp.scale.set(scale);
      const c = new Container();
      c.addChild(sp);
      return c;
    };
    scatter(3.4, () => {
      const r = rand();
      return r < 0.28 ? prop('tomb1', 1.7) : r < 0.52 ? prop('tomb2', 1.7) : r < 0.66 ? prop(rand() < 0.5 ? 'bush1' : 'bush2', 1.3) : r < 0.76 ? prop('deadbush', 1.4) : r < 0.84 ? prop('crate', 0.75) : r < 0.9 ? prop(rand() < 0.5 ? 'skull1' : 'skull2', 0.7) : r < 0.95 ? prop('bones1', 0.8) : prop(rand() < 0.5 ? 'skeleton' : 'sign', 1.1);
    });
    for (const run of runs) if (run.x1 - run.x0 >= 8 && rand() < 0.8) place(prop('tree', 2.1), run.x0 + 2 + rand() * (run.x1 - run.x0 - 4), run.y);
  } else if (def.theme === 'forest') {
    scatter(3, () => { const r = rand(); return r < 0.35 ? bush(24 + rand() * 14, 0x4faa3e) : r < 0.6 ? mushroom(24 + rand() * 12) : r < 0.8 ? rock(24 + rand() * 12) : pumpkin(20 + rand() * 10); });
    for (const run of runs) if (run.x1 - run.x0 >= 8 && rand() < 0.8) place(roundTree(230 + rand() * 90, 0x3f9a46), run.x0 + 2 + rand() * (run.x1 - run.x0 - 4), run.y);
  } else {
    for (const run of runs) {
      if (run.x1 - run.x0 >= 10) place(column(300 + rand() * 40, 0x8a84ad), run.x0 + 3 + rand() * (run.x1 - run.x0 - 6), run.y);
      if (run.x1 - run.x0 >= 14 && rand() < 0.6) place(banner(150), run.x0 + 2 + rand() * (run.x1 - run.x0 - 4), run.y + 4.6);
      for (let x = run.x0 + 3; x < run.x1 - 2; x += 8 + rand() * 4) {
        if (!free(x) || rand() < 0.4) continue;
        place(torch(), x, run.y + 2.6);
        const f = flame(16, 38, 0xffa02e, 0xffe27a);
        f.position.set(px(x), py(run.y + 2.6) - 50);
        chunkOf(Math.floor(x / CELL), rowOf(run.y + 2.6)).deco.addChild(f);
        flames.push(f);
      }
    }
    scatter(5, () => { const r = rand(); return r < 0.4 ? barrel() : r < 0.8 ? crate() : rock(30); });
  }

  // terrain: earth fill, speckles, outline, grass / slab caps (one chunk at a time)
  const earthCells = new Set<string>();
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (grid[r][c] === '#') earthCells.add(`${c},${r}`);
  for (let cr = 0; cr < rows; cr += CHH) {
    for (let cc = 0; cc < cols; cc += CHW) {
      const k = chunkOf(cc, cr);
      const { win, terrain } = k;
      if (tiled) {
        // autotiling: pick the tile from which neighbours are open
        for (let r = win.r0; r < win.r1; r++) {
          for (let c = win.c0; c < win.c1; c++) {
            if (!isEarth(c, r)) continue;
            const up = isBlock(c, r - 1);
            const down = isBlock(c, r + 1);
            const left = isBlock(c - 1, r);
            const right = isBlock(c + 1, r);
            const pick = (...n: number[]) => n[Math.floor(rand() * n.length)];
            let t: number;
            if (!up) t = !down ? (!left ? 14 : !right ? 16 : 15) : !left ? 1 : !right ? 3 : pick(2, 7, 11);
            else if (!down) t = !left ? 12 : !right ? 13 : 9;
            else t = !left ? 4 : !right ? 6 : pick(5, 10);
            const sp = new Sprite(sceneryTex(`tile${t}`));
            const [x, y] = cellPx(c, r);
            sp.position.set(x, y);
            sp.width = CP + 1;
            sp.height = CP + 1;
            k.tiles.addChild(sp);
          }
        }
        continue;
      }
      for (let r = win.r0; r < win.r1; r++) {
        let c = win.c0;
        while (c < win.c1) {
          if (!isEarth(c, r)) { c++; continue; }
          const c0 = c;
          while (c < win.c1 && isEarth(c, r)) c++;
          const [x, y] = cellPx(c0, r);
          terrain.rect(x, y, (c - c0) * CP + 1, CP + 1).fill({ color: theme.earth });
        }
      }
      for (let r = win.r0; r < win.r1; r++) {
        for (let c = win.c0; c < win.c1; c++) {
          if (!isEarth(c, r)) continue;
          const [x, y] = cellPx(c, r);
          if (theme.stone) {
            terrain.moveTo(x, y + CP / 2).lineTo(x + CP, y + CP / 2).moveTo(x + (r % 2 ? CP * 0.3 : CP * 0.7), y).lineTo(x + (r % 2 ? CP * 0.3 : CP * 0.7), y + CP / 2).moveTo(x + (r % 2 ? CP * 0.7 : CP * 0.3), y + CP / 2).lineTo(x + (r % 2 ? CP * 0.7 : CP * 0.3), y + CP).stroke({ width: 2.5, color: theme.earthDark });
          } else if (rand() < 0.5) {
            terrain.ellipse(x + 20 + rand() * (CP - 40), y + 24 + rand() * (CP - 48), 5 + rand() * 8, 4 + rand() * 5).fill({ color: rand() < 0.5 ? theme.earthDark : 0xa07a58 });
          }
        }
      }
      outlineCells(terrain, earthCells, win, cellPx);
      // caps: grass (or slabs) on every surface that is open above
      for (let r = Math.max(1, win.r0); r < win.r1; r++) {
        let c = win.c0;
        while (c < win.c1) {
          const open = (c2: number) => isEarth(c2, r) && !isBlock(c2, r - 1);
          if (!open(c)) { c++; continue; }
          const c0 = c;
          while (c < win.c1 && open(c)) c++;
          const [x0, y] = cellPx(c0, r);
          const W = (c - c0) * CP;
          const capH = theme.stone ? 30 : 36;
          const n = Math.max(1, Math.round(W / 26));
          const ys: number[] = [];
          for (let i = 0; i <= n; i++) ys.push(y + capH + (i % 2 ? 12 : 0) + (theme.stone ? 0 : rand() * 6));
          const lower: number[] = [];
          for (let i = 0; i <= n; i++) lower.push(x0 + (W * i) / n, ys[i]);
          const back2: number[] = [];
          for (let i = n; i >= 0; i--) back2.push(x0 + (W * i) / n, ys[i]);
          terrain.poly([x0, y, x0 + W, y, ...back2]).fill({ color: theme.grass });
          terrain.poly(lower, false).stroke(OL);
          terrain.rect(x0 + 6, y + 5, W - 12, 7).fill({ color: theme.grassLight, alpha: 0.9 });
          if (!theme.stone) for (let x = x0 + 20; x < x0 + W - 12; x += 34 + rand() * 40) terrain.poly([x, y, x + 5, y - 14, x + 10, y]).fill({ color: theme.grassLight }).stroke({ ...OL, width: 2.5 });
        }
      }
    }
  }

  // jump-through platforms
  for (const b of def.oneWay) {
    if (tiled) {
      const cells = Math.round((b.x1 - b.x0) / CELL);
      for (let i = 0; i < cells; i++) {
        const sp = new Sprite(scenerySlice(cells === 1 ? 'tile15' : i === 0 ? 'tile14' : i === cells - 1 ? 'tile16' : 'tile15', 56));
        sp.position.set(px(b.x0) + i * CP, py(b.y1));
        sp.width = CP + 1;
        stage.addChild(sp);
      }
      continue;
    }
    const g = new Graphics();
    const w = px(b.x1 - b.x0);
    g.roundRect(0, 0, w, 34, 10).fill({ color: theme.stone ? theme.earth : 0x8a5f3c }).stroke(OL);
    g.roundRect(4, 0, w - 8, 14, 7).fill({ color: theme.grass }).stroke({ ...OL, width: 3.5 });
    g.rect(10, 4, w - 20, 4).fill({ color: theme.grassLight });
    g.position.set(px(b.x0), py(b.y1));
    stage.addChild(g);
  }

  // spikes
  for (const h of def.hazards) {
    const g = spikesGfx(px(h.x1 - h.x0));
    g.position.set(px(h.x0), py(h.y0));
    stage.addChild(g);
  }

  // breakable walls
  const secrets: SecretObj[] = def.secrets.map((s) => {
    const view = new Container();
    const g = new Graphics();
    for (const [c, r] of s.cells) {
      const [x, y] = cellPx(c, r);
      g.rect(x, y, CP + 1, CP + 1).fill({ color: shade(theme.earth, 0.92) });
    }
    const set = new Set(s.cells.map(([c, r]) => `${c},${r}`));
    outlineCells(g, set, { c0: 0, c1: cols, r0: 0, r1: rows }, cellPx);
    const bx = px(s.box.x0);
    const by = py(s.box.y1);
    crackLines(g, bx, by, px(s.box.x1 - s.box.x0), px(s.box.y1 - s.box.y0), rand);
    view.addChild(g);
    stage.addChild(view);
    return { def: s, view, broken: false };
  });

  // checkpoints (campfires)
  const fires: { flame: Container; glow: Graphics }[] = [];
  for (const cp of def.checkpoints) {
    place(campfire(), cp.x, cp.y);
    const glow = new Graphics().circle(0, 0, 130).fill({ color: 0xffa040, alpha: 0.22 });
    glow.position.set(px(cp.x), py(cp.y + 0.9));
    glow.visible = false;
    const f = flame(26, 70, 0xff8a1e, 0xffe27a);
    f.position.set(px(cp.x), py(cp.y + 0.3));
    f.visible = false;
    stage.addChild(glow, f);
    fires.push({ flame: f, glow });
    flames.push(f);
    glows.push(glow);
  }

  // chests
  const chests: ChestObj[] = def.chests.map((cd) => {
    const { base, lid, glow } = chestGfx();
    const view = new Container();
    view.addChild(glow, base, lid);
    if (cd.rich) view.scale.set(1.25);
    view.position.set(px(cd.x), py(cd.y));
    stage.addChild(view);
    const obj: ChestObj = {
      def: cd, view, lid, glow, opened: false,
      open() {
        obj.opened = true;
        lid.rotation = -1.1;
        lid.position.set(-6, -34);
        glow.visible = true;
      },
    };
    return obj;
  });

  // goal flag
  const goal = new Container();
  const pole = new Graphics().roundRect(-5, -300, 10, 300, 4).fill({ color: 0xe8e4f4 }).stroke({ ...OL, width: 4 });
  const flagG = new Graphics().poly([5, -296, 110, -270, 5, -236]).fill({ color: 0xffc83d }).stroke(OL);
  flagG.star(48, -266, 5, 14, 6).fill({ color: 0xffffff }).stroke({ ...OL, width: 2.5 });
  const ball = new Graphics().circle(0, -304, 10).fill({ color: 0xffc83d }).stroke({ ...OL, width: 4 });
  goal.addChild(pole, flagG, ball);
  goal.position.set(px(def.goal.x), py(def.goal.y));
  goal.visible = !def.boss;
  stage.addChild(goal);

  // boss arena: stone pillars that rise when the fight starts
  const arenaWalls: Box[] = [];
  const arenaGfx: Container[] = [];
  if (def.boss) {
    const [a0, a1] = def.boss.arena;
    const yLow = def.boss.y - 6;
    const yHigh = def.boss.y + 16;
    for (const [x0, x1] of [[a0 - 0.8, a0], [a1, a1 + 0.8]] as const) {
      arenaWalls.push({ x0, x1, y0: yLow, y1: yHigh });
      const w = new Graphics();
      w.roundRect(px(x0), py(yHigh), px(x1 - x0), (yHigh - yLow) * U, 8).fill({ color: theme.earth }).stroke(OL);
      for (let y = 0; y < (yHigh - yLow) * U; y += 52) w.moveTo(px(x0) + 3, py(yHigh) + y).lineTo(px(x1) - 3, py(yHigh) + y).stroke({ width: 3, color: theme.earthDark });
      w.visible = false;
      stage.addChild(w);
      arenaGfx.push(w);
    }
  }

  const level: Level = {
    def, back, front, sky, solids, hazards: def.hazards, theme, goal, arenaWalls, arenaGfx, chests, secrets,
    update(camX, camY, dt, halfW, halfH) {
      for (const k of chunks) {
        k.node.visible = k.x1 > camX - halfW - 4 && k.x0 < camX + halfW + 4 && k.yTop > camY - halfH - 8 && k.yBot < camY + halfH + 8;
      }
      const cx = px(camX);
      const cy = py(camY);
      for (const { c, f } of layers) {
        c.x = cx * (1 - f);
        c.y = horizonY + cy * (1 - f) * 0.8;
      }
      for (const cl of clouds) cl.x += dt * 8;
      const pulse = 1 + Math.sin(performance.now() / 90) * 0.1;
      for (const f of flames) f.scale.set(pulse, 1 + (pulse - 1) * 2.2);
      for (const g of glows) g.alpha = 0.8 + Math.sin(performance.now() / 160) * 0.2;
    },
    light(upTo) {
      fires.forEach((f, i) => {
        const lit = upTo !== null && i <= upTo;
        f.flame.visible = lit;
        f.glow.visible = lit;
      });
    },
    breakSecret(id) {
      const s = secrets.find((x) => x.def.id === id && !x.broken);
      if (!s) return null;
      s.broken = true;
      s.view.visible = false;
      const i = solids.findIndex((b) => b.id === id);
      if (i >= 0) solids.splice(i, 1);
      return s;
    },
    resizeSky(w, h) {
      skyGfx.clear();
      if (skyPic) {
        skyGfx.rect(0, 0, w, h).fill({ color: 0x0c161c });
        const k = Math.max(w / skyPic.texture.width, h / skyPic.texture.height);
        skyPic.scale.set(k);
        skyPic.position.set(w / 2, h / 2);
        return;
      }
      const grad = new FillGradient({ type: 'linear', start: { x: 0, y: 0 }, end: { x: 0, y: 1 }, colorStops: [{ offset: 0, color: theme.skyTop }, { offset: 1, color: theme.skyBottom }], textureSpace: 'local' });
      skyGfx.rect(0, 0, w, h).fill(grad);
    },
  };
  return level;
}
