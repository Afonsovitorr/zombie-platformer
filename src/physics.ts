// Gameplay lives on the z=0 plane; physics is plain 2D AABB (x = horizontal, y = up).
export interface Box { x0: number; x1: number; y0: number; y1: number }

// x is the horizontal center, y is the feet.
export interface Body { x: number; y: number; vx: number; vy: number; w: number; h: number; onGround: boolean }

export const GRAVITY = -32;
const MAX_FALL = -30;

const overlaps = (b: Body, s: Box) =>
  b.x - b.w / 2 < s.x1 && b.x + b.w / 2 > s.x0 && b.y < s.y1 && b.y + b.h > s.y0;

export function moveBody(b: Body, dt: number, solids: Box[]) {
  b.vy = Math.max(MAX_FALL, b.vy + GRAVITY * dt);

  b.x += b.vx * dt;
  for (const s of solids) {
    if (!overlaps(b, s)) continue;
    if (b.vx > 0) b.x = s.x0 - b.w / 2;
    else if (b.vx < 0) b.x = s.x1 + b.w / 2;
    b.vx = 0;
  }

  b.y += b.vy * dt;
  b.onGround = false;
  for (const s of solids) {
    if (!overlaps(b, s)) continue;
    if (b.vy <= 0) {
      b.y = s.y1;
      b.onGround = true;
    } else {
      b.y = s.y0 - b.h;
    }
    b.vy = 0;
  }
}

export const sign = (n: number) => (n < 0 ? -1 : 1);
