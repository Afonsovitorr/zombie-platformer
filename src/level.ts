import * as THREE from 'three';
import type { Box } from './physics';
import type { LevelDef } from './data/levels';
import { cloneProp, aspect } from './models';
import { toonMaterial } from './toon';

export interface Theme {
  sky: number; // horizon / fog colour
  skyTop: number;
  fog: [near: number, far: number];
  hemi: [sky: number, ground: number];
  sun: number;
  moon: number;
  cloud: number;
  stone: boolean; // paved tops instead of grass
}

export const THEMES: Record<LevelDef['theme'], Theme> = {
  cemetery: { sky: 0x7a64c4, skyTop: 0x2c2160, fog: [30, 90], hemi: [0xc2b4ff, 0x4a3a66], sun: 0xd8e0ff, moon: 0xfff2b8, cloud: 0xb9a8f0, stone: false },
  forest: { sky: 0x3c9c86, skyTop: 0x0f3a3c, fog: [22, 75], hemi: [0xb0f4d8, 0x2c4a36], sun: 0xe0ffe8, moon: 0xeaffd8, cloud: 0x8fd8c0, stone: false },
  castle: { sky: 0xc8566e, skyTop: 0x3a1534, fog: [28, 85], hemi: [0xffc8c0, 0x52283a], sun: 0xffdcc0, moon: 0xffd8a8, cloud: 0xe89aa8, stone: true },
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
    g.fillStyle = '#4a4468';
    g.fillRect(0, 0, 128, 128);
    for (let row = 0; row < 4; row++) {
      const off = row % 2 ? 32 : 0;
      for (let col = -1; col < 3; col++) {
        const l = 52 + rand() * 14;
        g.fillStyle = `hsl(${248 + rand() * 20} ${22 + rand() * 12}% ${l * 0.85}%)`;
        g.fillRect(col * 64 + off + 2, row * 32 + 2, 60, 28);
      }
    }
  });
}

function makeGrassTexture() {
  const rand = rng(11);
  return canvasTexture(128, (g) => {
    g.fillStyle = '#3f8a4a';
    g.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 260; i++) {
      g.fillStyle = `hsl(${100 + rand() * 40} ${45 + rand() * 25}% ${26 + rand() * 20}%)`;
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
    return toonMaterial(t);
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
    // Castle ruins (KayKit dungeon kit): a wall of arches and windows, columns, banners, torches, clutter.
    const wallH = 5;
    const step = aspect('kk/dg_wall') * wallH;
    const walls = ['kk/dg_wall', 'kk/dg_wall_arched', 'kk/dg_wall_window_open', 'kk/dg_wall_broken', 'kk/dg_wall', 'kk/dg_wall_cracked'];
    for (let x = first - 4; x < last + 8; x += step) place(pick(walls), x + step / 2, 0, -6.5, wallH);
    for (let x = first + 6; x < last; x += 14 + rand() * 5) place('kk/dg_column', x, 0, -4.2, 5.5 + rand());
    for (let x = first + 9; x < last; x += 19 + rand() * 5) {
      place(pick(['kk/dg_banner_patternA_red', 'kk/dg_banner_thin_red', 'kk/dg_banner_shield_red', 'kk/dg_banner_patternB_red']), x, 1.4, -6.1, 3.2);
    }
    for (let x = first + 3; x < last; x += 9) {
      if (def.checkpoints.some((c) => Math.abs(c - x) < 4)) continue;
      place('kk/dg_torch_mounted', x, 2.4, -6.1, 1.3);
      const f = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.6, 5), flameMat);
      f.position.set(x, 3.95, -6.0);
      f.name = 'flame';
      group.add(f);
    }
    for (let x = first + 5; x < last; x += 6 + rand() * 5) {
      if (rand() < 0.35) continue;
      place(pick(['kk/dg_barrel_large', 'kk/dg_barrel_small_stack', 'kk/dg_crates_stacked', 'kk/dg_box_stacked', 'kk/dg_rubble_large', 'kk/dg_rubble_half', 'kk/dg_keg']), x, 0, -2.4 - rand() * 0.8, 1.4 + rand() * 0.7, rand() * 6);
    }
    for (let x = first + 30; x < last; x += 45) place(pick(['kk/dg_chest', 'kk/dg_chest_gold']), x, 0, -2.0, 1.0);
    for (let x = first; x < last + 8; x += 20) place('kk/dg_wall_arched', x + 6, 0, -13, 10);
  }

  // Sky dome: a vertical gradient from the horizon colour up to a darker zenith.
  const mid = (first + last) / 2;
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(400, 24, 12),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: { top: { value: new THREE.Color(theme.skyTop) }, bottom: { value: new THREE.Color(theme.sky) } },
      vertexShader: 'varying float h; void main(){ h = normalize(position).y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform vec3 top; uniform vec3 bottom; varying float h; void main(){ gl_FragColor = vec4(mix(bottom, top, smoothstep(0.0, 0.55, h)), 1.0); }',
    }),
  );
  dome.position.set(mid, 0, 0);
  dome.renderOrder = -1;
  group.add(dome);

  const moon = new THREE.Mesh(new THREE.SphereGeometry(7, 20, 14), new THREE.MeshBasicMaterial({ color: theme.moon, fog: false }));
  moon.position.set(mid + 25, 30, -150);
  group.add(moon);

  // Soft toon clouds that drift slowly across the sky.
  const cloudMat = toonMaterial(null, theme.cloud);
  for (let i = 0; i < 16; i++) {
    const cloud = new THREE.Group();
    cloud.name = 'cloud';
    for (let p = 0; p < 4; p++) {
      const puff = new THREE.Mesh(new THREE.IcosahedronGeometry(2.2 + rand() * 2.2, 1), cloudMat);
      puff.position.set((p - 1.5) * 3.2, rand() * 1.2, rand() * 2);
      puff.scale.y = 0.65;
      cloud.add(puff);
    }
    cloud.position.set(first - 60 + rand() * (last - first + 120), 16 + rand() * 22, -80 - rand() * 60);
    group.add(cloud);
  }

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
    for (const x of [a0 + 3, a1 - 3]) place('kk/dg_column', x, 0, -2.6, 7);
  }

  return { def, group, solids, theme, goal, arenaWalls, arenaMeshes };
}
