import * as THREE from 'three';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { getModel } from './models';

interface PlayOpts {
  once?: boolean; // play a single time and hold the last frame
  fit?: number; // stretch the clip to last this many seconds
  speed?: number;
  fade?: number;
  restart?: boolean;
}

// A Kenney character: animated model facing +x (the gameplay direction), feet on y=0.
export class Actor {
  readonly root = new THREE.Group();
  readonly scale: number; // world units per raw model unit
  private scene: THREE.Object3D;
  private mixer: THREE.AnimationMixer;
  private actions = new Map<string, THREE.AnimationAction>();
  private current: THREE.AnimationAction | null = null;
  private materials: THREE.MeshStandardMaterial[] = [];

  constructor(modelName: string, height: number, tint?: number) {
    const gltf = getModel(modelName);
    this.scene = clone(gltf.scene);

    const box = new THREE.Box3().setFromObject(this.scene);
    this.scale = height / (box.max.y - box.min.y);
    this.scene.position.y = -box.min.y;

    // each actor owns its materials so flashes and tints stay per-instance
    this.scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const mat = (mesh.material as THREE.MeshStandardMaterial).clone();
      if (tint !== undefined) mat.color.multiply(new THREE.Color(tint));
      mesh.material = mat;
      this.materials.push(mat);
    });

    const inner = new THREE.Group();
    inner.scale.setScalar(this.scale);
    inner.rotation.y = Math.PI / 2; // Kenney models face +z
    inner.add(this.scene);
    this.root.add(inner);

    this.mixer = new THREE.AnimationMixer(this.scene);
    for (const clip of gltf.animations) this.actions.set(clip.name, this.mixer.clipAction(clip));
  }

  node(name: string) {
    return this.scene.getObjectByName(name) ?? null;
  }

  play(name: string, o: PlayOpts = {}) {
    const next = this.actions.get(name);
    if (!next) return;
    const speed = o.fit ? next.getClip().duration / o.fit : (o.speed ?? 1);
    if (next === this.current && !o.restart) {
      next.timeScale = speed;
      return;
    }
    const fade = o.fade ?? 0.1;
    next.reset();
    next.setLoop(o.once ? THREE.LoopOnce : THREE.LoopRepeat, Infinity);
    next.clampWhenFinished = !!o.once;
    next.timeScale = speed;
    next.fadeIn(fade).play();
    this.current?.fadeOut(fade);
    this.current = next;
  }

  update(dt: number) {
    this.mixer.update(dt);
  }

  setEmissive(hex: number) {
    for (const m of this.materials) m.emissive.setHex(hex);
  }

  fadeEmissive(k: number) {
    for (const m of this.materials) m.emissive.lerp(new THREE.Color(0), k);
  }
}
