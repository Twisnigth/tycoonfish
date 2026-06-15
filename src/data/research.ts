import type { ResearchNode } from './types';

/**
 * Arbre de recherche. Les Points de Recherche s'accumulent passivement
 * (proportionnels à la diversité de poissons élevés) et débloquent biomes,
 * améliorations avancées et multiplicateurs globaux.
 * `position` sert au tracé de l'arbre dans l'UI (graphe à embranchements).
 */
export const RESEARCH: ResearchNode[] = [
  {
    id: 'basic-husbandry',
    name: 'Aquariophilie de base',
    description: 'Fondamentaux de l\'élevage. +25 % de revenu global.',
    cost: 10,
    requires: [],
    effects: [{ type: 'globalRevenueMult', value: 0.25 }],
    position: { x: 0, y: 0 },
  },
  {
    id: 'thermal-control',
    name: 'Contrôle thermique',
    description: 'Débloque le chauffage de précision.',
    cost: 40,
    requires: ['basic-husbandry'],
    effects: [{ type: 'unlockUpgrade', upgradeId: 'heater' }],
    position: { x: -1, y: 1 },
  },
  {
    id: 'cold-biome',
    name: 'Adaptation eaux froides',
    description: 'Débloque le biome Eaux Froides et ses espèces.',
    cost: 80,
    requires: ['thermal-control'],
    effects: [{ type: 'unlockBiome', biome: 'coldwater' }],
    position: { x: -1, y: 2 },
  },
  {
    id: 'aquaculture',
    name: 'Aquaculture',
    description: 'Débloque le distributeur automatique. +50 % de revenu global.',
    cost: 120,
    requires: ['basic-husbandry'],
    effects: [
      { type: 'unlockUpgrade', upgradeId: 'auto-feeder' },
      { type: 'globalRevenueMult', value: 0.5 },
    ],
    position: { x: 1, y: 1 },
  },
  {
    id: 'genetics',
    name: 'Génétique avancée',
    description: 'Sélection optimisée. La recherche s\'accumule 2× plus vite.',
    cost: 300,
    requires: ['aquaculture'],
    effects: [{ type: 'researchRateMult', value: 1.0 }],
    position: { x: 1, y: 2 },
  },
];

const RESEARCH_BY_ID = new Map(RESEARCH.map((r) => [r.id, r]));
export const getResearch = (id: string): ResearchNode | undefined => RESEARCH_BY_ID.get(id);
