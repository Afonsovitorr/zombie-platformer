export interface SpawnDef {
  type: string; // key of ENEMIES
  x: number;
  y?: number; // spawn height; defaults to the ground
}

export interface BossDef {
  type: string;
  x: number;
  arena: [x0: number, x1: number]; // walls rise at these x when the player crosses x0 + 4
}

export interface LevelDef {
  id: string;
  name: string;
  theme: 'cemetery' | 'forest' | 'castle';
  ground: [x0: number, x1: number][];
  floating: [x0: number, x1: number, top: number][];
  spawns: SpawnDef[];
  checkpoints: number[];
  goalX: number;
  boss?: BossDef;
}

const on = (top: number) => top + 0.05;

export const LEVELS: LevelDef[] = [
  {
    id: 'cemetery',
    name: 'Cemitério da Vila',
    theme: 'cemetery',
    ground: [[-12, 28], [32, 58], [62, 88], [92, 125]],
    floating: [[10, 15, 3], [17, 22, 5.8], [40, 45, 3], [47, 52, 4.6], [70, 75, 3], [77, 82, 5.8], [100, 106, 3]],
    spawns: [
      { type: 'walker', x: 14 }, { type: 'walker', x: 24 }, { type: 'walker', x: 38 },
      { type: 'runner', x: 50 }, { type: 'walker', x: 66 }, { type: 'runner', x: 74 },
      { type: 'walker', x: 84 }, { type: 'brute', x: 98 }, { type: 'walker', x: 108 },
      { type: 'runner', x: 114 },
    ],
    checkpoints: [34, 64, 94],
    goalX: 120,
  },
  {
    id: 'forest',
    name: 'Floresta Sombria',
    theme: 'forest',
    ground: [[-12, 20], [25, 45], [50, 62], [68, 100], [106, 140]],
    floating: [
      [8, 13, 3], [15, 19, 5.8],
      [28, 33, 3], [35, 40, 5.8], [42, 46, 8.4],
      [53, 58, 3], [60, 64, 5.8],
      [72, 77, 3], [79, 84, 5.8], [86, 91, 3], [93, 98, 5.8],
      [110, 115, 3], [117, 122, 5.8], [124, 129, 3],
    ],
    spawns: [
      { type: 'walker', x: 11 }, { type: 'archer', x: 17, y: on(5.8) },
      { type: 'walker', x: 22 }, { type: 'hound', x: 30 }, { type: 'archer', x: 37.5, y: on(5.8) },
      { type: 'walker', x: 41 }, { type: 'walker', x: 48 }, { type: 'hound', x: 55 },
      { type: 'archer', x: 62, y: on(5.8) }, { type: 'runner', x: 70 }, { type: 'walker', x: 76 },
      { type: 'archer', x: 81.5, y: on(5.8) }, { type: 'hound', x: 88 }, { type: 'walker', x: 96 },
      { type: 'necro', x: 112 }, { type: 'runner', x: 118 }, { type: 'brute', x: 126 },
      { type: 'hound', x: 132 },
    ],
    checkpoints: [27, 52, 70, 108],
    goalX: 136,
  },
  {
    id: 'castle',
    name: 'Castelo em Ruínas',
    theme: 'castle',
    ground: [[-12, 30], [35, 55], [60, 85], [90, 152]],
    floating: [[12, 17, 3], [19, 23, 5.8], [40, 45, 3], [47, 51, 5.8], [65, 70, 3], [72, 77, 5.8]],
    spawns: [
      { type: 'walker', x: 8 }, { type: 'hound', x: 16 }, { type: 'archer', x: 21, y: on(5.8) },
      { type: 'walker', x: 27 }, { type: 'brute', x: 44 }, { type: 'archer', x: 49, y: on(5.8) },
      { type: 'runner', x: 53 }, { type: 'necro', x: 68 }, { type: 'walker', x: 63 },
      { type: 'archer', x: 74.5, y: on(5.8) }, { type: 'brute', x: 80 }, { type: 'hound', x: 83 },
      { type: 'walker', x: 96 }, { type: 'runner', x: 99 }, { type: 'necro', x: 106 },
    ],
    checkpoints: [37, 62, 92, 112],
    goalX: 146,
    boss: { type: 'carnical_rei', x: 142, arena: [118, 151] },
  },
];
