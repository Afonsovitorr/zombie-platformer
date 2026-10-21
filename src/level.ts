import * as THREE from 'three';
import type { Box } from './physics';
import type { LevelDef } from './data/levels';

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
  const tomb = mat(0x6b6880);
  const wood = mat(0x2a2024);
  for (let x = first; x < last + 5; x += 2.2) {
    const z = -2.5 - rand() * 9;
    const kind = rand();
    if (kind < 0.45) {
      const g = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.3 + rand() * 0.8, 0.3), tomb);
      g.position.set(x + rand(), 0.7, z);
      g.rotation.z = (rand() - 0.5) * 0.25;
      group.add(g);
    } else if (kind < 0.8) {
      const h = 3 + rand() * 3;
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.3, h, 5), wood);
      trunk.position.set(x, h / 2, z);
      const branch = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.14, 0.14), wood);
      branch.position.set(x + 0.6, h * 0.7, z);
      branch.rotation.z = 0.5;
      group.add(trunk, branch);
    }
  }

  // Foreground silhouettes give depth against the camera.
  const dark = mat(0x0d0b14);
  for (let x = first; x < last; x += 17 + rand() * 8) {
    const h = 6 + rand() * 4;
    const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.9, h, 0.9), dark);
    pillar.position.set(x, h / 2 - 1, 6);
    group.add(pillar);
  }

  const moon = new THREE.Mesh(
    new THREE.SphereGeometry(5, 16, 12),
    new THREE.MeshBasicMaterial({ color: 0xe9e4c8, fog: false }),
  );
  moon.position.set((first + last) / 2, 26, -90);
  group.add(moon);

  // Campfires (checkpoints)
  const log = mat(0x4a2f1c);
  const flame = mat(0xff9a2e, { emissive: 0xff6a00, emissiveIntensity: 1.2 });
  for (const x of def.checkpoints) {
    const a = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.18, 0.18), log);
    a.position.set(x, 0.12, 0);
    a.rotation.z = 0.25;
    const b = a.clone();
    b.rotation.z = -0.25;
    const f = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.9, 5), flame);
    f.position.set(x, 0.6, 0);
    f.name = 'flame';
    group.add(a, b, f);
  }

  const pole = new THREE.Mesh(new THREE.BoxGeometry(0.2, 5, 0.2), mat(0xcccccc));
  pole.position.set(def.goalX, 2.5, 0);
  const flag = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1, 0.1), mat(0xffc857, { emissive: 0xffa500, emissiveIntensity: 0.6 }));
  flag.position.set(def.goalX + 0.9, 4.4, 0);
  group.add(pole, flag);

  return { def, group, solids };
}
