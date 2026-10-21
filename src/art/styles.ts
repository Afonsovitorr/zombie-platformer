import type { Style } from './rig';

// One body, many creatures: every character is a Style over the same skeleton.
export const STYLES: Record<string, Style> = {
  hero: {
    skin: 0xffcf9e, shirt: 0x3d7de0, trim: 0xf2c14e, pants: 0x5b4636, boots: 0x6b3f1d,
    head: 'helmet', face: 'hero', plume: 0xe03a3a, girth: 1, ragged: false, pauldrons: true,
    front: 'sword', back: 'shield',
  },
  heroBow: {
    skin: 0xffcf9e, shirt: 0x3d7de0, trim: 0xf2c14e, pants: 0x5b4636, boots: 0x6b3f1d,
    head: 'helmet', face: 'hero', plume: 0xe03a3a, girth: 1, ragged: false, pauldrons: true,
    front: 'none', back: 'bow',
  },
  walker: {
    skin: 0x9ad06a, shirt: 0x8a5fb8, trim: 0x6a4a90, pants: 0x6a5a48, boots: 0x4a3a30,
    hair: 0x3b4a2a, head: 'plain', face: 'zombie', girth: 1, ragged: true, pauldrons: false,
    front: 'none', back: 'none',
  },
  runner: {
    skin: 0xc4d860, shirt: 0xc8503a, trim: 0x8a3a2a, pants: 0x4a4a5a, boots: 0x3a3030,
    hair: 0x5a3a20, head: 'plain', face: 'zombie', girth: 0.8, ragged: true, pauldrons: false,
    front: 'none', back: 'none',
  },
  brute: {
    skin: 0x7fb069, shirt: 0x6a7a4a, trim: 0x4a5a30, pants: 0x4a3a30, boots: 0x2e2420,
    hair: 0x2a2a1a, head: 'plain', face: 'zombie', girth: 1.5, ragged: true, pauldrons: false,
    front: 'club', back: 'none',
  },
  archer: {
    skin: 0xf1ecd8, shirt: 0x5a4a6a, trim: 0x8a7aa0, pants: 0x3a3a4a, boots: 0x2a2a30,
    head: 'skull', face: 'skull', girth: 0.8, ragged: true, pauldrons: false,
    front: 'crossbow', back: 'none',
  },
  necro: {
    skin: 0xf1ecd8, shirt: 0x6a2f9e, trim: 0xb84dff, pants: 0x3a1f5a, boots: 0x2a1a40,
    head: 'hood', face: 'skull', girth: 0.95, ragged: true, pauldrons: false,
    front: 'staff', back: 'none', eye: 0xb84dff,
  },
  king: {
    skin: 0x7fc86a, shirt: 0x7a2030, trim: 0xf2c14e, pants: 0x3a2a4a, boots: 0x2a2030,
    hair: 0x1f2a14, head: 'crown', face: 'zombie', girth: 1.7, ragged: false, pauldrons: true,
    front: 'axe', back: 'none', cape: 0x5a1020,
  },
};
