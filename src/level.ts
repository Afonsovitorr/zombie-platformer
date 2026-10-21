import { Container, FillGradient, Graphics } from 'pixi.js';
import type { Box } from './physics';
import type { LevelDef } from './data/levels';
import { U, px, py } from './gfx';

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
  cemetery: { skyTop: 0x2a1f5c, skyBottom: 0x9b7fe0, sun: 0xfff2b8, star: true, far: 0x5a47a6, mid: 0x3f3180, grass: 0x66b85a, grassLight: 0x8ad46e, earth: 0x7a5238, earthDark: 0x5e3d2a, stone: false },
  forest: { skyTop: 0x143f4a, skyBottom: 0x62d0a8, sun: 0xe6ffd0, star: false, far: 0x2f8f72, mid: 0x1f6b55, grass: 0x78cf50, grassLight: 0xa0e870, earth: 0x7d5434, earthDark: 0x5f3f27, stone: false },
  castle: { skyTop: 0x35122f, skyBottom: 0xf08a82, sun: 0xffd9a0, star: false, far: 0x8a4a70, mid: 0x5e2c52, grass: 0x9a93c0, grassLight: 0xc3bdea, earth: 0x6c668f, earthDark: 0x544e78, stone: true },
};

export interface Layer {
  c: Container;
  f: number; // 1 = moves with the world, 0 = fixed to the screen
}

export interface Level {
  def: LevelDef;
  back: Container; // everything behind the characters
  front: Container;
  sky: Graphics;
  solids: Box[];
  theme: Theme;
  goal: Container;
  arenaWalls: Box[]; // become solid while the boss fight is locked
  arenaGfx: Container[];
  update(camX: number, camY: number, dt: number): void;
  light(upTo: number | null): void; // campfires at or before this x are lit
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

function gravestone(rand: () => number) {
  const g = new Graphics();
  const w = 38 + rand() * 18;
  const h = 52 + rand() * 30;
  g.moveTo(-w / 2, 0).lineTo(-w / 2, -h + w / 2).arc(0, -h + w / 2, w / 2, Math.PI, 0).lineTo(w / 2, 0).closePath();
  g.fill({ color: 0xb9b6d0 }).stroke(OL);
  g.rect(-w / 2 + 5, -h * 0.55, 6, h * 0.5).fill({ color: 0xffffff, alpha: 0.28 });
  if (rand() < 0.5) {
    g.moveTo(0, -h + 14).lineTo(0, -h + 38).moveTo(-8, -h + 22).lineTo(8, -h + 22).stroke({ width: 5, color: 0x6e6a8e, cap: 'round' });
  } else {
    g.moveTo(-9, -h + 22).lineTo(9, -h + 22).moveTo(-9, -h + 32).lineTo(9, -h + 32).stroke({ width: 4, color: 0x6e6a8e, cap: 'round' });
  }
  g.ellipse(0, 2, w * 0.6, 7).fill({ color: 0x3a2c20, alpha: 0.5 });
  return g;
}

function deadTree(rand: () => number, h: number, trunk = 0x5a3b2e) {
  const g = new Graphics();
  const w = h * 0.12;
  g.poly([-w, 0, -w * 0.5, -h, w * 0.5, -h, w, 0]).fill({ color: trunk }).stroke(OL);
  const branch = (x: number, y: number, ang: number, len: number, depth: number) => {
    const x2 = x + Math.cos(ang) * len;
    const y2 = y - Math.sin(ang) * len;
    g.moveTo(x, y).lineTo(x2, y2).stroke({ width: 10 - depth * 3, color: OUTLINE, cap: 'round' });
    g.moveTo(x, y).lineTo(x2, y2).stroke({ width: 5 - depth * 1.4, color: trunk, cap: 'round' });
    if (depth < 2) {
      branch(x2, y2, ang + 0.6 + rand() * 0.4, len * 0.62, depth + 1);
      branch(x2, y2, ang - 0.6 - rand() * 0.4, len * 0.62, depth + 1);
    }
  };
  branch(0, -h * 0.95, Math.PI / 2 + 0.7, h * 0.4, 0);
  branch(0, -h * 0.95, Math.PI / 2 - 0.7, h * 0.4, 0);
  branch(0, -h * 0.6, Math.PI / 2 + 1.1, h * 0.3, 1);
  return g;
}

function fence(n: number) {
  const g = new Graphics();
  const w = 26;
  g.rect(0, -52, n * w, 7).fill({ color: 0x8b6b52 }).stroke({ ...OL, width: 3 });
  g.rect(0, -26, n * w, 7).fill({ color: 0x8b6b52 }).stroke({ ...OL, width: 3 });
  for (let i = 0; i < n; i++) {
    g.poly([i * w + 3, 0, i * w + 3, -66, i * w + w / 2, -80, i * w + w - 3, -66, i * w + w - 3, 0]).fill({ color: 0xa8845f }).stroke({ ...OL, width: 3 });
  }
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

function chest() {
  const g = new Graphics();
  g.roundRect(-30, -28, 60, 28, 5).fill({ color: 0x9a5a2a }).stroke(OL);
  g.moveTo(-30, -28).quadraticCurveTo(0, -62, 30, -28).closePath().fill({ color: 0xb8702f }).stroke(OL);
  g.rect(-5, -34, 10, 14).fill({ color: 0xf2c14e }).stroke({ ...OL, width: 3 });
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

// ---- solid ground ---------------------------------------------------------------------------

function drawSolid(s: Box, t: Theme, rand: () => number) {
  const g = new Graphics();
  const x0 = px(s.x0);
  const W = px(s.x1 - s.x0);
  const top = py(s.y1);
  const depth = Math.min(s.y1 - s.y0, 7) * U;

  g.roundRect(x0, top, W, depth, 12).fill({ color: t.earth }).stroke(OL);
  if (t.stone && depth > 1.5 * U) {
    // paved bricks
    for (let row = 0; row * 38 < depth; row++) {
      const y = top + 26 + row * 38;
      g.moveTo(x0 + 3, y).lineTo(x0 + W - 3, y).stroke({ width: 2.5, color: t.earthDark });
      for (let x = x0 + (row % 2 ? 30 : 0); x < x0 + W; x += 60) g.moveTo(x, y).lineTo(x, y + 38).stroke({ width: 2.5, color: t.earthDark });
    }
  } else if (depth > 1.5 * U) {
    for (let i = 0; i < W / 26; i++) {
      const cx = x0 + 14 + rand() * (W - 28);
      const cy = top + 50 + rand() * Math.max(10, depth - 70);
      g.ellipse(cx, cy, 5 + rand() * 9, 4 + rand() * 6).fill({ color: rand() < 0.5 ? t.earthDark : 0xa07a58 });
    }
  }

  // cap: grass with a scalloped lower edge, or a paved slab
  const capH = t.stone ? 30 : 36;
  const pts: number[] = [x0, top];
  const n = Math.max(2, Math.round(W / 26));
  pts.push(x0 + W, top);
  for (let i = n; i >= 0; i--) {
    const x = x0 + (W * i) / n;
    pts.push(x, top + Math.min(capH, depth - 14) + (i % 2 ? Math.min(12, depth * 0.2) : 0) + (t.stone || depth < 1.5 * U ? 0 : rand() * 6));
  }
  g.poly(pts).fill({ color: t.grass }).stroke(OL);
  g.rect(x0 + 6, top + 5, W - 12, 7).fill({ color: t.grassLight, alpha: 0.9 });
  if (!t.stone) {
    for (let x = x0 + 20; x < x0 + W - 12; x += 34 + rand() * 40) {
      g.poly([x, top, x + 5, top - 14, x + 10, top]).fill({ color: t.grassLight }).stroke({ ...OL, width: 2.5 });
    }
  }
  return g;
}

// ---- level ----------------------------------------------------------------------------------

export function buildLevel(def: LevelDef): Level {
  const theme = THEMES[def.theme];
  const rand = rng(7);
  const back = new Container();
  const front = new Container();
  const layers: Layer[] = [];

  const solids: Box[] = [
    ...def.ground.map(([x0, x1]): Box => ({ x0, x1, y0: -6, y1: 0 })),
    ...def.floating.map(([x0, x1, top]): Box => ({ x0, x1, y0: top - 0.8, y1: top })),
  ];
  const first = Math.min(...def.ground.map((g) => g[0]));
  const last = Math.max(...def.ground.map((g) => g[1]));

  // sky: screen-fixed gradient (resized with the window)
  const sky = new Graphics();

  const addLayer = (f: number, build: (c: Container, from: number, to: number) => void) => {
    const c = new Container();
    // layer space covers what the camera can see: world x range scaled by f, plus a screen's worth of margin
    build(c, px(first - 40) * f - 2200, px(last + 40) * f + 2200);
    back.addChild(c);
    layers.push({ c, f });
    return c;
  };

  // celestial body and stars
  addLayer(0.04, (c, from, to) => {
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
  const cloudLayer = addLayer(0.1, (c, from, to) => {
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
  void cloudLayer;

  if (def.theme === 'cemetery') {
    addLayer(0.25, (c, from, to) => {
      c.addChild(hills(from, to, 40, 340, theme.far, 3));
      for (let x = from + 80; x < to; x += 260 + rand() * 200) {
        const t = deadTree(rand, 150 + rand() * 90, 0x3a2c66);
        t.position.set(x, 0);
        c.addChild(t);
      }
    });
    addLayer(0.5, (c, from, to) => {
      c.addChild(hills(from, to, 80, 220, theme.mid, 5));
      for (let x = from + 40; x < to; x += 150 + rand() * 120) {
        const gs = gravestone(rand);
        gs.scale.set(0.8);
        gs.position.set(x, 20 + rand() * 10);
        gs.tint = 0x8f84c8;
        c.addChild(gs);
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

  // ---- gameplay layer: platforms and decor in front of the parallax ----
  const stage = new Container();
  back.addChild(stage);

  const place = (g: Container, x: number, scale = 1, y = 0) => {
    g.position.set(px(x), py(y));
    g.scale.set(scale);
    stage.addChild(g);
    return g;
  };

  const flames: Container[] = [];
  const glows: Graphics[] = [];

  // decor first (behind platform edges)
  if (def.theme === 'cemetery') {
    for (let x = first; x < last + 5; x += 3.4) {
      if (rand() < 0.3) continue;
      const r = rand();
      if (r < 0.55) place(gravestone(rand), x + rand() * 2, 0.9 + rand() * 0.4);
      else if (r < 0.75) place(pumpkin(22 + rand() * 12), x + rand() * 2);
      else place(rock(26 + rand() * 12), x + rand() * 2);
    }
    for (let x = first + 2; x < last; x += 14 + rand() * 6) place(fence(4 + Math.floor(rand() * 3)), x);
    for (let x = first + 8; x < last; x += 22 + rand() * 8) place(deadTree(rand, 220 + rand() * 90), x);
  } else if (def.theme === 'forest') {
    for (let x = first; x < last; x += 3) {
      if (rand() < 0.4) continue;
      const r = rand();
      if (r < 0.35) place(bush(24 + rand() * 14, 0x4faa3e), x + rand() * 2);
      else if (r < 0.6) place(mushroom(24 + rand() * 12), x + rand() * 2);
      else if (r < 0.8) place(rock(24 + rand() * 12), x + rand() * 2);
      else place(pumpkin(20 + rand() * 10), x + rand() * 2);
    }
    for (let x = first + 6; x < last; x += 16 + rand() * 6) place(roundTree(230 + rand() * 90, 0x3f9a46), x);
  } else {
    for (let x = first + 6; x < last; x += 14 + rand() * 5) place(column(300 + rand() * 40, 0x8a84ad), x);
    for (let x = first + 9; x < last; x += 19 + rand() * 5) place(banner(150), x, 1, 4.2);
    for (let x = first + 3; x < last; x += 9) {
      if (def.checkpoints.some((c) => Math.abs(c - x) < 4)) continue;
      place(torch(), x, 1, 2.6);
      const f = flame(16, 38, 0xffa02e, 0xffe27a);
      f.position.set(px(x), py(2.6) - 50);
      stage.addChild(f);
      flames.push(f);
    }
    for (let x = first + 5; x < last; x += 5 + rand() * 4) {
      if (rand() < 0.3) continue;
      const r = rand();
      place(r < 0.4 ? barrel() : r < 0.8 ? crate() : rock(30), x);
    }
    for (let x = first + 30; x < last; x += 45) place(chest(), x);
  }

  for (const s of solids) stage.addChild(drawSolid(s, theme, rand));

  // checkpoints (campfires)
  const fires: { x: number; flame: Container; glow: Graphics; lit: boolean }[] = [];
  for (const x of def.checkpoints) {
    place(campfire(), x);
    const glow = new Graphics().circle(0, 0, 130).fill({ color: 0xffa040, alpha: 0.22 });
    glow.position.set(px(x), py(0.9));
    glow.visible = false;
    const f = flame(26, 70, 0xff8a1e, 0xffe27a);
    f.position.set(px(x), py(0.3));
    f.visible = false;
    stage.addChild(glow, f);
    fires.push({ x, flame: f, glow, lit: false });
    flames.push(f);
    glows.push(glow);
  }

  // goal flag
  const goal = new Container();
  const pole = new Graphics().roundRect(-5, -300, 10, 300, 4).fill({ color: 0xe8e4f4 }).stroke({ ...OL, width: 4 });
  const flagG = new Graphics().poly([5, -296, 110, -270, 5, -236]).fill({ color: 0xffc83d }).stroke(OL);
  flagG.star(48, -266, 5, 14, 6).fill({ color: 0xffffff }).stroke({ ...OL, width: 2.5 });
  const ball = new Graphics().circle(0, -304, 10).fill({ color: 0xffc83d }).stroke({ ...OL, width: 4 });
  goal.addChild(pole, flagG, ball);
  goal.position.set(px(def.goalX), 0);
  goal.visible = !def.boss;
  stage.addChild(goal);

  // boss arena: stone pillars that rise when the fight starts
  const arenaWalls: Box[] = [];
  const arenaGfx: Container[] = [];
  if (def.boss) {
    const [a0, a1] = def.boss.arena;
    for (const [x0, x1] of [[a0 - 0.8, a0], [a1, a1 + 0.8]] as const) {
      arenaWalls.push({ x0, x1, y0: -6, y1: 16 });
      const w = new Graphics();
      w.roundRect(px(x0), py(16), px(x1 - x0), 22 * U, 8).fill({ color: theme.earth }).stroke(OL);
      for (let y = 0; y < 22 * U; y += 52) w.moveTo(px(x0) + 3, py(16) + y).lineTo(px(x1) - 3, py(16) + y).stroke({ width: 3, color: theme.earthDark });
      w.visible = false;
      stage.addChild(w);
      arenaGfx.push(w);
    }
  }

  return {
    def, back, front, sky, solids, theme, goal, arenaWalls, arenaGfx,
    update(camX, camY, dt) {
      const cx = px(camX);
      const cy = py(camY);
      for (const { c, f } of layers) {
        c.x = cx * (1 - f);
        c.y = cy * (1 - f) * 0.8;
      }
      for (const cl of clouds) cl.x += dt * 8;
      const pulse = 1 + Math.sin(performance.now() / 90) * 0.1;
      for (const f of flames) f.scale.set(pulse, 1 + (pulse - 1) * 2.2);
      for (const g of glows) g.alpha = 0.8 + Math.sin(performance.now() / 160) * 0.2;
    },
    light(upTo) {
      for (const f of fires) {
        f.lit = upTo !== null && f.x <= upTo;
        f.flame.visible = f.lit;
        f.glow.visible = f.lit;
      }
    },
    resizeSky(w, h) {
      sky.clear();
      const grad = new FillGradient({ type: 'linear', start: { x: 0, y: 0 }, end: { x: 0, y: 1 }, colorStops: [{ offset: 0, color: theme.skyTop }, { offset: 1, color: theme.skyBottom }], textureSpace: 'local' });
      sky.rect(0, 0, w, h).fill(grad);
    },
  };
}
