import * as THREE from 'three';
import { GLTFLoader, GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';

const cache = new Map<string, GLTF>();

export const MODEL_NAMES = [
  'character-keeper', 'character-zombie', 'character-skeleton',
  'grave', 'gravestone-bevel', 'gravestone-broken', 'gravestone-cross', 'gravestone-cross-large',
  'gravestone-round', 'gravestone-wide', 'gravestone-decorative', 'cross', 'cross-wood',
  'fence', 'fence-damaged', 'iron-fence', 'iron-fence-damaged', 'lantern-glass', 'lightpost-single',
  'crypt-small', 'crypt', 'coffin', 'pine', 'pine-crooked', 'pine-fall', 'trunk', 'rocks', 'rocks-tall',
  'fire-basket', 'candle-multiple', 'pumpkin-carved',
];

export async function loadModels(names: string[] = MODEL_NAMES) {
  const loader = new GLTFLoader();
  const base = import.meta.env.BASE_URL;
  await Promise.all(
    names.map(async (n) => {
      cache.set(n, await loader.loadAsync(`${base}models/${n}.glb`));
    }),
  );
}

export function getModel(name: string): GLTF {
  const m = cache.get(name);
  if (!m) throw new Error(`model not loaded: ${name}`);
  return m;
}

// A clone of the model scene, scaled to `height` (world units) with its feet on y=0.
export function cloneProp(name: string, height: number): THREE.Group {
  const scene = clone(getModel(name).scene);
  const box = new THREE.Box3().setFromObject(scene);
  const s = height / Math.max(0.001, box.max.y - box.min.y);
  scene.scale.setScalar(s);
  scene.position.y = -box.min.y * s;
  const g = new THREE.Group();
  g.add(scene);
  return g;
}
