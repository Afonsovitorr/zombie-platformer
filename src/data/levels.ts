export interface SpawnDef {
  type: string; // key of ENEMIES
  x: number;
}

export interface LevelDef {
  id: string;
  name: string;
  ground: [x0: number, x1: number][];
  floating: [x0: number, x1: number, top: number][];
  spawns: SpawnDef[];
  checkpoints: number[];
  goalX: number;
}

export const LEVELS: LevelDef[] = [
  {
    id: 'cemetery',
    name: 'Cemitério da Vila',
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
];
