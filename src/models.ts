import * as THREE from 'three';
import { GLTFLoader, GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { toonify } from './toon';

const cache = new Map<string, GLTF>();

// Names are paths under public/models (without extension); '.gltf' ones carry their extension.
export const MODEL_NAMES = [
  // characters (KayKit)
  'kk/kk_Knight', 'kk/kk_Barbarian', 'kk/kk_Rogue_Hooded',
  'kk/kk_Skeleton_Rogue', 'kk/kk_Skeleton_Mage', 'kk/kk_Skeleton_Minion',
  'kk/Skeleton_Crossbow.gltf', 'kk/Skeleton_Staff.gltf',
  // cemetery and forest props (Kenney)
  'grave', 'gravestone-bevel', 'gravestone-broken', 'gravestone-cross', 'gravestone-cross-large',
  'gravestone-round', 'gravestone-wide', 'gravestone-decorative', 'cross', 'cross-wood',
  'fence', 'fence-damaged', 'iron-fence', 'iron-fence-damaged', 'lantern-glass', 'lightpost-single',
  'crypt-small', 'crypt', 'coffin', 'pine', 'pine-crooked', 'pine-fall', 'rocks', 'rocks-tall',
  'fire-basket', 'candle-multiple', 'pumpkin-carved', 'crypt-large', 'hay-bale', 'pumpkin', 'lantern-candle',
  // castle props (KayKit dungeon)
  'kk/dg_wall', 'kk/dg_wall_arched', 'kk/dg_wall_broken', 'kk/dg_wall_cracked', 'kk/dg_wall_window_open',
  'kk/dg_wall_archedwindow_open', 'kk/dg_wall_half', 'kk/dg_wall_pillar', 'kk/dg_column', 'kk/dg_pillar',
  'kk/dg_pillar_decorated', 'kk/dg_torch_mounted', 'kk/dg_torch_lit', 'kk/dg_banner_patternA_red',
  'kk/dg_banner_thin_red', 'kk/dg_banner_red', 'kk/dg_banner_shield_red', 'kk/dg_banner_patternB_red',
  'kk/dg_barrel_large', 'kk/dg_barrel_small_stack', 'kk/dg_crates_stacked', 'kk/dg_box_stacked',
  'kk/dg_chest', 'kk/dg_chest_gold', 'kk/dg_rubble_large', 'kk/dg_rubble_half', 'kk/dg_candle_triple',
  'kk/dg_keg', 'kk/dg_stairs_walled', 'kk/dg_barrier', 'kk/dg_barrier_column', 'kk/dg_sword_shield_broken',
];

export async function loadModels(names: string[] = MODEL_NAMES, onProgress?: (done: number, total: number) => void) {
  const loader = new GLTFLoader();
  const base = import.meta.env.BASE_URL;
  let done = 0;
  await Promise.all(
    names.map(async (n) => {
      const file = n.includes('.') ? n : `${n}.glb`;
      cache.set(n, await loader.loadAsync(`${base}models/${file}`));
      onProgress?.(++done, names.length);
    }),
  );
}

export function getModel(name: string): GLTF {
  const m = cache.get(name);
  if (!m) throw new Error(`model not loaded: ${name}`);
  return m;
}

const OUTLINE_WORLD = 0.04; // outline thickness in world units

// A cartoon-shaded, outlined clone of the model, scaled to `height` (world units), feet on y=0.
export function cloneProp(name: string, height: number): THREE.Group {
  const scene = clone(getModel(name).scene);
  const box = new THREE.Box3().setFromObject(scene);
  const s = height / Math.max(0.001, box.max.y - box.min.y);
  toonify(scene, { outline: OUTLINE_WORLD / s });
  scene.scale.setScalar(s);
  scene.position.y = -box.min.y * s;
  const g = new THREE.Group();
  g.add(scene);
  return g;
}

// Width / height ratio of a model, used to tile wall segments edge to edge.
export function aspect(name: string) {
  const box = new THREE.Box3().setFromObject(getModel(name).scene);
  return (box.max.x - box.min.x) / Math.max(0.001, box.max.y - box.min.y);
}
