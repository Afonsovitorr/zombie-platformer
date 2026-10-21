// Gameplay lives on the z=0 plane; physics is plain 2D AABB (x = horizontal, y = up).
export interface Box {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  oneWay?: boolean; // jump-through platform: only solid from above
  id?: string; // breakable walls are tracked by id
}

// x is the horizontal center, y is the feet.
export interface Body {
  x: number;
  y: number;
  vx: number;
  vy: number;
  w: number;
  h: number;
  onGround: boolean;
  fly?: boolean; // ignores gravity (the AI steers vy itself)
  ghost?: boolean; // passes through walls
  dropT?: number; // while positive, one-way platforms are ignored
  standing?: Box | null; // the solid under the feet after the last move
}

export const GRAVITY = -32;
const MAX_FALL = -30;

const overlaps = (b: Body, s: Box) =>
  b.x - b.w / 2 < s.x1 && b.x + b.w / 2 > s.x0 && b.y < s.y1 && b.y + b.h > s.y0;

export function moveBody(b: Body, dt: number, solids: Box[]) {
  if (!b.fly) b.vy = Math.max(MAX_FALL, b.vy + GRAVITY * dt);
  if (b.dropT) b.dropT = Math.max(0, b.dropT - dt);
  b.standing = null;

  if (b.ghost) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.onGround = false;
    return;
  }

  b.x += b.vx * dt;
  for (const s of solids) {
    if (s.oneWay || !overlaps(b, s)) continue;
    if (b.vx > 0) b.x = s.x0 - b.w / 2;
    else if (b.vx < 0) b.x = s.x1 + b.w / 2;
    b.vx = 0;
  }

  const prevY = b.y;
  b.y += b.vy * dt;
  b.onGround = false;
  for (const s of solids) {
    if (!overlaps(b, s)) continue;
    if (s.oneWay) {
      // only lands when coming down from above the platform's top
      if (b.vy > 0 || prevY < s.y1 - 0.02 || b.dropT) continue;
    }
    if (b.vy <= 0) {
      b.y = s.y1;
      b.onGround = true;
      b.standing = s;
    } else {
      b.y = s.y0 - b.h;
    }
    b.vy = 0;
  }
}

export const sign = (n: number) => (n < 0 ? -1 : 1);
