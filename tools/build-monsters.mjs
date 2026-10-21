// Packs the Bevouliin "Land Monster" collection (CC0, opengameart.org) into small atlases.
// Usage: node tools/build-monsters.mjs <dir with one folder per downloaded pack> [out dir]
// Each monster: frames (idle / hit / walk) bottom-centre aligned in one common cell, one webp each.
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';

const src = process.argv[2];
const out = process.argv[3] ?? 'public/sprites';
if (!src) throw new Error('usage: build-monsters.mjs <packs dir> [out]');

const MAX_H = 200; // tallest frame of a monster after resizing

// pack folder, then lists of frames (relative, case-insensitive) for each animation
const MONSTERS = {
  skull: ['bevouliin-flying-skull-sprite-sheets', { idle: ['Idle/frame-1', 'Idle/frame-2'], hit: ['got hit/frame'] }],
  horn_skull: ['bevouliin-horns-skull-sprite-sheets', { idle: ['idle/frame-1', 'idle/frame-2'], hit: ['got hit/frame'] }],
  shadow_skull: ['bevouliin-shadow-skull-game-asset', { idle: ['Idle/frame-1', 'Idle/frame-2'], hit: ['got hit/frame'] }],
  tomb: ['bevouliin-free-sprite-sheets-underground-worm-monster', { idle: ['frame-1', 'frame-2', 'frame-3', 'frame-4'], hit: ['frame-6'] }],
  plant: ['bevouliin-free-sprite-sheets-plant-monster', { idle: ['frame-1', 'frame-2'], hit: ['frame-2'] }],
  rock: ['enemy-game-character-rock-monster', { idle: ['rock_enemy_game_character'] }],
  brick: ['enemy-game-character-rock-monster-0', { idle: ['rock-monster'] }],
  gargoyle: ['enemy-game-character-rock-monster-1', { idle: ['rock-monster'] }],
  ice: ['icy-rock-monster-enemy-game-character', { idle: ['icy-rock-monster'] }],
  spike_green: ['free-game-obstacles-spiky-monster-bevouliin-game-asset', { idle: ['spiky-monster-game-obstacles-game-ornament'] }],
  spike_gold: ['free-ground-monster-sprite-sheet-for-game-developers', { idle: ['frame-1', 'frame-2'] }],
  spike_brown: ['spiky-monster-obstacle', { idle: ['spiky-monster'] }],
  imp: ['red-horn-land-monster', { idle: ['idle/frame-1', 'idle/frame-2'], hit: ['got hit/frame'] }],
  shade: ['limbo-land-monster-sprites-0', { idle: ['idle/frame-1', 'idle/frame-2'], hit: ['got hit/frame'] }],
  tomato: ['bevouliin-free-zombie-sprite-sheets-game-character-for-game-developers', { idle: ['idle/frame-1', 'idle/frame-2'], hit: ['got hit/frame-1', 'got hit/frame-2'] }],
  cyclops: ['bevouliin-free-enemy-villain-monster-game-asset-for-game-developers', { idle: ['Idle/frame-1', 'Idle/frame-2'], hit: ['got hit/frame-1', 'got hit/frame-2'] }],
  ogre: ['bevouliin-green-horn-monster-sprite-sheets', { idle: ['idle/frame-1', 'idle/frame-2'], hit: ['got hit/frame-1', 'got hit/frame-2'] }],
  blob: ['bevouliin-free-walking-monster-sprite-sheets', { idle: ['standing/frame-1', 'standing/frame-2', 'standing/frame-3', 'standing/frame-4', 'standing/frame-5', 'standing/frame-6'], walk: ['walking/frame-1', 'walking/frame-2'] }],
  skullstone: ['skull-game-obstacle', { idle: ['skull-game-obstacle'] }],
};

function find(dir, rel) {
  const want = rel.toLowerCase() + '.png';
  let hit = null;
  (function walk(d) {
    for (const f of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, f.name);
      if (f.isDirectory()) walk(p);
      else if (p.split(path.sep).join('/').toLowerCase().endsWith(want) && !hit) hit = p;
    }
  })(dir);
  if (!hit) throw new Error(`missing ${rel} in ${dir}`);
  return hit;
}

const manifest = {};
for (const [name, [pack, anims]] of Object.entries(MONSTERS)) {
  const frames = []; // { file, anim }
  for (const [anim, list] of Object.entries(anims)) for (const rel of list) frames.push({ anim, file: find(path.join(src, pack), rel) });
  // trim each frame, find the common cell
  const trimmed = [];
  for (const f of frames) trimmed.push({ ...f, buf: await sharp(f.file).trim({ threshold: 5 }).toBuffer({ resolveWithObject: true }) });
  const maxW = Math.max(...trimmed.map((t) => t.buf.info.width));
  const maxH = Math.max(...trimmed.map((t) => t.buf.info.height));
  const k = Math.min(1, MAX_H / maxH);
  const cw = Math.round(maxW * k);
  const ch = Math.round(maxH * k);
  const parts = [];
  const index = {};
  for (let i = 0; i < trimmed.length; i++) {
    const t = trimmed[i];
    const w = Math.max(1, Math.round(t.buf.info.width * k));
    const h = Math.max(1, Math.round(t.buf.info.height * k));
    const img = await sharp(t.buf.data).resize(w, h).png().toBuffer();
    parts.push({ input: img, left: i * cw + Math.round((cw - w) / 2), top: ch - h }); // bottom-centre
    (index[t.anim] ??= []).push(i);
  }
  const file = `m_${name}.webp`;
  await sharp({ create: { width: cw * trimmed.length, height: ch, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite(parts).webp({ quality: 82, alphaQuality: 90 }).toFile(path.join(out, file));
  manifest[name] = { file, cw, ch, frames: trimmed.length, anims: index };
  console.log(name, `${cw}x${ch}`, trimmed.length);
}
fs.writeFileSync(path.join(out, 'monsters.json'), JSON.stringify(manifest));
