import * as THREE from 'three';
import type { Box } from './physics';

export interface Level {
  group: THREE.Group;
  solids: Box[];
  spawns: number[];
  goalX: number;
}

const ground = (x0: number, x1: number): Box => ({ x0, x1, y0: -6, y1: 0 });
const floating = (x0: number, x1: number, top: number): Box => ({ x0, x1, y0: top - 0.8, y1: top });

const SOLIDS: Box[] = [
  ground(-12, 28), ground(32, 58), ground(62, 88), ground(92, 125),
  floating(10, 15, 3), floating(17, 22, 5.8),
  floating(40, 45, 3), floating(47, 52, 4.6),
  floating(70, 75, 3), floating(77, 82, 5.8),
  floating(100, 106, 3),
];

const SPAWNS = [14, 24, 38, 50, 66, 74, 84, 98, 108, 114];

// Small deterministic RNG so decor is stable between runs.
function rng(seed: number) {
  return () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
}

const mat = (color: number, extra: THREE.MeshStandardMaterialParameters = {}) =>
  new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 1, ...extra });

export function buildLevel(): Level {
  const group = new THREE.Group();
  const rand = rng(7);

  const stone = mat(0x3a3548);
  const grass = mat(0x2f5d3a);
  for (const s of SOLIDS) {
    const w = s.x1 - s.x0;
    const h = s.y1 - s.y0;
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, 5), stone);
    body.position.set((s.x0 + s.x1) / 2, (s.y0 + s.y1) / 2, -0.5);
    const top = new THREE.Mesh(new THREE.BoxGeometry(w, 0.25, 5.1), grass);
    top.position.set((s.x0 + s.x1) / 2, s.y1 - 0.12, -0.5);
    group.add(body, top);
  }

  // Background decor at several depths: tombstones, dead trees, fence posts.
  const tomb = mat(0x6b6880);
  const wood = mat(0x2a2024);
  for (let x = -10; x < 130; x += 2.2) {
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
  for (let x = 0; x < 125; x += 17 + rand() * 8) {
    const h = 6 + rand() * 4;
    const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.9, h, 0.9), dark);
    pillar.position.set(x, h / 2 - 1, 6);
    group.add(pillar);
  }

  // Moon, far back; it also acts as the scene's dominant mood light.
  const moon = new THREE.Mesh(
    new THREE.SphereGeometry(5, 16, 12),
    new THREE.MeshBasicMaterial({ color: 0xe9e4c8, fog: false }),
  );
  moon.position.set(30, 26, -90);
  group.add(moon);

  // Goal banner
  const goalX = 120;
  const pole = new THREE.Mesh(new THREE.BoxGeometry(0.2, 5, 0.2), mat(0xcccccc));
  pole.position.set(goalX, 2.5, 0);
  const flag = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1, 0.1), mat(0xffc857, { emissive: 0xffa500, emissiveIntensity: 0.6 }));
  flag.position.set(goalX + 0.9, 4.4, 0);
  group.add(pole, flag);

  return { group, solids: SOLIDS, spawns: SPAWNS, goalX };
}
