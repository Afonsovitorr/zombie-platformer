// A tiny helper for drawing level maps in code. Coordinates are in grid cells, x from the left and y from
// the BOTTOM (so bigger y is higher), which is easier to reason about than text rows.
//
//   ground(x0, x1, top)  fills earth up to a surface of height `top` (the surface is at 2*top world units)
//   plat(x, top, len)    a jump-through platform whose walking surface is `top`
//   at(x, top, ch)       places an entity (enemy, chest, campfire...) standing on a surface of height `top`
//   carve / fill         free-form edits (inclusive cell ranges)
export class MapBuilder {
  private g: string[][];

  constructor(readonly cols: number, readonly rows: number) {
    this.g = Array.from({ length: rows }, () => Array(cols).fill('.'));
  }

  put(x: number, y: number, ch: string) {
    if (x < 0 || x >= this.cols || y < 0 || y >= this.rows) throw new Error(`map: (${x},${y}) is outside ${this.cols}x${this.rows}`);
    this.g[this.rows - 1 - y][x] = ch;
  }

  get(x: number, y: number) {
    return this.g[this.rows - 1 - y]?.[x] ?? '#';
  }

  fill(x0: number, y0: number, x1: number, y1: number, ch = '#') {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) this.put(x, y, ch);
  }

  carve(x0: number, y0: number, x1: number, y1: number) {
    this.fill(x0, y0, x1, y1, '.');
  }

  ground(x0: number, x1: number, top: number) {
    this.fill(x0, 0, x1, top - 1, '#');
  }

  // lowers (or raises) the surface of an existing stretch to `top`
  surface(x0: number, x1: number, top: number, from = 0) {
    this.fill(x0, from, x1, this.rows - 1, '.');
    this.fill(x0, from, x1, top - 1, '#');
  }

  plat(x: number, top: number, len: number) {
    for (let i = 0; i < len; i++) this.put(x + i, top - 1, '=');
  }

  // zig-zag staircase of thin platforms from surface `from` to `to`, two cells wide, alternating sides
  climb(xLeft: number, from: number, to: number, width = 2, gap = 0) {
    for (let t = from, k = 0; t <= to; t++, k++) this.plat(xLeft + (k % 2) * (width + gap), t, width);
  }

  at(x: number, top: number, ch: string) {
    this.put(x, top, ch);
  }

  spikes(x0: number, x1: number, top: number) {
    for (let x = x0; x <= x1; x++) this.put(x, top, '^');
  }

  secret(x0: number, y0: number, x1: number, y1: number) {
    this.fill(x0, y0, x1, y1, 'S');
  }

  toMap(): string[] {
    return this.g.map((r) => r.join(''));
  }
}
