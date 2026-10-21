import { NEUTRAL, type Pose } from './rig';

// Animations are pure functions of time: they return the pose the skeleton should move towards.
// One-shot animations take k in 0..1 (progress through the action).

type Key = [number, Partial<Pose>];

const ease = (x: number) => x * x * (3 - 2 * x);

// Interpolates between keyframes (each merged over `base`).
function keys(k: number, base: Partial<Pose>, frames: Key[]): Pose {
  const full = (p: Partial<Pose>): Pose => ({ ...NEUTRAL, ...base, ...p });
  const kk = Math.min(1, Math.max(0, k));
  for (let i = 1; i < frames.length; i++) {
    const [t1, p1] = frames[i];
    if (kk <= t1) {
      const [t0, p0] = frames[i - 1];
      const u = ease((kk - t0) / Math.max(1e-6, t1 - t0));
      const a = full(p0) as unknown as Record<string, number>;
      const b = full(p1) as unknown as Record<string, number>;
      const out: Record<string, number> = {};
      for (const key in a) out[key] = a[key] + (b[key] - a[key]) * u;
      return out as unknown as Pose;
    }
  }
  return full(frames[frames.length - 1][1]);
}

const S = Math.sin;

// ---- hero (sword ready stance) ----
const READY: Partial<Pose> = { sh1: 0.5, el1: 1.0, w1: 0.9, sh2: 0.5, el2: 1.1, w2: 0 };

export function heroIdle(t: number): Pose {
  const b = S(t * 2.6);
  return { ...NEUTRAL, ...READY, y: b * 1.6, lean: 0.04 + b * 0.015, head: b * 0.02, sh1: 0.5 + b * 0.04, hipF: 0.08, hipB: -0.08, kneeF: 0.05 };
}

export function heroWalk(t: number, speed: number): Pose {
  const ph = t * 6 * Math.max(0.6, speed);
  const s = S(ph);
  return {
    ...NEUTRAL, ...READY,
    y: -Math.abs(S(ph)) * 4, lean: 0.1,
    hipF: s * 0.7, kneeF: Math.max(0, -S(ph + 1.2)) * 0.9 + 0.08,
    hipB: -s * 0.7, kneeB: Math.max(0, S(ph + 1.2)) * 0.9 + 0.08,
    sh1: 0.5 - s * 0.25, sh2: 0.5 + s * 0.25,
  };
}

export function heroRun(t: number): Pose {
  const ph = t * 11;
  const s = S(ph);
  return {
    ...NEUTRAL, ...READY,
    y: -Math.abs(S(ph)) * 7 - 2, lean: 0.34, head: -0.12,
    hipF: s * 1.0, kneeF: Math.max(0, -S(ph + 1.0)) * 1.5 + 0.2,
    hipB: -s * 1.0, kneeB: Math.max(0, S(ph + 1.0)) * 1.5 + 0.2,
    sh1: -0.2 - s * 0.7, el1: 1.5, w1: 1.2, sh2: -0.2 + s * 0.7, el2: 1.5,
  };
}

export function heroJump(): Pose {
  return { ...NEUTRAL, ...READY, y: -4, lean: 0.12, hipF: 0.9, kneeF: 1.2, hipB: -0.2, kneeB: 0.7, sh1: 1.3, el1: 0.6, w1: 0.6, sh2: 1.0, el2: 0.6 };
}

export function heroFall(): Pose {
  return { ...NEUTRAL, ...READY, lean: 0.05, hipF: 0.5, kneeF: 0.3, hipB: -0.4, kneeB: 0.5, sh1: 1.7, el1: 0.5, w1: 0.5, sh2: 1.5, el2: 0.4, head: -0.1 };
}

// 3-stage combo: chop, rising diagonal slice, wide horizontal sweep.
export function heroAttack(stage: number, k: number): Pose {
  if (stage === 0) {
    return keys(k, READY, [
      [0, {}],
      [0.26, { sh1: 2.8, el1: 0.5, w1: 0.9, lean: -0.22, hipF: 0.25, hipB: -0.3, y: 2, sh2: 1.2, el2: 0.6 }],
      [0.48, { sh1: 1.15, el1: 0.15, w1: -0.1, lean: 0.4, hipF: 0.7, kneeF: 0.4, hipB: -0.6, kneeB: 0.2, x: 12, y: 6, sh2: -0.4, el2: 0.5 }],
      [0.7, { sh1: 0.9, el1: 0.2, w1: -0.2, lean: 0.38, hipF: 0.7, kneeF: 0.4, hipB: -0.6, x: 12, y: 6 }],
      [1, {}],
    ]);
  }
  if (stage === 1) {
    return keys(k, READY, [
      [0, {}],
      [0.26, { sh1: -0.5, el1: 0.5, w1: 0.9, lean: 0.06, hipF: -0.2, hipB: 0.3, kneeB: 0.4, y: 6, sh2: 0.2 }],
      [0.5, { sh1: 2.1, el1: 0.2, w1: 0.3, lean: 0.34, hipF: 0.65, kneeF: 0.3, hipB: -0.6, x: 14, y: 4, sh2: 0.8 }],
      [0.72, { sh1: 2.5, el1: 0.3, w1: 0.4, lean: 0.25, hipF: 0.65, hipB: -0.6, x: 14, y: 4 }],
      [1, {}],
    ]);
  }
  return keys(k, READY, [
    [0, {}],
    [0.28, { sh1: -1.0, el1: 0.2, w1: 2.2, lean: -0.1, hipF: -0.1, hipB: 0.3, y: 4, sh2: 0.2 }],
    [0.52, { sh1: 1.5, el1: 0.05, w1: 0.1, lean: 0.45, hipF: 0.8, kneeF: 0.5, hipB: -0.7, x: 18, y: 7, sh2: -0.5 }],
    [0.75, { sh1: 1.7, el1: 0.1, w1: 0.1, lean: 0.4, hipF: 0.8, kneeF: 0.5, hipB: -0.7, x: 18, y: 7 }],
    [1, {}],
  ]);
}

// Plunge: dive with the sword pointing straight down.
export function heroPlunge(): Pose {
  return { ...NEUTRAL, lean: 0.2, hipF: 0.2, kneeF: 0.1, hipB: -0.2, kneeB: 0.1, sh1: 1.0, el1: 0.1, w1: -1.1, sh2: 1.2, el2: 0.4, y: -4 };
}

export function heroBlock(t: number): Pose {
  return { ...NEUTRAL, ...READY, y: 8 + S(t * 8) * 0.6, lean: 0.12, hipF: 0.5, kneeF: 0.7, hipB: -0.5, kneeB: 0.7, sh1: 0.7, el1: 1.3, w1: 1.1, sh2: 1.5, el2: 1.5, w2: 0.3, x: 4 };
}

// Roll: the whole body somersaults forwards.
export function heroDodge(k: number): Pose {
  const roll = Math.min(1, k * 1.25);
  return { ...NEUTRAL, ...READY, rot: ease(roll) * Math.PI * 2, y: -14 * S(roll * Math.PI), lean: 0.5, head: 0.4, hipF: 1.1, kneeF: 1.6, hipB: 0.9, kneeB: 1.6, sh1: 0.9, el1: 1.7, sh2: 0.9, el2: 1.7, w1: 0.2 };
}

export function heroHurt(k: number): Pose {
  const a = Math.sin(Math.min(1, k) * Math.PI);
  return { ...NEUTRAL, lean: -0.35 * a, head: -0.35 * a, x: -10 * a, y: 2, sh1: 1.6 * a, el1: 0.4, sh2: 1.3 * a, el2: 0.4, hipF: 0.3, hipB: -0.2, kneeF: 0.3, w1: 0.3 };
}

export function heroDead(k: number): Pose {
  return keys(k, {}, [
    [0, { ...READY }],
    [0.3, { lean: -0.5, head: -0.3, x: -14, sh1: 1.5, sh2: 1.3, el1: 0.5, hipF: 0.4, kneeF: 0.6, w1: 0.4 }],
    [1, { rot: -Math.PI / 2 + 0.05, y: 66, x: -12, lean: 0, head: 0.2, sh1: 1.9, el1: 0.3, sh2: 2.0, el2: 0.3, hipF: 0.2, hipB: 0.1, kneeF: 0.3, w1: 0.5 }],
  ]);
}

// Bow: the near hand pulls the string while the far hand holds the bow out.
export function heroShoot(k: number): Pose {
  return keys(k, {}, [
    [0, { sh1: 1.5, el1: 0.1, sh2: 1.55, el2: 0, lean: 0.05, hipF: 0.3, hipB: -0.3 }],
    [0.5, { sh1: 1.5, el1: 2.3, sh2: 1.55, el2: 0, lean: -0.05, hipF: 0.3, hipB: -0.3, w1: 0 }],
    [0.62, { sh1: 1.5, el1: 0.2, sh2: 1.55, el2: 0, lean: 0.12, x: -6, hipF: 0.3, hipB: -0.3 }],
    [1, { sh1: 1.4, el1: 0.3, sh2: 1.5, el2: 0.1, hipF: 0.2, hipB: -0.2 }],
  ]);
}

// ---- undead (arms out, stiff) ----
const ZOMBIE: Partial<Pose> = { sh1: 1.35, el1: 0.15, sh2: 1.45, el2: 0.1, lean: 0.12, head: 0.1 };

export function zombieIdle(t: number): Pose {
  const b = S(t * 1.9);
  return { ...NEUTRAL, ...ZOMBIE, y: b * 1.6, lean: 0.14 + b * 0.03, head: 0.12 + S(t * 1.1) * 0.08, sh1: 1.1 + b * 0.1, sh2: 1.25 + b * 0.08, hipF: 0.1, hipB: -0.1 };
}

export function zombieWalk(t: number, speed: number): Pose {
  const ph = t * 5 * Math.max(0.6, speed);
  const s = S(ph);
  return {
    ...NEUTRAL, ...ZOMBIE,
    y: -Math.abs(S(ph)) * 3, lean: 0.2 + S(ph * 2) * 0.03,
    hipF: s * 0.5, kneeF: Math.max(0, -S(ph + 1.2)) * 0.5 + 0.05,
    hipB: -s * 0.5, kneeB: Math.max(0, S(ph + 1.2)) * 0.5 + 0.05,
    sh1: 1.3 + s * 0.12, sh2: 1.45 - s * 0.12, head: 0.2 + S(ph * 2) * 0.05,
  };
}

export function zombieRun(t: number): Pose {
  const ph = t * 10;
  const s = S(ph);
  return {
    ...NEUTRAL, ...ZOMBIE,
    y: -Math.abs(S(ph)) * 6 - 2, lean: 0.46, head: 0.05,
    hipF: s * 0.95, kneeF: Math.max(0, -S(ph + 1.0)) * 1.4 + 0.2,
    hipB: -s * 0.95, kneeB: Math.max(0, S(ph + 1.0)) * 1.4 + 0.2,
    sh1: 1.6 + s * 0.3, el1: 0.3, sh2: 1.7 - s * 0.3, el2: 0.3,
  };
}

// Overhead smash: both arms rise, then come down.
export function zombieAttack(k: number, kind: 'smash' | 'swipe' = 'smash'): Pose {
  if (kind === 'swipe') {
    return keys(k, ZOMBIE, [
      [0, {}],
      [0.4, { sh1: -0.8, sh2: -0.6, el1: 0.3, lean: -0.15, hipB: 0.2 }],
      [0.62, { sh1: 1.6, sh2: 1.5, el1: 0.05, lean: 0.4, hipF: 0.5, hipB: -0.4, x: 12 }],
      [1, {}],
    ]);
  }
  return keys(k, ZOMBIE, [
    [0, {}],
    [0.42, { sh1: 2.7, sh2: 2.8, el1: 0.3, el2: 0.3, lean: -0.3, head: -0.2, hipB: 0.3, y: 2 }],
    [0.6, { sh1: 0.7, sh2: 0.8, el1: 0.1, el2: 0.1, lean: 0.55, head: 0.3, hipF: 0.6, kneeF: 0.3, hipB: -0.5, x: 12, y: 8 }],
    [1, {}],
  ]);
}

export function zombieHurt(k: number): Pose {
  const a = Math.sin(Math.min(1, k) * Math.PI);
  return { ...NEUTRAL, ...ZOMBIE, lean: 0.12 - 0.4 * a, head: -0.4 * a, x: -8 * a, sh1: 1.35 + 0.6 * a, sh2: 1.45 + 0.5 * a };
}

export function zombieDead(k: number): Pose {
  return keys(k, {}, [
    [0, { ...ZOMBIE }],
    [0.35, { ...ZOMBIE, lean: -0.5, head: -0.4, x: -10, sh1: 2.0, sh2: 1.9 }],
    [1, { rot: -Math.PI / 2, y: 66, x: -12, sh1: 2.2, el1: 0.4, sh2: 2.0, el2: 0.5, hipF: 0.3, hipB: 0, kneeF: 0.5, head: 0.1 }],
  ]);
}

// Climbing out of the ground: starts lying down.
export function zombieRise(k: number): Pose {
  return keys(k, ZOMBIE, [
    [0, { rot: -Math.PI / 2, y: 60, x: -12, sh1: 2.2, sh2: 2.0 }],
    [0.55, { rot: -0.7, y: 20, x: -8, sh1: 2.4, sh2: 2.2, lean: 0.4, hipF: 1.0, kneeF: 1.2 }],
    [1, {}],
  ]);
}

// Parried: slumped and dazed.
export function stunned(t: number): Pose {
  return { ...NEUTRAL, y: 12, lean: 0.35, head: 0.45 + S(t * 6) * 0.1, sh1: 0.3, el1: 0.4, sh2: 0.2, el2: 0.4, hipF: 0.9, kneeF: 1.0, hipB: 0.5, kneeB: 1.3 };
}

// ---- casters / archers ----
export function castPose(k: number): Pose {
  return keys(k, {}, [
    [0, { sh1: 0.6, el1: 0.8, sh2: 0.5, el2: 0.8, lean: 0.05 }],
    [0.45, { sh1: 2.5, el1: 0.4, sh2: 2.4, el2: 0.5, lean: -0.15, head: -0.25, y: -4, w1: 0 }],
    [0.7, { sh1: 2.7, el1: 0.3, sh2: 2.6, el2: 0.4, lean: -0.2, head: -0.3, y: -6 }],
    [1, { sh1: 0.6, el1: 0.8, sh2: 0.5, el2: 0.8 }],
  ]);
}

export function crossbowShoot(k: number): Pose {
  return keys(k, {}, [
    [0, { sh1: 1.2, el1: 0.9, sh2: 1.35, el2: 0.5, w1: -0.6, w2: 0, lean: 0.05 }],
    [0.55, { sh1: 1.5, el1: 0.4, sh2: 1.5, el2: 0.3, w1: -1.0, lean: 0.1 }],
    [0.65, { sh1: 1.5, el1: 0.4, sh2: 1.5, el2: 0.3, w1: -1.0, lean: -0.05, x: -6 }],
    [1, { sh1: 1.2, el1: 0.9, sh2: 1.35, el2: 0.5, w1: -0.6 }],
  ]);
}
