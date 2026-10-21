import type { LevelSource } from '../levels';
import { MapBuilder } from './builder';

// Torre do Dragão: three halls stacked in a tower, joined by climbing shafts that alternate sides, and the
// Dead Dragon's lair at the very top.
function build() {
  const W = 130;
  const H = 72;
  const m = new MapBuilder(W, H);
  m.fill(0, 0, W - 1, H - 1, '#');

  // ---- first hall (floor at surface 6) ----
  m.carve(2, 6, 100, 13);
  m.at(3, 6, 'P');
  m.at(14, 6, 'C');
  m.at(24, 6, 'f');
  m.plat(28, 7, 2);
  m.plat(30, 8, 3);
  m.at(31, 8, '$');
  m.at(40, 6, 'x');
  m.spikes(46, 47, 6);
  m.at(54, 6, 'c');
  m.at(66, 6, 'i');
  m.at(80, 6, 'q');
  m.at(90, 6, 'k');
  m.carve(96, 14, 99, 21);
  m.climb(96, 7, 22, 2);

  // ---- second hall (floor at surface 22) ----
  m.carve(20, 22, 104, 29);
  m.at(98, 22, 'M');
  m.at(93, 22, 'C');
  m.at(84, 22, 'o');
  m.at(70, 22, 'e');
  m.at(58, 22, 'y');
  m.at(48, 22, 'l');
  m.at(38, 22, 'm');
  m.plat(30, 23, 2);
  m.plat(32, 24, 3);
  m.at(33, 24, '$');
  // hidden room at the west end
  m.carve(10, 22, 18, 24);
  m.secret(19, 22, 19, 23);
  m.at(14, 22, '*');
  m.carve(22, 30, 25, 37);
  m.climb(22, 23, 38, 2);

  // ---- third hall (floor at surface 38) ----
  m.carve(20, 38, 104, 45);
  m.at(26, 38, 'C');
  m.at(34, 38, 'd');
  m.at(35, 38, 'd');
  m.spikes(46, 47, 38);
  m.at(56, 38, 'g');
  m.at(70, 38, 'x');
  m.at(80, 38, 'o');
  m.at(90, 38, 'f');
  m.plat(60, 39, 2);
  m.plat(62, 40, 3);
  m.at(63, 40, '$');
  m.carve(96, 46, 99, 53);
  m.climb(96, 39, 54, 2);

  // ---- the lair (floor at surface 54, open all the way up) ----
  m.carve(8, 54, 118, 69);
  m.at(60, 54, 'B');
  m.at(110, 54, 'G');
  m.at(104, 54, 'C');

  m.fill(0, 0, 0, H - 1);
  m.fill(W - 1, 0, W - 1, H - 1);
  return m.toMap();
}

export const tower: LevelSource = {
  id: 'tower',
  name: 'Torre do Dragão',
  theme: 'crypt',
  map: build(),
  boss: { type: 'dragao', arena: [16, 116] },
};
