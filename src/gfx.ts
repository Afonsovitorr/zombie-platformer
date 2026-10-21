import { Assets, Container, Rectangle, Sprite, Texture } from 'pixi.js';

// World units are converted to pixels with U; y is flipped (world y grows up, screen y grows down).
export const U = 64;
export const px = (x: number) => x * U;
export const py = (y: number) => -y * U;

interface AnimMeta {
  file: string;
  frames: number;
  cols: number;
  step: number; // every how-manyth source frame the atlas kept (source runs at 30 fps)
}

interface SheetMeta {
  fw: number;
  fh: number;
  anchorX: number;
  anchorY: number;
  bodyH: number; // pixels from the feet to the top of the head
  anims: Record<string, AnimMeta>;
}

interface MonsterMeta {
  file: string;
  cw: number;
  ch: number;
  frames: number;
  anims: Record<string, number[]>;
}

const sheets: Record<string, SheetMeta> = {};
const monsters: Record<string, MonsterMeta> = {};
const monsterFrames = new Map<string, Texture[]>();
const frames = new Map<string, Texture[]>();

export async function loadSprites(onProgress: (k: number) => void) {
  const base = `${import.meta.env.BASE_URL}sprites/`;
  Object.assign(sheets, await (await fetch(`${base}manifest.json`)).json());
  Object.assign(monsters, await (await fetch(`${base}monsters.json`)).json());
  const jobs: { variant: string; anim: string; meta: AnimMeta }[] = [];
  for (const [variant, s] of Object.entries(sheets)) for (const [anim, meta] of Object.entries(s.anims)) jobs.push({ variant, anim, meta });
  let done = 0;
  const total = jobs.length + Object.keys(monsters).length;
  await Promise.all([
    ...Object.entries(monsters).map(async ([name, m]) => {
      const tex = await Assets.load<Texture>(`${base}${m.file}`);
      const list: Texture[] = [];
      for (let i = 0; i < m.frames; i++) list.push(new Texture({ source: tex.source, frame: new Rectangle(i * m.cw, 0, m.cw, m.ch) }));
      monsterFrames.set(name, list);
      onProgress(++done / total);
    }),
    ...
    jobs.map(async ({ variant, anim, meta }) => {
      const s = sheets[variant];
      const tex = await Assets.load<Texture>(`${base}${meta.file}`);
      const list: Texture[] = [];
      for (let i = 0; i < meta.frames; i++) {
        const frame = new Rectangle((i % meta.cols) * s.fw, Math.floor(i / meta.cols) * s.fh, s.fw, s.fh);
        list.push(new Texture({ source: tex.source, frame }));
      }
      frames.set(`${variant}/${anim}`, list);
      onProgress(++done / total);
    }),
  ]);
}

interface PlayOpts {
  once?: boolean; // hold the last frame
  fit?: number; // stretch the clip to last this many seconds
  speed?: number;
  restart?: boolean;
}

// An animated character built from a frame atlas. Faces +x; the root sits at the feet.
export class SpriteActor {
  readonly root = new Container();
  readonly sprite = new Sprite();
  readonly height: number; // display height of the body in world units
  private meta: SheetMeta;
  private scale: number;
  private anim = '';
  private list: Texture[] = [];
  private fps = 15;
  private t = 0;
  private looped = true;
  private hold = 0; // tint blend back to white
  private holdColor = 0xffffff;

  constructor(readonly variant: string, bodyUnits: number) {
    this.meta = sheets[variant];
    this.height = bodyUnits;
    this.scale = (bodyUnits * U) / this.meta.bodyH;
    this.sprite.anchor.set(this.meta.anchorX / this.meta.fw, this.meta.anchorY / this.meta.fh);
    this.sprite.scale.set(this.scale);
    this.root.addChild(this.sprite);
    this.play('idle');
  }

  has(name: string) {
    return frames.has(`${this.variant}/${name}`);
  }

  play(name: string, o: PlayOpts = {}) {
    const key = frames.has(`${this.variant}/${name}`) ? name : 'idle';
    const list = frames.get(`${this.variant}/${key}`)!;
    const meta = this.meta.anims[key];
    const fps = o.fit ? list.length / o.fit : (30 / meta.step) * (o.speed ?? 1);
    if (key === this.anim && !o.restart) {
      this.fps = fps;
      this.looped = !o.once;
      return;
    }
    this.anim = key;
    this.list = list;
    this.fps = fps;
    this.looped = !o.once;
    this.t = 0;
    this.sprite.texture = list[0];
  }

  // Shows the frame for a normalized progress (0..1) without advancing time: for gameplay-driven clips.
  scrub(name: string, k: number) {
    const key = frames.has(`${this.variant}/${name}`) ? name : 'idle';
    const list = frames.get(`${this.variant}/${key}`)!;
    this.anim = key;
    this.list = list;
    this.sprite.texture = list[Math.max(0, Math.min(list.length - 1, Math.floor(k * list.length)))];
  }

  get done() {
    return !this.looped && this.t * this.fps >= this.list.length - 1;
  }

  update(dt: number) {
    this.t += dt;
    const n = this.list.length;
    const i = Math.floor(this.t * this.fps);
    if (this.anim && n) this.sprite.texture = this.list[this.looped ? i % n : Math.min(n - 1, i)];
    if (this.hold > 0) {
      this.hold = Math.max(0, this.hold - dt * 6);
      this.sprite.tint = this.hold <= 0 ? 0xffffff : lerpColor(0xffffff, this.holdColor, this.hold);
    }
  }

  // Quick colour flash that fades back to normal: hit = reddish, stun = bluish.
  flash(color: number, strength = 1) {
    this.holdColor = color;
    this.hold = strength;
    this.sprite.tint = color;
  }

  setFacing(dir: number) {
    this.root.scale.x = dir < 0 ? -1 : 1;
  }
}

function lerpColor(a: number, b: number, k: number) {
  const r = ((a >> 16) & 255) * (1 - k) + ((b >> 16) & 255) * k;
  const g = ((a >> 8) & 255) * (1 - k) + ((b >> 8) & 255) * k;
  const bl = (a & 255) * (1 - k) + (b & 255) * k;
  return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(bl);
}

export function ghostOf(actor: SpriteActor, x: number, y: number, dir: number) {
  const s = new Sprite(actor.sprite.texture);
  s.anchor.copyFrom(actor.sprite.anchor);
  s.scale.set(actor.sprite.scale.x * dir, actor.sprite.scale.y);
  s.position.set(x, y);
  s.tint = 0x9fd8ff;
  return s;
}

// A cartoon monster that has only a couple of drawn frames: it is brought to life by code
// (bobbing, squash and stretch, tilt), so one picture can hop, float, charge or swell.
export class MonsterActor {
  readonly root = new Container();
  readonly sprite = new Sprite();
  readonly height: number;
  squashX = 1;
  squashY = 1;
  tilt = 0;
  lift = 0; // world units above the feet
  private idle: Texture[];
  private hit: Texture[];
  private walk: Texture[];
  private base: number;
  private t = Math.random() * 10;
  private hold = 0;
  private holdColor = 0xffffff;
  private dir = 1;
  showHit = 0; // seconds left of showing the 'got hit' frame

  constructor(readonly name: string, bodyUnits: number) {
    const m = monsters[name];
    const all = monsterFrames.get(name)!;
    const pick = (a?: number[]) => (a ?? []).map((i) => all[i]);
    this.idle = pick(m.anims.idle);
    this.hit = pick(m.anims.hit);
    this.walk = pick(m.anims.walk);
    this.height = bodyUnits;
    this.base = (bodyUnits * U) / m.ch;
    this.sprite.anchor.set(0.5, 1);
    this.sprite.texture = this.idle[0];
    this.root.addChild(this.sprite);
  }

  setFacing(dir: number) {
    this.dir = dir < 0 ? -1 : 1;
  }

  flash(color: number, strength = 1) {
    this.holdColor = color;
    this.hold = strength;
    this.sprite.tint = color;
  }

  update(dt: number, moving = false) {
    this.t += dt;
    const frames = moving && this.walk.length ? this.walk : this.idle;
    const fps = moving && this.walk.length ? 8 : this.idle.length > 2 ? 6 : 2.5;
    this.showHit = Math.max(0, this.showHit - dt);
    const list = this.showHit > 0 && this.hit.length ? this.hit : frames;
    this.sprite.texture = list[Math.floor(this.t * fps) % list.length];
    this.sprite.scale.set(this.base * this.squashX * this.dir, this.base * this.squashY);
    this.sprite.rotation = this.tilt;
    this.sprite.y = -this.lift * U;
    if (this.hold > 0) {
      this.hold = Math.max(0, this.hold - dt * 6);
      this.sprite.tint = this.hold <= 0 ? 0xffffff : lerpColor(0xffffff, this.holdColor, this.hold);
    }
  }
}
