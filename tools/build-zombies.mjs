// Packs the two zombie characters into atlases (same format as build-sprites.mjs, written to undead.json):
//   - "Zombie animations" by Irina Mir (irmirx), CC-BY 3.0 (credit required): the classic zombie
//   - "2D Zombie Kids Free Sprite" by CraftPix / Free Game Assets: the zombie girl
// Frames come in different canvas sizes, so each one is trimmed and pinned to the same foot point.
// Usage: node tools/build-zombies.mjs <irmirx dir> <zombie kids "PNG/Animation" dir> [out dir]
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';

const [irmirx, kidsDir, out = 'public/sprites'] = process.argv.slice(2);
if (!irmirx || !kidsDir) throw new Error('usage: build-zombies.mjs <irmirx dir> <kids Animation dir> [out]');

const COLS = 8;
const seq = (dir, prefix, n) => Array.from({ length: n }, (_, i) => path.join(dir, `${prefix}${i + 1}.png`));

const SOURCES = {
  zombie: {
    flip: true, // the originals face left
    strike: { attack: 0.4 },
    anims: {
      idle: seq(path.join(irmirx, 'idle'), 'idle_', 6),
      walk: seq(path.join(irmirx, 'walk'), 'go_', 10),
      attack: seq(path.join(irmirx, 'attack'), 'hit_', 7),
      die: seq(path.join(irmirx, 'die'), 'die_', 8),
    },
    alias: { run: 'walk', attack2: 'attack', jump: 'idle' },
  },
  kid: {
    flip: false,
    strike: { attack: 0.5 },
    anims: {
      idle: seq(kidsDir, 'Idle_', 4),
      walk: seq(kidsDir, 'Walk_', 6),
      run: seq(kidsDir, 'Run_', 10),
      attack: seq(kidsDir, 'Attack_', 6),
      die: seq(kidsDir, 'Dead_', 8),
      jump: seq(kidsDir, 'Jump_', 7),
    },
    alias: { attack2: 'attack' },
  },
};

// variant: [source, hue, saturation, brightness, scale]
const VARIANTS = {
  zombie: ['zombie', 0, 1, 1, 0.5],
  zombie_brute: ['zombie', -75, 0.9, 0.78, 0.8],
  zombie_king: ['zombie', 120, 1.25, 0.72, 0.9],
  kid: ['kid', 0, 1, 1, 0.45],
};

// loads a frame, trims it and finds where its feet are
async function load(file, flip) {
  let img = sharp(file);
  if (flip) img = img.flop();
  const { data, info } = await img.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let x0 = 1e9, x1 = 0, y0 = 1e9, y1 = 0;
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
    if (data[(y * info.width + x) * 4 + 3] > 16) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  }
  // feet: average x of the opaque pixels in the lowest rows
  let sx = 0, n = 0;
  for (let y = Math.max(y0, y1 - 24); y <= y1; y++) for (let x = x0; x <= x1; x++) if (data[(y * info.width + x) * 4 + 3] > 16) { sx += x; n++; }
  const fx = sx / n;
  const crop = await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).extract({ left: x0, top: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 }).png().toBuffer();
  return { crop, left: fx - x0, right: x1 - fx, up: y1 - y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

const loaded = {};
for (const [name, src] of Object.entries(SOURCES)) {
  const anims = {};
  let L = 0, R = 0, UP = 0, bodyUp = 0;
  for (const [anim, files] of Object.entries(src.anims)) {
    anims[anim] = [];
    for (const f of files) {
      const fr = await load(f, src.flip);
      anims[anim].push(fr);
      L = Math.max(L, fr.left);
      R = Math.max(R, fr.right);
      UP = Math.max(UP, fr.up);
    }
  }
  bodyUp = anims.idle[0].up;
  loaded[name] = { anims, L: Math.ceil(L), R: Math.ceil(R), UP: Math.ceil(UP), bodyUp };
  console.log(name, { L: loaded[name].L, R: loaded[name].R, UP: loaded[name].UP, bodyUp });
}

fs.mkdirSync(out, { recursive: true });
const manifest = {};
for (const [name, [srcName, hue, sat, bri, scale]] of Object.entries(VARIANTS)) {
  const src = SOURCES[srcName];
  const ld = loaded[srcName];
  const cw = ld.L + ld.R + 3;
  const ch = ld.UP + 1;
  const fw = Math.round(cw * scale);
  const fh = Math.round(ch * scale);
  const entry = { fw, fh, anchorX: ld.L * scale, anchorY: ld.UP * scale, bodyH: ld.bodyUp * scale, anims: {} };
  for (const [anim, frames] of Object.entries(ld.anims)) {
    const rows = Math.ceil(frames.length / COLS);
    const parts = [];
    for (let i = 0; i < frames.length; i++) {
      const fr = frames[i];
      // pin the frame's feet at (L, UP) inside a cell of size cw x ch
      const base = await sharp({ create: { width: cw, height: ch, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
        .composite([{ input: fr.crop, left: Math.round(ld.L - fr.left), top: ld.UP - fr.up }])
        .png()
        .toBuffer();
      let cell = sharp(base).resize(fw, fh);
      if (hue || sat !== 1 || bri !== 1) cell = cell.modulate({ hue, saturation: sat, brightness: bri });
      parts.push({ input: await cell.png().toBuffer(), left: (i % COLS) * fw, top: Math.floor(i / COLS) * fh });
    }
    const file = `${name}_${anim}.webp`;
    await sharp({ create: { width: COLS * fw, height: rows * fh, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite(parts).webp({ quality: 80, alphaQuality: 90 }).toFile(path.join(out, file));
    entry.anims[anim] = { file, frames: frames.length, cols: COLS, step: 1, strike: src.strike[anim] };
  }
  for (const [alias, target] of Object.entries(src.alias)) if (!entry.anims[alias]) entry.anims[alias] = entry.anims[target];
  manifest[name] = entry;
  console.log('built', name, `${fw}x${fh}`);
}
fs.writeFileSync(path.join(out, 'undead.json'), JSON.stringify(manifest));
