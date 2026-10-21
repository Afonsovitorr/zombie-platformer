import * as THREE from 'three';
import type { Box } from './physics';
import type { LevelDef } from './data/levels';
import { cloneProp } from './models';

export interface Theme {
  sky: number;
  fog: [near: number, far: number];
  hemi: [sky: number, ground: number];
  moon: number;
  stone: boolean; // paved tops instead of grass
}

export const THEMES: Record<LevelDef['theme'], Theme> = {
  cemetery: { sky: 0x14102a, fog: [25, 70], hemi: [0x8c9bd6, 0x2a1f33], moon: 0xe9e4c8, stone: false },
  forest: { sky: 0x08171a, fog: [16, 55], hemi: [0x7fbfa8, 0x1a2a22], moon: 0xcfe6d8, stone: false },
  castle: { sky: 0x1b0d14, fog: [22, 65], hemi: [0xb89098, 0x2a1418], moon: 0xe8a58f, stone: true },
};

export interface Level {
  def: LevelDef;
  group: THREE.Group;
  solids: Box[];
  theme: Theme;
  goal: THREE.Object3D;
  arenaWalls: Box[]; // become solid while the boss fight is locked
  arenaMeshes: THREE.Object3D[];
}

const flameMat = new THREE.MeshStandardMaterial({ color: 0xff9a2e, emissive: 0xff6a00, emissiveIntensity: 1.2, flatShading: true });

// Small deterministic RNG so decor is stable between runs.
function rng(seed: number) {
  return () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
}

const mat = (color: number, extra: THREE.MeshStandardMaterialParameters = {}) =>
  new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 1, ...extra });


function canvasTexture(size: number, draw: (g: CanvasRenderingContext2D) => void) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d')!);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Dark stone bricks in running bond with a little shade variation.
function makeStoneTexture() {
  const rand = rng(3);
  return canvasTexture(128, (g) => {
    g.fillStyle = '#2a2638';
    g.fillRect(0, 0, 128, 128);
    for (let row = 0; row < 4; row++) {
      const off = row % 2 ? 32 : 0;
      for (let col = -1; col < 3; col++) {
        const l = 52 + rand() * 14;
        g.fillStyle = `hsl(255 ${12 + rand() * 8}% ${l * 0.62}%)`;
        g.fillRect(col * 64 + off + 2, row * 32 + 2, 60, 28);
      }
    }
  });
}

function makeGrassTexture() {
  const rand = rng(11);
  return canvasTexture(128, (g) => {
    g.fillStyle = '#2f5d3a';
    g.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 260; i++) {
      g.fillStyle = `hsl(${120 + rand() * 25} ${35 + rand() * 20}% ${16 + rand() * 16}%)`;
      g.fillRect(rand() * 128, rand() * 128, 2 + rand() * 4, 2 + rand() * 6);
    }
  });
}

export function buildLevel(def: LevelDef): Level {
  const group = new THREE.Group();
  const rand = rng(7);

  const solids: Box[] = [
    ...def.ground.map(([x0, x1]): Box => ({ x0, x1, y0: -6, y1: 0 })),
    ...def.floating.map(([x0, x1, top]): Box => ({ x0, x1, y0: top - 0.8, y1: top })),
  ];

  const stoneTex = makeStoneTexture();
  const grassTex = makeGrassTexture();
  const textured = (base: THREE.CanvasTexture, repX: number, repY: number) => {
    const t = base.clone();
    t.repeat.set(repX, repY);
    t.needsUpdate = true;
    return new THREE.MeshStandardMaterial({ map: t, flatShading: true, roughness: 1 });
  };
  for (const s of solids) {
    const w = s.x1 - s.x0;
    const h = s.y1 - s.y0;
    const cx = (s.x0 + s.x1) / 2;
    const side = textured(stoneTex, Math.max(1, w / 2), Math.max(1, Math.min(h, 6) / 2));
    const front = textured(stoneTex, Math.max(1, w / 2), Math.max(1, Math.min(h, 6) / 2));
    const ends = textured(stoneTex, 2, Math.max(1, Math.min(h, 6) / 2));
    const lid = textured(def.theme === 'castle' ? stoneTex : grassTex, w / 2, 2.5);
    // box faces: +x, -x, +y, -y, +z (toward camera), -z
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, 5), [ends, ends, lid, side, front, side]);
    body.position.set(cx, (s.y0 + s.y1) / 2, -0.5);
    // mossy lip along the top edge facing the camera
    const lip = new THREE.Mesh(new THREE.BoxGeometry(w + 0.2, 0.28, 5.2), textured(def.theme === 'castle' ? stoneTex : grassTex, w / 2, 2.5));
    lip.position.set(cx, s.y1 - 0.12, -0.5);
    group.add(body, lip);
  }


  const first = Math.min(...def.ground.map((g) => g[0]));
  const last = Math.max(...def.ground.map((g) => g[1]));

  const place = (name: string, x: number, y: number, z: number, height: number, rotY = 0) => {
    const p = cloneProp(name, height);
    p.position.set(x, y, z);
    p.rotation.y = rotY;
    group.add(p);
    return p;
  };
  const pick = <T,>(list: T[]) => list[Math.floor(rand() * list.length)];
  const theme = THEMES[def.theme];

  if (def.theme === 'cemetery') {
    // Mid-ground: graves, crosses, fences.
    const graves = ['gravestone-bevel', 'gravestone-broken', 'gravestone-cross', 'gravestone-round', 'gravestone-wide', 'gravestone-decorative', 'cross', 'cross-wood'];
    for (let x = first; x < last + 5; x += 3.2) {
      if (rand() < 0.3) continue;
      place(pick(graves), x + rand() * 2, 0, -2.3 - rand() * 1.2, 1.2 + rand() * 0.7, (rand() - 0.5) * 0.6);
    }
    for (let x = first + 2; x < last; x += 12 + rand() * 6) {
      place(pick(['fence', 'fence-damaged', 'iron-fence', 'iron-fence-damaged']), x, 0, -1.6, 1.3);
      place('fence', x + 2, 0, -1.6, 1.3);
    }
    for (let x = first + 6; x < last; x += 15 + rand() * 6) place('lightpost-single', x, 0, -1.8, 3.4);
    for (let x = first - 6; x < last + 10; x += 2.6) {
      place(pick(['pine', 'pine-crooked', 'pine-fall']), x + rand() * 2, 0, -5 - rand() * 14, 4 + rand() * 4);
    }
    for (let x = first + 20; x < last; x += 38) place(pick(['crypt', 'crypt-small']), x, 0, -9, 5);
  } else if (def.theme === 'forest') {
    // Dense, tall trees in several depth layers; rocks, pumpkins and hay between them.
    for (let x = first - 8; x < last + 12; x += 1.7) {
      place(pick(['pine', 'pine', 'pine-crooked', 'pine-fall']), x + rand() * 1.5, 0, -3 - rand() * 18, 5 + rand() * 6);
    }
    for (let x = first; x < last; x += 4) {
      if (rand() < 0.45) continue;
      place(pick(['rocks', 'rocks-tall', 'pumpkin', 'hay-bale', 'pine-crooked']), x + rand() * 3, 0, -2.2 - rand() * 1.2, 1.1 + rand() * 1.0, rand() * 6);
    }
    for (let x = first + 8; x < last; x += 18 + rand() * 6) place('lantern-candle', x, 0, -1.8, 1.2);
    for (let x = first + 14; x < last; x += 30 + rand() * 10) place('gravestone-cross-large', x, 0, -2.4, 2.0);
  } else {
    // Castle ruins: broken walls, columns, braziers and a dead tree or two behind.
    for (let x = first - 4; x < last + 6; x += 4.2) {
      place(pick(['stone-wall', 'stone-wall-damaged', 'brick-wall']), x, 0, -6.5, 3.5 + rand() * 1.5);
    }
    for (let x = first + 4; x < last; x += 16 + rand() * 4) place(pick(['column-large', 'pillar-large']), x, 0, -5.5, 5 + rand() * 1.5);
    for (let x = first + 9; x < last; x += 17 + rand() * 6) place(pick(['pillar-square', 'pillar-obelisk', 'urn-round']), x, 0, -2.4, 2.2);
    for (let x = first + 25; x < last; x += 32) place('crypt-large', x, 0, -11, 9);
    for (let x = first; x < last; x += 22) place(pick(['pine-fall', 'pine-crooked']), x + rand() * 6, 0, -9 - rand() * 6, 6);
    for (let x = first + 5; x < last; x += 11) {
      if (def.checkpoints.some((c) => Math.abs(c - x) < 5)) continue;
      place('fire-basket', x, 0, -1.6, 1.0);
      const f = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.8, 5), flameMat);
      f.position.set(x, 1.1, -1.6);
      f.name = 'flame';
      group.add(f);
    }
  }

  const moon = new THREE.Mesh(
    new THREE.SphereGeometry(5, 16, 12),
    new THREE.MeshBasicMaterial({ color: theme.moon, fog: false }),
  );
  moon.position.set((first + last) / 2, 26, -90);
  group.add(moon);

  // Campfires (checkpoints)
  for (const x of def.checkpoints) {
    place('fire-basket', x, 0, 0, 1.0);
    const f = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.8, 5), flameMat);
    f.position.set(x, 1.1, 0);
    f.name = 'flame';
    group.add(f);
  }

  // Goal banner; on a boss level it only appears once the boss is down.
  const goal = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.BoxGeometry(0.2, 5, 0.2), mat(0xcccccc));
  pole.position.set(def.goalX, 2.5, 0);
  const flag = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1, 0.1), mat(0xffc857, { emissive: 0xffa500, emissiveIntensity: 0.6 }));
  flag.position.set(def.goalX + 0.9, 4.4, 0);
  goal.add(pole, flag);
  goal.visible = !def.boss;
  group.add(goal);

  // Boss arena: walls that rise when the fight starts (their boxes are only solid while locked).
  const arenaWalls: Box[] = [];
  const arenaMeshes: THREE.Object3D[] = [];
  if (def.boss) {
    const [a0, a1] = def.boss.arena;
    for (const [x0, x1] of [[a0 - 0.8, a0], [a1, a1 + 0.8]] as const) {
      arenaWalls.push({ x0, x1, y0: -6, y1: 16 });
      const wall = new THREE.Mesh(
        new THREE.BoxGeometry(x1 - x0, 22, 5),
        textured(stoneTex, 1, 8),
      );
      wall.position.set((x0 + x1) / 2, 5, -0.5);
      wall.visible = false;
      group.add(wall);
      arenaMeshes.push(wall);
    }
    for (const x of [a0 + 3, a1 - 3]) place('pillar-large', x, 0, -2.6, 7);
  }

  return { def, group, solids, theme, goal, arenaWalls, arenaMeshes };
}
