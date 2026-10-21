import type { LevelSource } from '../levels';
import { MapBuilder } from './builder';

// Castelo em Ruínas. Three floors: a dungeon under the hall (reached through a broken floor), the great hall that
// leads to the throne room, and the battlements on top (a long detour with a hidden chest). The Carniçal Rei waits
// in the throne room.
function build() {
  const W = 190;
  const H = 56;
  const m = new MapBuilder(W, H);
  m.fill(0, 0, W - 1, H - 1, '#'); // solid rock, rooms are carved out of it

  // ---- the great hall (floor at surface 20) ----
  m.carve(2, 20, 127, 27);
  m.at(3, 20, 'P');
  m.at(9, 20, 'w');
  m.plat(12, 21, 3);
  m.at(13, 21, 'a');
  m.at(17, 20, 'w');
  m.at(22, 20, 'h');
  m.at(26, 20, 'C');
  m.spikes(30, 31, 20);
  m.at(34, 20, 'r');
  m.at(38, 22, 'k');

  // broken floor over the dungeon, bridged by beams
  m.carve(40, 14, 47, 19);
  m.plat(40, 20, 2);
  m.plat(43, 20, 2);
  m.plat(46, 20, 2);

  m.at(52, 20, 'b');
  m.plat(56, 21, 3);
  m.at(57, 21, 'o');
  m.at(62, 20, 'C');
  m.at(65, 20, 'M');
  m.at(70, 20, 'w');
  m.at(74, 20, 'n');
  m.at(78, 20, 'x');
  m.at(84, 20, 'h');
  m.at(86, 22, 'k');
  m.at(90, 20, 'b');
  m.plat(94, 21, 2);
  m.at(95, 21, '$');

  // ---- the dungeon (floor at surface 8) ----
  m.carve(36, 8, 110, 13);
  m.at(50, 8, 'e');
  m.at(56, 8, 'f');
  m.plat(58, 9, 2);
  m.plat(60, 10, 3);
  m.at(61, 10, '$');
  m.at(66, 8, 'q');
  m.at(68, 8, 'q');
  m.at(73, 8, 'g');
  m.at(80, 8, 'f');
  m.at(86, 8, 'm');
  m.at(92, 8, 'd');
  m.at(93, 8, 'd');
  m.at(94, 8, 'd');
  m.at(100, 8, 'C');
  m.spikes(76, 77, 8);
  // hidden cell west of the dungeon
  m.carve(28, 8, 34, 10);
  m.secret(35, 8, 35, 9);
  m.at(31, 8, '*');
  // climb back to the hall
  m.carve(106, 8, 109, 19);
  m.climb(106, 9, 20, 2);

  // ---- the stair to the battlements (x 100-105) ----
  m.carve(100, 28, 105, 33);
  m.climb(100, 21, 32, 3);
  m.at(98, 20, 'k');
  m.at(110, 20, 'a');
  m.at(114, 20, 'w');
  m.at(118, 20, 'n');
  m.at(122, 20, 'C');

  // ---- the battlements (floor at surface 32), open to the sky ----
  m.carve(70, 32, 170, H - 4);
  m.carve(124, 28, 127, 31); // a hole back down into the hall
  m.plat(124, 32, 2);
  m.plat(126, 32, 2);
  m.at(78, 32, 'y');
  m.at(86, 32, 'a');
  m.at(92, 32, 'o');
  m.at(110, 32, 'y');
  m.at(114, 32, 'a');
  m.at(120, 32, 'k');
  m.at(132, 32, 'x');
  m.at(138, 32, 'y');
  m.at(142, 32, 'o');
  m.at(148, 32, 'k');
  m.at(152, 32, 'a');
  m.at(156, 32, 'C');
  m.at(160, 32, '$');
  for (const x of [76, 90, 104, 118, 134, 146, 158]) m.put(x, 32, '#'); // merlons: cover for the archers
  m.carve(172, 32, 180, 34);
  m.secret(171, 32, 171, 33);
  m.at(176, 32, '*');

  // ---- the throne room (x 128-176) ----
  m.carve(128, 20, 176, 29);
  m.at(130, 20, 'M');
  m.at(160, 20, 'B');
  m.at(172, 20, 'G');

  m.fill(0, 0, 0, H - 1);
  m.fill(W - 1, 0, W - 1, H - 1);
  return m.toMap();
}

export const castle: LevelSource = {
  id: 'castle',
  name: 'Castelo em Ruínas',
  theme: 'castle',
  map: build(),
  boss: { type: 'carnical_rei', arena: [134, 174] },
};
