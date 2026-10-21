import * as THREE from 'three';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { getModel } from './models';
import { toonify } from './toon';

interface PlayOpts {
  once?: boolean; // play a single time and hold the last frame
  fit?: number; // stretch the clip to last this many seconds
  speed?: number;
  fade?: number;
  restart?: boolean;
}

export interface ActorOpts {
  tint?: number;
  hue?: number;
  sat?: number;
  light?: number;
  gear?: string[]; // weapon/shield nodes to keep visible; every other one is hidden
  props?: string[]; // extra models to hold in the right hand
  hide?: string[]; // extra nodes to hide
}

const GEAR = /sword|shield|axe|staff|wand|crossbow|knife|dagger|bow|offhand/i;
const OUTLINE_WORLD = 0.03;

// A KayKit character: animated, cel-shaded model facing +x (the gameplay direction), feet on y=0.
export class Actor {
  readonly root = new THREE.Group();
  readonly scale: number; // world units per raw model unit
  private scene: THREE.Object3D;
  private mixer: THREE.AnimationMixer;
  private actions = new Map<string, THREE.AnimationAction>();
  private current: THREE.AnimationAction | null = null;
  private materials: THREE.MeshToonMaterial[] = [];

  constructor(modelName: string, height: number, o: ActorOpts = {}) {
    const gltf = getModel(modelName);
    this.scene = clone(gltf.scene);

    for (const h of o.hide ?? []) {
      const n = this.scene.getObjectByName(h);
      if (n) n.visible = false;
    }
    // hide unused weapons before measuring so they do not inflate the bounds
    const keep = o.gear ?? [];
    this.scene.traverse((n) => {
      if (GEAR.test(n.name) && !keep.includes(n.name) && (n as THREE.Mesh).isMesh) n.visible = false;
    });

    const box = new THREE.Box3();
    this.scene.traverse((n) => {
      const m = n as THREE.Mesh;
      if (m.isMesh && n.visible) box.expandByObject(n);
    });
    this.scale = height / Math.max(0.001, box.max.y - box.min.y);
    this.scene.position.y = -box.min.y;

    this.materials = toonify(this.scene, { tint: o.tint, hue: o.hue, sat: o.sat, light: o.light, outline: OUTLINE_WORLD / this.scale });

    for (const p of o.props ?? []) {
      const hand = this.node('handslot.r');
      if (!hand) continue;
      const prop = clone(getModel(p).scene);
      toonify(prop, { outline: OUTLINE_WORLD / this.scale });
      hand.add(prop);
    }

    const inner = new THREE.Group();
    inner.scale.setScalar(this.scale);
    inner.rotation.y = Math.PI / 2; // models face +z
    inner.add(this.scene);
    this.root.add(inner);

    this.mixer = new THREE.AnimationMixer(this.scene);
    for (const clip of gltf.animations) this.actions.set(clip.name, this.mixer.clipAction(clip));
  }

  node(name: string) {
    return this.scene.getObjectByName(name) ?? null;
  }

  has(name: string) {
    return this.actions.has(name);
  }

  play(name: string, o: PlayOpts = {}) {
    const next = this.actions.get(name) ?? this.actions.get('Idle');
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
