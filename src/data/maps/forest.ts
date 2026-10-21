import type { LevelSource } from '../levels';
import { MapBuilder } from './builder';

// Floresta Sombria. A root cave under the chasm, a huge tree to climb (with a hidden hollow inside) and the
// Ogre in a clearing at the end.
function build() {
  const W = 170;
  const H = 48;
  const m = new MapBuilder(W, H);
  m.ground(0, W - 1, 14);

  // ---- the glade (x 0-40) ----
  m.at(3, 14, 'P');
  m.at(10, 14, 'z');
  m.at(20, 14, 'l');
  m.at(24, 14, 'x');
  m.at(27, 14, 'C');
  m.ground(29, 32, 15);
  m.ground(33, 36, 16);
  m.ground(37, 40, 17);

  // ---- the plateau (x 41-170) ----
  m.ground(41, W - 1, 18);
  m.at(44, 18, 'M');
  m.at(47, 18, 'C');

  // chasm over the root cave, bridged by branches
  m.carve(49, 8, 56, 17);
  m.plat(49, 18, 2);
  m.plat(52, 18, 2);
  m.plat(55, 18, 2);
  m.at(53, 21, 'k');

  // ---- the root cave (x 49-73, floor at surface 8) ----
  m.carve(57, 8, 73, 13);
  m.at(60, 8, 'e');
  m.plat(60, 9, 2);
  m.plat(62, 10, 3);
  m.at(63, 10, '$');
  m.at(66, 8, 'q');
  m.at(70, 8, 'f');
  // way back up: a shaft of branches
  m.carve(70, 8, 73, 17);
  m.climb(70, 9, 18);
  // hidden chamber east of the cave
  m.carve(75, 8, 80, 10);
  m.secret(74, 8, 74, 9);
  m.at(77, 8, '*');

  // ---- the open ground before the tree (x 57-93) ----
  m.at(60, 18, 'b');
  m.plat(64, 19, 3);
  m.at(65, 19, 'a');
  m.at(78, 18, 'o');
  m.at(85, 18, 'x');
  m.at(88, 18, 'l');

  // ---- the great tree (x 96-107): climb the west side, hollow inside ----
  m.fill(96, 18, 107, 33, '#');
  m.carve(97, 18, 104, 26);
  m.secret(96, 18, 96, 19);
  m.at(101, 18, '*');
  m.climb(90, 19, 34, 3);
  m.at(91, 24, 'k');
  m.at(94, 28, 'o');
  m.at(91, 31, 'k');
  m.at(98, 34, 'C');
  m.at(103, 34, 'M');
  m.at(106, 34, '$');
  // branches on the east side for the way down
  m.plat(109, 30, 3);
  m.at(110, 30, 'a');
  m.plat(113, 26, 3);
  m.plat(117, 22, 3);
  m.at(118, 22, 'a');

  // ---- the east woods (x 108-141) ----
  m.at(112, 18, 'z');
  m.at(116, 18, 'd');
  m.at(122, 18, 'l');
  m.at(128, 18, 'q');
  m.at(132, 18, 'C');
  m.at(135, 18, 'g');
  m.at(139, 18, 'b');

  // ---- the clearing (x 142-168) ----
  m.at(160, 18, 'B');
  m.at(166, 18, 'G');

  m.fill(0, 0, 0, H - 1);
  m.fill(W - 1, 0, W - 1, H - 1);
  return m.toMap();
}

export const forest: LevelSource = {
  id: 'forest',
  name: 'Floresta Sombria',
  theme: 'forest',
  map: build(),
  boss: { type: 'ogro', arena: [142, 168] },
};
