import { Container, Graphics } from 'pixi.js';

// 2D cartoon-vector characters, drawn in code and animated by a joint skeleton.
// Design space: feet at (0,0), y grows downward, character faces +x, about 190 units tall.

export const OUTLINE = 0x1a1030;
const OUT = 5;

export type WeaponKind = 'none' | 'sword' | 'shield' | 'axe' | 'staff' | 'crossbow' | 'club' | 'bow';

export interface Style {
  skin: number;
  shirt: number;
  trim: number;
  pants: number;
  boots: number;
  hair?: number;
  head: 'plain' | 'helmet' | 'crown' | 'skull' | 'hood';
  face: 'hero' | 'zombie' | 'skull' | 'grim';
  plume?: number;
  girth: number;
  ragged: boolean;
  pauldrons: boolean;
  front: WeaponKind; // weapon in the near hand
  back: WeaponKind; // item in the far hand
  cape?: number;
  eye?: number; // eye colour override (glowing eyes)
}

// Joint angles in radians. For limbs, positive = forward (towards +x).
export interface Pose {
  x: number; // body offset
  y: number; // body offset (negative = up)
  rot: number; // whole-body rotation about the feet, positive = clockwise (falls forward)
  lean: number; // torso lean, positive = forward
  head: number; // head tilt, positive = forward
  sh1: number; // near arm shoulder
  el1: number;
  sh2: number; // far arm shoulder
  el2: number;
  hipF: number; // near leg
  kneeF: number; // positive = shin folds backwards
  hipB: number;
  kneeB: number;
  w1: number; // weapon angle relative to the forearm (near hand)
  w2: number;
}

export const NEUTRAL: Pose = {
  x: 0, y: 0, rot: 0, lean: 0, head: 0,
  sh1: 0.1, el1: 0.5, sh2: -0.1, el2: 0.4,
  hipF: 0, kneeF: 0, hipB: 0, kneeB: 0,
  w1: 0, w2: 0,
};

const THIGH = 30;
const SHIN = 30;
const UPPER = 27;
const FORE = 25;
const HIP_Y = -60;
const TORSO_H = 62;
const HEAD_R = 36;

function finish(g: Graphics, fill: number) {
  return g.fill({ color: fill }).stroke({ width: OUT, color: OUTLINE, join: 'round', cap: 'round' });
}

function shade(color: number, k: number) {
  const r = Math.min(255, Math.round(((color >> 16) & 255) * k));
  const gg = Math.min(255, Math.round(((color >> 8) & 255) * k));
  const b = Math.min(255, Math.round((color & 255) * k));
  return (r << 16) | (gg << 8) | b;
}

// A limb segment hanging down from its pivot.
function capsule(len: number, w: number, color: number) {
  const g = new Graphics();
  finish(g.roundRect(-w / 2, -w / 2, w, len + w, w / 2), color);
  g.roundRect(-w / 2 + 3, 2, w * 0.28, len - 4, 3).fill({ color: 0xffffff, alpha: 0.22 });
  return g;
}

function weaponGfx(kind: WeaponKind, s: Style): Container | null {
  if (kind === 'none') return null;
  const c = new Container();
  const g = new Graphics();
  c.addChild(g);
  switch (kind) {
    case 'sword':
      finish(g.roundRect(-4, -6, 8, 18, 3), 0x8a4b22); // grip
      finish(g.roundRect(-15, 10, 30, 8, 3), 0xf2c14e); // guard
      finish(g.poly([-7, 17, 7, 17, 7, 76, 0, 92, -7, 76]), 0xe6eef9); // blade
      g.moveTo(0, 22).lineTo(0, 78).stroke({ width: 2, color: 0x9fb2cc });
      break;
    case 'shield':
      g.ellipse(14, 0, 18, 32);
      finish(g, s.shirt);
      g.ellipse(14, 0, 11, 23).stroke({ width: 3, color: s.trim });
      g.circle(14, 0, 6).fill({ color: s.trim }).stroke({ width: 2, color: OUTLINE });
      break;
    case 'axe':
      finish(g.roundRect(-4, -14, 8, 120, 3), 0x7a4a24);
      finish(g.poly([4, 62, 40, 46, 46, 70, 46, 94, 40, 112, 4, 98]), 0xcfd8e6);
      g.moveTo(14, 70).lineTo(14, 92).stroke({ width: 2, color: 0x8796ad });
      break;
    case 'staff':
      finish(g.roundRect(-4, -26, 8, 130, 3), 0x6b3f1d);
      finish(g.circle(0, 112, 13), s.eye ?? 0xb84dff);
      g.circle(-4, 108, 4).fill({ color: 0xffffff, alpha: 0.7 });
      break;
    case 'crossbow':
      finish(g.roundRect(-5, -8, 10, 46, 3), 0x7a4a24);
      finish(g.poly([-26, 26, -18, 20, 0, 30, 18, 20, 26, 26, 18, 34, 0, 36, -18, 34]), 0x5b3a1c);
      g.moveTo(-26, 26).lineTo(0, 12).lineTo(26, 26).stroke({ width: 2, color: 0xe8e0c8 });
      break;
    case 'club':
      finish(g.roundRect(-5, -10, 10, 40, 3), 0x7a4a24);
      finish(g.roundRect(-13, 28, 26, 62, 10), 0x8b5a2b);
      for (const [px, py] of [[-9, 40], [9, 54], [-8, 70], [8, 80]]) g.circle(px, py, 3.5).fill({ color: 0xcfd8e6 }).stroke({ width: 1.5, color: OUTLINE });
      break;
    case 'bow':
      g.moveTo(-8, -34).quadraticCurveTo(46, 0, -8, 34);
      g.stroke({ width: 8, color: OUTLINE, cap: 'round' });
      g.moveTo(-8, -34).quadraticCurveTo(46, 0, -8, 34);
      g.stroke({ width: 4, color: 0xb26a2a, cap: 'round' });
      g.moveTo(-8, -34).lineTo(-8, 34).stroke({ width: 1.5, color: 0xf0ead0 });
      break;
  }
  return c;
}

function drawFace(head: Container, s: Style) {
  const f = new Graphics();
  const zombie = s.face === 'zombie';
  const skull = s.face === 'skull';
  const eyeColor = s.eye ?? (zombie ? 0xd42a2a : 0x2b1b4a);

  if (skull) {
    // eye sockets and nose hole
    f.ellipse(12, -6, 10, 12).fill({ color: 0x120a22 });
    f.ellipse(30, -6, 8, 10).fill({ color: 0x120a22 });
    f.circle(13, -4, 3.5).fill({ color: s.eye ?? 0xff5c5c });
    f.circle(31, -4, 3).fill({ color: s.eye ?? 0xff5c5c });
    f.poly([30, 10, 36, 20, 28, 20]).fill({ color: 0x120a22 });
    // teeth
    f.roundRect(6, 22, 34, 11, 3).fill({ color: 0xf3efe0 }).stroke({ width: 3, color: OUTLINE });
    for (const tx of [14, 22, 30]) f.moveTo(tx, 22).lineTo(tx, 33).stroke({ width: 2, color: OUTLINE });
  } else {
    // eyes: two big googly eyes, mismatched on zombies
    const eyes: [number, number, number, number][] = zombie
      ? [[10, -6, 11, 13], [29, -4, 8, 9]]
      : [[10, -6, 6.5, 8], [29, -6, 6, 7.5]];
    for (const [ex, ey, rx, ry] of eyes) {
      f.ellipse(ex, ey, rx, ry).fill({ color: 0xffffff }).stroke({ width: zombie ? 3 : 2.5, color: OUTLINE });
      const px = ex + rx * 0.3;
      const py = ey + (zombie ? ry * 0.25 : 0);
      f.circle(px, py, rx * 0.5).fill({ color: eyeColor });
      f.circle(px + 1, py, rx * 0.25).fill({ color: 0x120a22 });
      f.circle(px - 1.5, py - 2.5, rx * 0.15).fill({ color: 0xffffff });
    }
    if (zombie) {
      // bloodshot veins and bags under the eyes
      f.moveTo(2, -8).lineTo(7, -6).moveTo(3, -1).lineTo(8, -3).stroke({ width: 1.5, color: 0xc93b3b });
      f.moveTo(1, 8).quadraticCurveTo(10, 14, 20, 8).stroke({ width: 2.5, color: 0x6a8a58, alpha: 0.8 });
    }
    // brows
    const angry = s.face === 'grim' || zombie;
    f.moveTo(3, angry ? -24 : -22).lineTo(20, angry ? -17 : -22).stroke({ width: 4, color: OUTLINE, cap: 'round' });
    f.moveTo(21, angry ? -17 : -22).lineTo(36, angry ? -24 : -22).stroke({ width: 4, color: OUTLINE, cap: 'round' });
    // nose
    f.ellipse(HEAD_R - 3, 9, 6, 5).fill({ color: shade(s.skin, 0.88) }).stroke({ width: 2.5, color: OUTLINE });
    // mouth
    if (zombie) {
      f.moveTo(8, 18).quadraticCurveTo(22, 36, 38, 17).lineTo(36, 20).quadraticCurveTo(22, 26, 10, 22).closePath();
      f.fill({ color: 0x4a1020 }).stroke({ width: 3, color: OUTLINE, join: 'round' });
      for (const tx of [13, 20, 27, 33]) f.poly([tx, 20, tx + 4, 20, tx + 2, 26]).fill({ color: 0xf2eed2 });
    } else if (s.face === 'grim') {
      f.moveTo(10, 22).lineTo(36, 20).stroke({ width: 4, color: OUTLINE, cap: 'round' });
    } else {
      f.moveTo(9, 18).quadraticCurveTo(22, 32, 36, 17).stroke({ width: 4, color: OUTLINE, cap: 'round' });
    }
  }
  head.addChild(f);
}

function drawHead(s: Style) {
  const head = new Container();
  const g = new Graphics();
  const skullHead = s.face === 'skull';
  const base = skullHead ? 0xf1ecd8 : s.skin;
  // ear
  finish(g.ellipse(-HEAD_R + 4, 4, 8, 11), shade(base, 0.9));
  // cranium
  finish(g.ellipse(2, 0, HEAD_R, HEAD_R * 0.94), base);
  g.ellipse(-10, -17, 14, 8).fill({ color: 0xffffff, alpha: 0.2 });
  head.addChild(g);
  drawFace(head, s);

  const top = new Graphics();
  if (s.face === 'zombie' && s.hair !== undefined) {
    // sparse hair tufts and a stitched scar
    top.poly([-26, -22, -22, -42, -14, -28, -8, -46, -2, -30, 6, -44, 10, -28, 20, -34, 14, -20]);
    finish(top, s.hair);
    top.moveTo(-6, -18).lineTo(12, -6).stroke({ width: 2.5, color: OUTLINE });
    for (const [sx, sy] of [[-2, -16], [3, -12], [8, -8]]) top.moveTo(sx - 3, sy + 3).lineTo(sx + 3, sy - 3).stroke({ width: 2, color: OUTLINE });
  }
  if (s.head === 'helmet') {
    top.moveTo(-HEAD_R - 2, -14).quadraticCurveTo(-HEAD_R - 2, -HEAD_R - 14, 4, -HEAD_R - 12).quadraticCurveTo(HEAD_R + 6, -HEAD_R - 6, HEAD_R + 2, -18).closePath();
    finish(top, 0xaebbd1);
    top.moveTo(-HEAD_R, -23).lineTo(HEAD_R, -25).stroke({ width: 6, color: 0x8d9bb5 });
    top.moveTo(-HEAD_R, -23).lineTo(HEAD_R, -25).stroke({ width: 2, color: OUTLINE });
    // plume
    top.moveTo(-10, -HEAD_R - 11).quadraticCurveTo(-34, -HEAD_R - 36, -40, -HEAD_R - 6).quadraticCurveTo(-22, -HEAD_R - 14, 4, -HEAD_R - 11).closePath();
    finish(top, s.plume ?? 0xe03a3a);
  } else if (s.head === 'crown') {
    top.poly([-18, -HEAD_R + 2, -22, -HEAD_R - 26, -10, -HEAD_R - 12, 2, -HEAD_R - 32, 14, -HEAD_R - 12, 26, -HEAD_R - 26, 22, -HEAD_R + 2]);
    finish(top, 0xf2c14e);
    top.circle(2, -HEAD_R - 8, 4).fill({ color: 0xe03a3a }).stroke({ width: 2, color: OUTLINE });
    top.roundRect(-20, -HEAD_R - 2, 44, 7, 3).fill({ color: 0xd9a52a }).stroke({ width: 2.5, color: OUTLINE });
  } else if (s.head === 'hood') {
    top.moveTo(-HEAD_R - 6, 14).quadraticCurveTo(-HEAD_R - 10, -HEAD_R - 16, 8, -HEAD_R - 12).quadraticCurveTo(HEAD_R + 2, -HEAD_R - 4, HEAD_R - 2, -16).quadraticCurveTo(10, -26, -6, -12).quadraticCurveTo(-16, 4, -HEAD_R + 4, 24).closePath();
    finish(top, s.shirt);
  }
  head.addChild(top);
  return head;
}

function drawTorso(s: Style) {
  const g = new Graphics();
  const w = 26 * s.girth;
  const hem = 16;
  // coat / tunic, flaring at the hem
  g.moveTo(-w + 4, -TORSO_H + 8);
  g.quadraticCurveTo(-w - 2, -TORSO_H, 0, -TORSO_H - 2);
  g.quadraticCurveTo(w + 2, -TORSO_H, w - 4, -TORSO_H + 8);
  g.lineTo(w + 5, -6);
  if (s.ragged) {
    const n = 5;
    for (let i = 0; i <= n; i++) {
      const x = w + 5 - (i / n) * (2 * w + 10);
      g.lineTo(x, hem + (i % 2 === 0 ? 0 : 11));
    }
  } else {
    g.lineTo(w + 8, hem).lineTo(-w - 8, hem);
  }
  g.lineTo(-w - 5, -6).closePath();
  finish(g, s.shirt);
  // belt
  g.roundRect(-w - 4, -12, 2 * w + 8, 9, 3).fill({ color: 0x5a3a1c }).stroke({ width: 3, color: OUTLINE });
  g.roundRect(-5, -13, 10, 11, 2).fill({ color: s.trim }).stroke({ width: 2, color: OUTLINE });
  // chest decoration
  if (s.pauldrons) {
    g.poly([0, -TORSO_H + 14, 12, -TORSO_H + 26, 0, -TORSO_H + 40, -12, -TORSO_H + 26]).fill({ color: s.trim }).stroke({ width: 3, color: OUTLINE, join: 'round' });
  } else if (s.ragged) {
    g.poly([-w + 8, -40, -w + 22, -34, -w + 12, -22]).fill({ color: shade(s.shirt, 0.7) });
    g.moveTo(-w + 8, -40).lineTo(-w + 22, -34).lineTo(-w + 12, -22).stroke({ width: 2, color: OUTLINE });
    g.moveTo(w - 18, -50).lineTo(w - 6, -34).stroke({ width: 2.5, color: OUTLINE });
  }
  g.ellipse(-w * 0.45, -TORSO_H + 20, 5, 18).fill({ color: 0xffffff, alpha: 0.16 });
  return g;
}

function drawFoot(boots: number) {
  const g = new Graphics();
  finish(g.roundRect(-9, -7, 30, 15, 7), boots);
  return g;
}

interface Limb {
  root: Container; // rotates at the hip / shoulder
  low: Container; // rotates at the knee / elbow
}

// The skeleton. Add `rig.root` to a scene, move it to the character's feet, call `update` every frame.
export class Rig {
  readonly root = new Container();
  private flip = new Container();
  private spin = new Container();
  private body = new Container();
  private torso = new Container();
  private neck = new Container();
  private legF!: Limb;
  private legB!: Limb;
  private armF!: Limb;
  private armB!: Limb;
  private hold1 = new Container();
  private hold2 = new Container();
  private cape: Graphics | null = null;
  private tint = 0xffffff;

  pose: Pose = { ...NEUTRAL };
  target: Pose = { ...NEUTRAL };

  constructor(readonly style: Style) {
    const s = style;
    this.root.addChild(this.flip);
    this.flip.addChild(this.spin);
    this.spin.addChild(this.body);

    const shadow = new Graphics().ellipse(0, 0, 38, 9).fill({ color: 0x000000, alpha: 0.28 });
    this.root.addChildAt(shadow, 0);

    const limbLeg = (color: number) => {
      const root = new Container();
      root.addChild(capsule(THIGH, 18 * Math.min(1.25, s.girth), color));
      const low = new Container();
      low.y = THIGH;
      low.addChild(capsule(SHIN, 16 * Math.min(1.2, s.girth), color));
      const foot = drawFoot(s.boots);
      foot.y = SHIN + 6;
      low.addChild(foot);
      root.addChild(low);
      return { root, low } as Limb;
    };

    const limbArm = (sleeve: number, skin: number, hold: Container) => {
      const root = new Container();
      root.addChild(capsule(UPPER, 15 * Math.min(1.3, s.girth), sleeve));
      const low = new Container();
      low.y = UPPER;
      low.addChild(capsule(FORE, 13 * Math.min(1.25, s.girth), skin));
      const hand = new Graphics();
      finish(hand.circle(0, FORE + 5, 9 * Math.min(1.2, s.girth)), skin);
      low.addChild(hand);
      hold.y = FORE + 5;
      low.addChild(hold);
      root.addChild(low);
      return { root, low } as Limb;
    };

    this.legB = limbLeg(shade(s.pants, 0.78));
    this.legF = limbLeg(s.pants);
    this.legB.root.position.set(-5, HIP_Y);
    this.legF.root.position.set(4, HIP_Y);

    const sleeve = s.pauldrons ? s.trim : s.shirt;
    this.armB = limbArm(shade(sleeve, 0.8), shade(s.skin, 0.85), this.hold2);
    this.armF = limbArm(sleeve, s.skin, this.hold1);
    this.armB.root.position.set(2, -TORSO_H + 14);
    this.armF.root.position.set(-1, -TORSO_H + 14);

    const w1 = weaponGfx(s.front, s);
    const w2 = weaponGfx(s.back, s);
    if (w1) this.hold1.addChild(w1);
    if (w2) this.hold2.addChild(w2);

    if (s.cape !== undefined) {
      this.cape = new Graphics();
      this.cape.moveTo(-6, -TORSO_H + 6).lineTo(-30, 30).lineTo(-16, 40).lineTo(-4, 34).lineTo(6, 8).closePath();
      finish(this.cape, s.cape);
      this.torso.addChild(this.cape);
    }

    const shoulderPad = s.pauldrons ? new Graphics().ellipse(0, 2, 12, 10) : null;
    if (shoulderPad) {
      finish(shoulderPad, s.trim);
      this.armF.root.addChild(shoulderPad);
    }

    const head = drawHead(s);
    this.neck.position.set(2, -TORSO_H - 27);
    this.neck.addChild(head);

    this.torso.position.set(0, HIP_Y);
    this.torso.addChild(this.armB.root, drawTorso(s), this.neck, this.armF.root);
    // arms and neck are placed relative to the hip pivot
    this.armB.root.position.set(2, -TORSO_H + 14);
    this.armF.root.position.set(-1, -TORSO_H + 14);

    this.body.addChild(this.legB.root, this.legF.root, this.torso);
    this.legB.root.position.set(-5, 0);
    this.legF.root.position.set(4, 0);
    this.legB.root.y = HIP_Y;
    this.legF.root.y = HIP_Y;
    this.torso.pivot.set(0, 0);
    this.torso.position.set(0, HIP_Y);
  }

  setFacing(dir: number) {
    this.flip.scale.x = dir < 0 ? -1 : 1;
  }

  // Moves towards a pose; `k` is 0..1 per call (1 = snap).
  blend(k: number) {
    const p = this.pose as unknown as Record<string, number>;
    const t = this.target as unknown as Record<string, number>;
    for (const key in p) p[key] += (t[key] - p[key]) * k;
    this.apply();
  }

  setEmissive(tint: number) {
    this.tint = tint;
    this.body.tint = tint;
  }

  get flash() {
    return this.tint;
  }

  private apply() {
    const p = this.pose;
    this.spin.pivot.set(0, -85);
    this.spin.position.set(0, -85);
    this.spin.rotation = p.rot;
    this.body.position.set(p.x, p.y);
    this.torso.rotation = p.lean;
    this.neck.rotation = p.head;
    this.armF.root.rotation = -p.sh1;
    this.armF.low.rotation = -p.el1;
    this.armB.root.rotation = -p.sh2;
    this.armB.low.rotation = -p.el2;
    this.legF.root.rotation = -p.hipF;
    this.legF.low.rotation = p.kneeF;
    this.legB.root.rotation = -p.hipB;
    this.legB.low.rotation = p.kneeB;
    this.hold1.rotation = -p.w1;
    this.hold2.rotation = -p.w2;
    if (this.cape) this.cape.rotation = -p.lean * 0.6 + Math.sin(performance.now() / 260) * 0.05;
  }
}
