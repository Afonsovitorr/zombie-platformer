export interface Stats {
  maxHp: number;
  maxStamina: number;
  damage: number;
  runSpeed: number;
}

export const BASE_STATS: Stats = { maxHp: 5, maxStamina: 100, damage: 1, runSpeed: 7 };

export type Branch = 'blade' | 'bastion' | 'hunter';

export interface SkillDef {
  id: string;
  branch: Branch;
  name: string;
  desc: string;
  cost: number; // souls
  requires?: string;
  effects: Partial<Stats>; // added to the base stats
}

export const SKILLS: SkillDef[] = [
  { id: 'blade_1', branch: 'blade', name: 'Fio afiado', desc: '+0,5 de dano', cost: 100, effects: { damage: 0.5 } },
  { id: 'blade_2', branch: 'blade', name: 'Mão pesada', desc: '+0,5 de dano', cost: 250, requires: 'blade_1', effects: { damage: 0.5 } },
  { id: 'bastion_1', branch: 'bastion', name: 'Coração forte', desc: '+1 de vida máxima', cost: 100, effects: { maxHp: 1 } },
  { id: 'bastion_2', branch: 'bastion', name: 'Fôlego de ferro', desc: '+25 de stamina máxima', cost: 150, requires: 'bastion_1', effects: { maxStamina: 25 } },
  { id: 'hunter_1', branch: 'hunter', name: 'Pernas leves', desc: '+0,7 de velocidade', cost: 100, effects: { runSpeed: 0.7 } },
];

export function statsFor(owned: string[]): Stats {
  const s = { ...BASE_STATS };
  for (const skill of SKILLS) {
    if (!owned.includes(skill.id)) continue;
    for (const [k, v] of Object.entries(skill.effects) as [keyof Stats, number][]) s[k] += v;
  }
  return s;
}
