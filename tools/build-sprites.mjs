// Packs the "Knight, Princess and Dragon 2" frame sequences (CC0, by akylrum) into compact atlases.
// Usage: node tools/build-sprites.mjs <path to .../MaximumBounds> [out dir]
// Each character gets one atlas per animation (grid of frames, webp) plus manifest.json.
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';

const src = process.argv[2];
const out = process.argv[3] ?? 'public/sprites';
if (!src) throw new Error('usage: build-sprites.mjs <MaximumBounds dir> [out]');

const SCALE = 0.5;
const COLS = 8;

// variant: [source character, hue shift (deg), saturation, brightness, scale (optional)]
const VARIANTS = {
  hero: ['Knight', 0, 1, 1],
  walker: ['Knight', 100, 0.85, 0.92],
  runner: ['Knight', 140, 0.6, 0.78],
  brute: ['Knight', 70, 0.7, 0.62],
  king: ['Knight', 100, 1.35, 0.68],
  necro: ['Princess', 100, 0.8, 0.8],
  archer: ['Princess', 150, 0.6, 0.85],
  heroine: ['Princess', 0, 1, 1],
  whelp: ['Dragon', 80, 0.6, 0.9, 0.4],
  drake: ['Dragon', 90, 0.4, 0.62, 0.8],
};
// animation name in the pack -> game name, and every how-manyeth frame to keep
const ANIMS = { Idle: ['idle', 2], Walk: ['walk', 1], Run: ['run', 1], Jump: ['jump', 2], Attack: ['attack', 1], Attack2: ['attack2', 1], Die: ['die', 1] };

const listFrames = (c, a) =>
  fs.readdirSync(path.join(src, c)).filter((f) => f.startsWith(`${c}-${a}_`) && f.endsWith('.png')).sort().map((f) => path.join(src, c, f));

async function alphaBox(file) {
  const { data, info } = await sharp(file).raw().toBuffer({ resolveWithObject: true });
  let x0 = 1e9, x1 = 0, y0 = 1e9, y1 = 0;
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
    if (data[(y * info.width + x) * 4 + 3] > 16) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  }
  return { x0, x1, y0, y1 };
}

// union box over every frame of a character so all of its animations share one anchor
const crops = {};
for (const c of new Set(Object.values(VARIANTS).map((v) => v[0]))) {
  let u = { x0: 1e9, x1: 0, y0: 1e9, y1: 0 };
  for (const a of Object.keys(ANIMS)) for (const f of listFrames(c, a)) {
    const b = await alphaBox(f);
    u = { x0: Math.min(u.x0, b.x0), x1: Math.max(u.x1, b.x1), y0: Math.min(u.y0, b.y0), y1: Math.max(u.y1, b.y1) };
  }
  // feet: bottom of the idle pose, centred on the lowest rows
  const idle = await alphaBox(listFrames(c, 'Idle')[0]);
  const { data, info } = await sharp(listFrames(c, 'Idle')[0]).raw().toBuffer({ resolveWithObject: true });
  let sx = 0, n = 0;
  for (let y = idle.y1 - 25; y <= idle.y1; y++) for (let x = 0; x < info.width; x++) if (data[(y * info.width + x) * 4 + 3] > 16) { sx += x; n++; }
  crops[c] = { ...u, feetX: sx / n, feetY: idle.y1, bodyTop: idle.y0 };
  console.log(c, crops[c]);
}

fs.mkdirSync(out, { recursive: true });
const manifest = {};
for (const [name, [c, hue, sat, bri, vscale]] of Object.entries(VARIANTS)) {
  const SC = vscale ?? SCALE;
  const cr = crops[c];
  const w = cr.x1 - cr.x0 + 1;
  const h = cr.y1 - cr.y0 + 1;
  const fw = Math.round(w * SC);
  const fh = Math.round(h * SC);
  const entry = { fw, fh, anchorX: (cr.feetX - cr.x0) * SC, anchorY: (cr.feetY - cr.y0) * SC, bodyH: (cr.feetY - cr.bodyTop) * SC, anims: {} };
  for (const [a, [key, step]] of Object.entries(ANIMS)) {
    const files = listFrames(c, a).filter((_, i) => i % step === 0);
    if (!files.length) continue;
    const rows = Math.ceil(files.length / COLS);
    const parts = [];
    for (let i = 0; i < files.length; i++) {
      let img = sharp(files[i]).extract({ left: cr.x0, top: cr.y0, width: w, height: h }).resize(fw, fh);
      if (hue || sat !== 1 || bri !== 1) img = img.modulate({ hue, saturation: sat, brightness: bri });
      parts.push({ input: await img.png().toBuffer(), left: (i % COLS) * fw, top: Math.floor(i / COLS) * fh });
    }
    const file = `${name}_${key}.webp`;
    await sharp({ create: { width: COLS * fw, height: rows * fh, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite(parts).webp({ quality: 80, alphaQuality: 90 }).toFile(path.join(out, file));
    entry.anims[key] = { file, frames: files.length, cols: COLS, step };
  }
  manifest[name] = entry;
  console.log('built', name);
}
fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify(manifest));
