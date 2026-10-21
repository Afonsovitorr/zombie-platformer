import type { LevelSource } from '../levels';
import { MapBuilder } from './builder';

// Cemitério da Vila. Two ways through: over the surface, or down the hole into the crypt (more loot, more danger)
// and back up the climbing shaft. A cracked wall in the shaft hides a rich chest. Ends on the hill with the Necromancer.
function build() {
  const W = 150;
  const H = 40;
  const GY = 14;
  const m = new MapBuilder(W, H);
  m.ground(0, W - 1, GY);

  // ---- the gate (x 0-30) ----
  m.at(3, GY, 'P');
  m.at(10, GY, 'w');
  m.at(17, GY, 'w');
  m.ground(18, 21, GY + 1);
  m.at(19, GY + 1, '$'); // a chest on the mound
  m.at(23, GY, 't');
  m.at(26, GY, 'C');
  m.surface(29, 30, GY - 1);
  m.spikes(29, 30, GY - 1);

  // ---- the graveyard (x 32-100) ----
  m.at(34, GY, 'w');
  m.plat(34, GY + 1, 2);
  m.plat(37, GY + 2, 3);
  m.plat(41, GY + 3, 2);
  m.at(42, GY + 3, '$');
  m.at(38, GY, 'r');
  m.at(43, GY, 'x');
  m.at(47, GY, 'C');
  m.at(50, GY, 'M');
  m.at(54, GY + 2, 'k');
  m.at(62, GY, 'o');
  m.at(66, GY, 'w');
  m.plat(70, GY + 1, 2);
  m.plat(73, GY + 2, 3);
  m.at(74, GY + 2, 'a');
  m.plat(77, GY + 1, 2);
  m.at(70, GY, 'l');
  m.at(80, GY, 'b');
  m.at(86, GY + 2, 'k');
  m.at(89, GY, 'w');
  m.at(93, GY, 'x');
  m.at(96, GY, 'f');

  // ---- the crypt (x 52-99, floor at surface 4) ----
  m.carve(52, 4, 99, 9);
  m.carve(57, 10, 58, 13); // the way down
  m.at(60, 4, 't');
  m.plat(64, 5, 2);
  m.plat(66, 6, 3);
  m.at(67, 6, '$');
  m.at(71, 4, 'f');
  m.spikes(74, 75, 4);
  m.at(78, 4, 'd');
  m.at(79, 4, 'd');
  m.at(80, 4, 'd');
  m.at(84, 4, 'q');
  m.at(88, 6, 'k');
  m.at(91, 4, 'm');
  m.at(94, 4, 'C');
  // west secret room behind a cracked wall
  m.carve(45, 4, 50, 6);
  m.secret(51, 4, 51, 5);
  m.at(47, 4, '*');

  m.ground(102, 105, GY + 1);
  m.ground(106, 109, GY + 2);
  m.ground(110, 113, GY + 3);
  m.ground(114, 117, GY + 4);
  m.ground(118, 121, GY + 5);
  m.ground(122, W - 1, GY + 6);

  // ---- the climbing shaft (x 98-101) and its secret ----
  m.carve(98, 4, 101, 13);
  m.climb(98, 5, 14);
  m.carve(103, 6, 108, 8);
  m.secret(102, 6, 102, 7);
  m.at(106, 6, '*');

  // ---- the mausoleum hill (x 102-149) ----
  m.at(104, GY + 1, 'm');
  m.at(108, GY + 2, 'b');
  m.at(112, GY + 3, 'a');
  m.at(116, GY + 4, 'a');
  m.at(120, GY + 5, 'n');
  m.at(124, GY + 6, 'C');
  m.at(126, GY + 6, 'M');

  // ---- the arena (x 128-148) ----
  m.at(142, GY + 6, 'B');
  m.at(146, GY + 6, 'G');

  // solid edges
  m.fill(0, 0, 0, H - 1);
  m.fill(W - 1, 0, W - 1, H - 1);
  return m.toMap();
}

export const cemetery: LevelSource = {
  id: 'cemetery',
  name: 'Cemitério da Vila',
  theme: 'cemetery',
  map: build(),
  boss: { type: 'necromante', arena: [128, 148] },
};
