// Packs the "Free Graveyard Platformer Tileset" (pzUH, CC0) into one atlas for the cemetery levels.
// Usage: node tools/build-scenery.mjs <.../GraveyardTileset/png dir> [out dir]
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';

const [src, out = 'public/sprites'] = process.argv.slice(2);
if (!src) throw new Error('usage: build-scenery.mjs <png dir> [out]');

const WIDTH = 1024;
const items = [];
for (let i = 1; i <= 16; i++) items.push({ name: `tile${i}`, file: path.join(src, 'Tiles', `Tile (${i}).png`) });
const objects = {
  tree: 'Tree.png', deadbush: 'DeadBush.png', tomb1: 'TombStone (1).png', tomb2: 'TombStone (2).png',
  bush1: 'Bush (1).png', bush2: 'Bush (2).png', crate: 'Crate.png', sign: 'Sign.png', arrow: 'ArrowSign.png',
  skeleton: 'Skeleton.png', skull1: 'Bones (1).png', skull2: 'Bones (2).png', bones1: 'Bones (3).png', bones2: 'Bones (4).png',
};
for (const [name, f] of Object.entries(objects)) items.push({ name, file: path.join(src, 'Objects', f.startsWith('Bones') ? '../Tiles/' + f : f) });

// simple shelf packing
let x = 0, y = 0, rowH = 0;
const frames = {};
const parts = [];
for (const it of items) {
  const buf = await sharp(it.file).toBuffer();
  const m = await sharp(buf).metadata();
  if (x + m.width > WIDTH) { x = 0; y += rowH + 2; rowH = 0; }
  frames[it.name] = { x, y, w: m.width, h: m.height };
  parts.push({ input: buf, left: x, top: y });
  x += m.width + 2;
  rowH = Math.max(rowH, m.height);
}
const height = y + rowH;
fs.mkdirSync(out, { recursive: true });
await sharp({ create: { width: WIDTH, height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
  .composite(parts).webp({ quality: 85, alphaQuality: 95 }).toFile(path.join(out, 'scenery.webp'));
fs.writeFileSync(path.join(out, 'scenery.json'), JSON.stringify(frames));

// night sky with the moon and distant woods
await sharp(path.join(src, 'BG.png')).resize(1600).webp({ quality: 72 }).toFile(path.join(out, 'graveyard-bg.webp'));
console.log('atlas', WIDTH, height, Object.keys(frames).length, 'frames');
