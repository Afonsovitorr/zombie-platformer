import type { Box } from '../physics';
import { MAPS } from './maps';

// Levels are drawn as text grids, one character per 2x2 world units (row 0 is the top).
//
//   #  solid block            =  jump-through platform      S  breakable wall (secret)
//   ^  spikes                 .  empty (a blank also works)
//   P  player start           C  campfire (checkpoint)      G  goal flag
//   B  boss spawn             M  merchant                   $  chest      *  rich chest
//   lowercase letters         enemies, see ENEMY_KEYS
export const CELL = 2;

export const ENEMY_KEYS: Record<string, string> = {
  w: 'walker', r: 'runner', b: 'brute', a: 'archer', h: 'hound', n: 'necro',
  k: 'skull', o: 'spitter', f: 'phantom', t: 'tomb', l: 'plant', g: 'golem',
  y: 'gargoyle', i: 'frost', x: 'spiky', m: 'imp', d: 'shade', q: 'bomber',
  c: 'cyclops', u: 'ogre', z: 'blob', e: 'brick',
};

export interface SpawnDef {
  type: string; // key of ENEMIES
  x: number;
  y: number; // feet, or body centre for flyers (the enemy decides)
}

export interface BossDef {
  type: string;
  x: number;
  y: number;
  arena: [x0: number, x1: number]; // walls rise at these x when the player crosses x0 + 4
}

export interface ChestDef {
  id: string;
  x: number;
  y: number;
  rich: boolean;
}

export interface SecretDef {
  id: string;
  box: Box;
  cells: [col: number, row: number][];
}

export interface NpcDef {
  type: 'merchant';
  x: number;
  y: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface LevelDef {
  id: string;
  name: string;
  theme: 'cemetery' | 'forest' | 'castle';
  cols: number;
  rows: number;
  yOffset: number;
  grid: string[];
  solids: Box[];
  oneWay: Box[];
  secrets: SecretDef[];
  hazards: Box[];
  spawns: SpawnDef[];
  checkpoints: Point[];
  chests: ChestDef[];
  npcs: NpcDef[];
  start: Point;
  goal: Point;
  boss?: BossDef;
  bounds: { x0: number; x1: number; y0: number; y1: number };
  killY: number;
}

export interface LevelSource {
  id: string;
  name: string;
  theme: LevelDef['theme'];
  map: string[];
  boss?: { type: string; arena: [colFrom: number, colTo: number] };
}

// Merges filled cells into as few boxes as possible (horizontal runs, then stacked runs).
function merge(cells: Set<string>, cols: number, rows: number, box: (c0: number, c1: number, r0: number, r1: number) => Box) {
  const out: Box[] = [];
  const done = new Set<string>();
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const k = `${c},${r}`;
      if (!cells.has(k) || done.has(k)) continue;
      let c1 = c;
      while (c1 + 1 < cols && cells.has(`${c1 + 1},${r}`) && !done.has(`${c1 + 1},${r}`)) c1++;
      let r1 = r;
      grow: while (r1 + 1 < rows) {
        for (let x = c; x <= c1; x++) if (!cells.has(`${x},${r1 + 1}`) || done.has(`${x},${r1 + 1}`)) break grow;
        r1++;
      }
      for (let y = r; y <= r1; y++) for (let x = c; x <= c1; x++) done.add(`${x},${y}`);
      out.push(box(c, c1, r, r1));
    }
  }
  return out;
}

export function parseLevel(src: LevelSource): LevelDef {
  const rows = src.map.length;
  const cols = Math.max(...src.map.map((r) => r.length));
  const grid = src.map.map((r) => r.padEnd(cols, '.'));

  let start: Point | null = null;
  let startRow = 0;
  for (let r = 0; r < rows; r++) {
    const c = grid[r].indexOf('P');
    if (c >= 0) {
      startRow = r;
      start = { x: c * CELL + CELL / 2, y: 0 };
    }
  }
  if (!start) throw new Error(`${src.id}: no P (player start) in the map`);
  const yOffset = (rows - startRow - 1) * CELL;
  const bottom = (r: number) => (rows - r - 1) * CELL - yOffset; // y of a cell's lower edge
  const cx = (c: number) => c * CELL + CELL / 2;

  const solid = new Set<string>();
  const one = new Set<string>();
  const spikes = new Set<string>();
  const secretCells = new Set<string>();
  const spawns: SpawnDef[] = [];
  const checkpoints: Point[] = [];
  const chests: ChestDef[] = [];
  const npcs: NpcDef[] = [];
  let goal: Point | null = null;
  let bossPos: Point | null = null;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const ch = grid[r][c];
      const k = `${c},${r}`;
      if (ch === '#') solid.add(k);
      else if (ch === 'S') secretCells.add(k);
      else if (ch === '=') one.add(k);
      else if (ch === '^') spikes.add(k);
      else if (ch === 'C') checkpoints.push({ x: cx(c), y: bottom(r) });
      else if (ch === 'G') goal = { x: cx(c), y: bottom(r) };
      else if (ch === 'B') bossPos = { x: cx(c), y: bottom(r) };
      else if (ch === 'M') npcs.push({ type: 'merchant', x: cx(c), y: bottom(r) });
      else if (ch === '$' || ch === '*') chests.push({ id: `${src.id}:${c}_${r}`, x: cx(c), y: bottom(r), rich: ch === '*' });
      else if (ENEMY_KEYS[ch]) spawns.push({ type: ENEMY_KEYS[ch], x: cx(c), y: bottom(r) + 0.05 });
    }
  }
  if (!goal) throw new Error(`${src.id}: no G (goal) in the map`);
  checkpoints.sort((a, b) => a.x - b.x);

  const solids = merge(solid, cols, rows, (c0, c1, r0, r1) => ({ x0: c0 * CELL, x1: (c1 + 1) * CELL, y0: bottom(r1), y1: bottom(r0) + CELL }));
  const oneWay = merge(one, cols, rows, (c0, c1, r0) => ({ x0: c0 * CELL, x1: (c1 + 1) * CELL, y0: bottom(r0) + CELL - 0.5, y1: bottom(r0) + CELL, oneWay: true }));
  const hazards = merge(spikes, cols, rows, (c0, c1, r0) => ({ x0: c0 * CELL + 0.1, x1: (c1 + 1) * CELL - 0.1, y0: bottom(r0), y1: bottom(r0) + 0.9 }));

  // breakable walls: each connected group of S cells is one secret
  const secrets: SecretDef[] = [];
  const seen = new Set<string>();
  for (const k of secretCells) {
    if (seen.has(k)) continue;
    const group: [number, number][] = [];
    const stack = [k];
    seen.add(k);
    while (stack.length) {
      const cur = stack.pop()!;
      const [c, r] = cur.split(',').map(Number);
      group.push([c, r]);
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const n = `${c + dc},${r + dr}`;
        if (secretCells.has(n) && !seen.has(n)) {
          seen.add(n);
          stack.push(n);
        }
      }
    }
    const cs = group.map((g) => g[0]);
    const rs = group.map((g) => g[1]);
    secrets.push({
      id: `${src.id}:s${secrets.length}`,
      cells: group,
      box: { x0: Math.min(...cs) * CELL, x1: (Math.max(...cs) + 1) * CELL, y0: bottom(Math.max(...rs)), y1: bottom(Math.min(...rs)) + CELL },
    });
  }
  for (const s of secrets) s.box.id = s.id;

  let boss: BossDef | undefined;
  if (src.boss) {
    if (!bossPos) throw new Error(`${src.id}: boss declared but no B in the map`);
    boss = { type: src.boss.type, x: bossPos.x, y: bossPos.y, arena: [src.boss.arena[0] * CELL, src.boss.arena[1] * CELL] };
  }

  return {
    id: src.id, name: src.name, theme: src.theme, cols, rows, yOffset, grid,
    solids, oneWay, secrets, hazards, spawns, checkpoints, chests, npcs, start, goal, boss,
    bounds: { x0: 0, x1: cols * CELL, y0: bottom(rows - 1), y1: bottom(0) + CELL },
    killY: bottom(rows - 1) - 8,
  };
}

export const LEVELS: LevelDef[] = MAPS.map(parseLevel);
