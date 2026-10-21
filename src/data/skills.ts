export interface Stats {
  maxHp: number;
  maxStamina: number;
  damage: number;
  runSpeed: number;
  maxArrows: number;
  parryWindow: number; // seconds after raising the shield in which a hit is a parry
  airJumps: number;
}

export const BASE_STATS: Stats = {
  maxHp: 5, maxStamina: 100, damage: 1, runSpeed: 7, maxArrows: 10, parryWindow: 0.18, airJumps: 0,
};

export type Branch = 'blade' | 'bastion' | 'hunter';

export const BRANCH_NAMES: Record<Branch, string> = { blade: 'Lâmina', bastion: 'Bastião', hunter: 'Caçador' };

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
  { id: 'bastion_3', branch: 'bastion', name: 'Guarda perfeita', desc: 'janela de parry maior', cost: 200, requires: 'bastion_1', effects: { parryWindow: 0.07 } },
  { id: 'hunter_1', branch: 'hunter', name: 'Pernas leves', desc: '+0,7 de velocidade', cost: 100, effects: { runSpeed: 0.7 } },
  { id: 'hunter_2', branch: 'hunter', name: 'Aljava maior', desc: '+5 flechas', cost: 120, requires: 'hunter_1', effects: { maxArrows: 5 } },
  { id: 'hunter_3', branch: 'hunter', name: 'Pulo duplo', desc: 'um pulo extra no ar', cost: 400, requires: 'hunter_1', effects: { airJumps: 1 } },
];

export function statsFor(owned: string[]): Stats {
  const s = { ...BASE_STATS };
  for (const skill of SKILLS) {
    if (!owned.includes(skill.id)) continue;
    for (const [k, v] of Object.entries(skill.effects) as [keyof Stats, number][]) s[k] += v;
  }
  return s;
}
