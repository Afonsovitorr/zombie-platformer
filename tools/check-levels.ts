// Reachability checker: simulates the hero (same physics, same jump and run values as the game) over each
// level and reports what can and cannot be reached. Run with: npm run check:levels
import { LEVELS, CELL, type LevelDef } from '../src/data/levels';
import { moveBody, type Body, type Box } from '../src/physics';

const DT = 1 / 60;
const RUN = 7;
const JUMP = 15;
const AIR_ACCEL = 35;
const GROUND_ACCEL = 60;
const W = 0.8;
const H = 1.7;

interface Spot {
  x: number;
  y: number;
}

const key = (s: Spot) => `${Math.floor(s.x / CELL)},${Math.round(s.y * 2)}`;

function approach(vx: number, target: number, accel: number) {
  const diff = target - vx;
  return vx + Math.sign(diff) * Math.min(Math.abs(diff), accel * DT);
}

// Moves one step with held direction; returns true while still in the air.
function step(b: Body, dir: number, solids: Box[], jumpHeld: boolean) {
  b.vx = approach(b.vx, dir * RUN, b.onGround ? GROUND_ACCEL : AIR_ACCEL);
  if (!jumpHeld && b.vy > 0) b.vy -= 45 * DT; // shorter hop when released early
  moveBody(b, DT, solids);
}

function explore(def: LevelDef, solids: Box[], from: Spot) {
  const seen = new Map<string, Spot>();
  const queue: Spot[] = [];
  const add = (s: Spot) => {
    const k = key(s);
    if (seen.has(k)) return;
    seen.set(k, s);
    queue.push(s);
  };
  const floor = def.killY;
  add(from);

  const land = (b: Body, dir: number, jumpHold: number, fromX: number) => {
    // continue until it lands, falls out of the world, or runs out of time
    let t = 0;
    while (t < 4) {
      step(b, dir, solids, t < jumpHold);
      t += DT;
      if (b.y < floor) return;
      if (b.onGround && t > 0.1) {
        add({ x: b.x, y: b.y });
        return;
      }
    }
    void fromX;
  };

  while (queue.length) {
    const s = queue.pop()!;
    for (const ox of [-0.7, 0, 0.7]) {
      const x = s.x + ox;
      // standing check
      const probe: Body = { x, y: s.y, vx: 0, vy: 0, w: W, h: H, onGround: false };
      moveBody(probe, DT, solids);
      if (!probe.onGround) continue;
      for (const dir of [-1, 0, 1]) {
        // walk (falls off ledges on its own)
        if (dir !== 0) {
          const b: Body = { ...probe, vx: 0 };
          for (let i = 0; i < 60 * 6; i++) {
            step(b, dir, solids, false);
            if (b.y < floor) break;
            if (b.onGround) add({ x: b.x, y: b.y });
            else {
              land(b, dir, 0, x);
              break;
            }
          }
        }
        // jumps of different heights, standing or with a run-up
        for (const run of dir === 0 ? [0] : [0, dir * RUN]) {
          for (const hold of [0.08, 0.16, 0.3, 1]) {
            const b: Body = { ...probe, vx: run, vy: JUMP, onGround: false };
            moveBody(b, 0, solids);
            land(b, dir, hold, x);
          }
        }
        // drop through a thin platform
        if (probe.standing?.oneWay) {
          const b: Body = { ...probe, vx: 0, dropT: 0.25 };
          b.y -= 0.06;
          land(b, dir, 0, x);
        }
      }
    }
  }
  return seen;
}

function near(reach: Map<string, Spot>, x: number, y: number, dx: number, dy: number) {
  for (const s of reach.values()) if (Math.abs(s.x - x) <= dx && s.y > y - dy && s.y < y + dy) return true;
  return false;
}

let bad = 0;
for (const def of LEVELS) {
  if (def.id === 'zoo') continue;
  const start: Spot = { x: def.start.x, y: def.start.y };
  // pass 1: walls closed
  const closed: Box[] = [...def.solids, ...def.oneWay, ...def.secrets.map((s) => s.box)];
  const r1 = explore(def, closed, start);
  // pass 2: every secret wall broken
  const open: Box[] = [...def.solids, ...def.oneWay];
  const r2 = explore(def, open, start);

  const report: string[] = [];
  const check = (label: string, x: number, y: number, dx = 1.6, dy = 2.2) => {
    if (near(r1, x, y, dx, dy)) return;
    if (near(r2, x, y, dx, dy)) report.push(`  secret-only: ${label} (${x.toFixed(0)}, ${y.toFixed(0)})`);
    else {
      report.push(`  UNREACHABLE: ${label} (${x.toFixed(0)}, ${y.toFixed(0)})`);
      bad++;
    }
  };
  def.checkpoints.forEach((c, i) => check(`campfire ${i}`, c.x, c.y));
  def.chests.forEach((c) => check(`${c.rich ? 'rich ' : ''}chest ${c.id}`, c.x, c.y));
  def.npcs.forEach((n) => check('merchant', n.x, n.y));
  check('goal', def.goal.x, def.goal.y, 2, 3);
  if (def.boss) check('boss arena', def.boss.x, def.boss.y, 3, 3);

  // enemies placed inside solid blocks
  const inside = def.spawns.filter((s) => closed.some((b) => !b.oneWay && s.x > b.x0 && s.x < b.x1 && s.y + 0.5 > b.y0 && s.y + 0.5 < b.y1));
  for (const s of inside) {
    report.push(`  BAD SPAWN inside a wall: ${s.type} at (${s.x.toFixed(0)}, ${s.y.toFixed(0)})`);
    bad++;
  }

  // how much of the map is walkable, for a feel of size
  console.log(`${def.id}: ${def.cols}x${def.rows} cells · ${r1.size} reachable spots (${r2.size} with secrets) · ${def.spawns.length} enemies · ${def.chests.length} chests · ${def.secrets.length} secrets`);
  for (const l of report) console.log(l);
  if (process.argv.includes('--map')) {
    const rows = def.grid.map((r) => r.split(''));
    for (const s of r1.values()) {
      const c = Math.floor(s.x / CELL);
      const rr = def.rows - 1 - Math.round((s.y + def.yOffset) / CELL) ;
      const r = rr; // row whose top edge is at s.y -> the cell above the surface is r
      if (rows[r]?.[c] === '.') rows[r][c] = '·';
    }
    console.log(rows.map((r) => r.join('')).join('\n'));
  }
}
if (bad) {
  console.log(`\n${bad} problem(s) found`);
  process.exit(1);
}
console.log('\nall good');
