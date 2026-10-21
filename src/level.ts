import * as THREE from 'three';
import type { Box } from './physics';
import type { LevelDef } from './data/levels';
import { cloneProp } from './models';

export interface Level {
  def: LevelDef;
  group: THREE.Group;
  solids: Box[];
}

// Small deterministic RNG so decor is stable between runs.
function rng(seed: number) {
  return () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
}

const mat = (color: number, extra: THREE.MeshStandardMaterialParameters = {}) =>
  new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 1, ...extra });

export function buildLevel(def: LevelDef): Level {
  const group = new THREE.Group();
  const rand = rng(7);

  const solids: Box[] = [
    ...def.ground.map(([x0, x1]): Box => ({ x0, x1, y0: -6, y1: 0 })),
    ...def.floating.map(([x0, x1, top]): Box => ({ x0, x1, y0: top - 0.8, y1: top })),
  ];

  const stone = mat(0x3a3548);
  const grass = mat(0x2f5d3a);
  for (const s of solids) {
    const w = s.x1 - s.x0;
    const h = s.y1 - s.y0;
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, 5), stone);
    body.position.set((s.x0 + s.x1) / 2, (s.y0 + s.y1) / 2, -0.5);
    const top = new THREE.Mesh(new THREE.BoxGeometry(w, 0.25, 5.1), grass);
    top.position.set((s.x0 + s.x1) / 2, s.y1 - 0.12, -0.5);
    group.add(body, top);
  }

  const first = Math.min(...def.ground.map((g) => g[0]));
  const last = Math.max(...def.ground.map((g) => g[1]));

  // Background decor at several depths: tombstones and dead trees.
  const place = (name: string, x: number, y: number, z: number, height: number, rotY = 0) => {
    const p = cloneProp(name, height);
    p.position.set(x, y, z);
    p.rotation.y = rotY;
    group.add(p);
    return p;
  };
  const pick = <T,>(list: T[]) => list[Math.floor(rand() * list.length)];

  // Mid-ground (just behind the gameplay plane): graves, crosses, fences.
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

  // Far background: trees and the odd crypt, increasingly buried in fog.
  for (let x = first - 6; x < last + 10; x += 2.6) {
    const z = -5 - rand() * 14;
    place(pick(['pine', 'pine-crooked', 'pine-fall']), x + rand() * 2, 0, z, 4 + rand() * 4);
  }
  for (let x = first + 20; x < last; x += 38) place(pick(['crypt', 'crypt-small']), x, 0, -9, 5);

  const moon = new THREE.Mesh(
    new THREE.SphereGeometry(5, 16, 12),
    new THREE.MeshBasicMaterial({ color: 0xe9e4c8, fog: false }),
  );
  moon.position.set((first + last) / 2, 26, -90);
  group.add(moon);

  // Campfires (checkpoints)
  const flame = mat(0xff9a2e, { emissive: 0xff6a00, emissiveIntensity: 1.2 });
  for (const x of def.checkpoints) {
    place('fire-basket', x, 0, 0, 1.0);
    const f = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.8, 5), flame);
    f.position.set(x, 1.1, 0);
    f.name = 'flame';
    group.add(f);
  }

  const pole = new THREE.Mesh(new THREE.BoxGeometry(0.2, 5, 0.2), mat(0xcccccc));
  pole.position.set(def.goalX, 2.5, 0);
  const flag = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1, 0.1), mat(0xffc857, { emissive: 0xffa500, emissiveIntensity: 0.6 }));
  flag.position.set(def.goalX + 0.9, 4.4, 0);
  group.add(pole, flag);

  return { def, group, solids };
}
