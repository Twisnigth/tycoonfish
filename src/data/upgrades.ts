import type { Upgrade } from './types';

/**
 * Améliorations de boutique. Chaque niveau augmente un bonus GLOBAL de revenu
 * (filtres/pompes = meilleure santé des poissons = plus de rendement) et
 * apparaît physiquement en 3D sur les bacs. Coûts géométriques exponentiels.
 */
export const UPGRADES: Upgrade[] = [
  {
    id: 'filter',
    name: 'Filtre à eau',
    description: 'Eau plus propre : +6 % de revenu global par niveau.',
    kind: 'filter',
    cost: { base: 75, growth: 1.15 },
    maxLevel: 0,
    revenueMultPerLevel: 0.06,
  },
  {
    id: 'pump',
    name: "Pompe à oxygène",
    description: 'Meilleure oxygénation : +8 % de revenu global par niveau.',
    kind: 'pump',
    cost: { base: 250, growth: 1.17 },
    maxLevel: 0,
    revenueMultPerLevel: 0.08,
  },
  {
    id: 'heater',
    name: 'Chauffage de précision',
    description: 'Température stable : +10 % de revenu global par niveau.',
    kind: 'heater',
    cost: { base: 1_200, growth: 1.19 },
    maxLevel: 0,
    revenueMultPerLevel: 0.10,
    requiresResearch: 'thermal-control',
  },
  {
    id: 'auto-feeder',
    name: 'Distributeur automatique',
    description: 'Nourriture optimale : +12 % de revenu global par niveau.',
    kind: 'food',
    cost: { base: 9_000, growth: 1.21 },
    maxLevel: 0,
    revenueMultPerLevel: 0.12,
    requiresResearch: 'aquaculture',
  },
  {
    id: 'coral-decor',
    name: 'Récif décoratif',
    description: 'Cadre de vie : +5 % de revenu global par niveau.',
    kind: 'decoration',
    cost: { base: 500, growth: 1.14 },
    maxLevel: 0,
    revenueMultPerLevel: 0.05,
  },
];

const UPGRADES_BY_ID = new Map(UPGRADES.map((u) => [u.id, u]));
export const getUpgrade = (id: string): Upgrade | undefined => UPGRADES_BY_ID.get(id);
