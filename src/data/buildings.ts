import type { BiomeId } from './types';
import type { DecimalSource } from '../core/numbers';

/** Catégories d'objets constructibles (onglets de la barre de construction). */
export type BuildCategory = 'tanks' | 'infra' | 'paths' | 'decor';

export type BuildingType =
  | 'entrance'
  | 'path'
  | 'tank_tropical'
  | 'tank_large'
  | 'tank_cold'
  | 'food'
  | 'restroom'
  | 'giftshop'
  | 'bench'
  | 'tree'
  | 'lamp'
  | 'bin';

export interface BuildingDef {
  type: BuildingType;
  name: string;
  category: BuildCategory;
  /** Emprise en cases. */
  w: number;
  h: number;
  cost: DecimalSource;
  /** Entretien par jour (en argent). */
  maintenance: number;
  /** Attrait de base apporté au parc (les bacs ont un attrait DYNAMIQUE en plus). */
  appeal: number;
  /** Rendu : référence GLB. 'tank' = rendu procédural (TankView). */
  render: { kind: 'tank'; biome: BiomeId; temp: number } | { kind: 'building'; model: string } | { kind: 'decor'; model: string } | { kind: 'path' } | { kind: 'entrance' };
  /** Recherche requise pour débloquer. */
  requiresResearch?: string;
}

export const BUILDINGS: Record<BuildingType, BuildingDef> = {
  entrance: {
    type: 'entrance', name: 'Entrée', category: 'infra', w: 2, h: 1, cost: 0,
    maintenance: 0, appeal: 0, render: { kind: 'entrance' },
  },
  path: {
    type: 'path', name: 'Chemin', category: 'paths', w: 1, h: 1, cost: 5,
    maintenance: 0, appeal: 0, render: { kind: 'path' },
  },
  tank_tropical: {
    type: 'tank_tropical', name: 'Bac Tropical', category: 'tanks', w: 2, h: 2, cost: 200,
    maintenance: 20, appeal: 0, render: { kind: 'tank', biome: 'tropical', temp: 25 },
  },
  tank_large: {
    type: 'tank_large', name: 'Grand Bac', category: 'tanks', w: 3, h: 3, cost: 800,
    maintenance: 60, appeal: 0, render: { kind: 'tank', biome: 'tropical', temp: 25 },
  },
  tank_cold: {
    type: 'tank_cold', name: 'Bac Eaux Froides', category: 'tanks', w: 2, h: 2, cost: 500,
    maintenance: 35, appeal: 0, render: { kind: 'tank', biome: 'coldwater', temp: 8 },
    requiresResearch: 'cold-biome',
  },
  food: {
    type: 'food', name: 'Stand Snack', category: 'infra', w: 2, h: 2, cost: 300,
    maintenance: 15, appeal: 2, render: { kind: 'building', model: 'food' },
  },
  restroom: {
    type: 'restroom', name: 'Toilettes', category: 'infra', w: 2, h: 2, cost: 250,
    maintenance: 10, appeal: 1, render: { kind: 'building', model: 'restroom' },
  },
  giftshop: {
    type: 'giftshop', name: 'Boutique', category: 'infra', w: 2, h: 2, cost: 600,
    maintenance: 25, appeal: 3, render: { kind: 'building', model: 'giftshop' },
  },
  bench: {
    type: 'bench', name: 'Banc', category: 'decor', w: 1, h: 1, cost: 30,
    maintenance: 0, appeal: 1, render: { kind: 'decor', model: 'bench' },
  },
  tree: {
    type: 'tree', name: 'Arbre', category: 'decor', w: 1, h: 1, cost: 20,
    maintenance: 0, appeal: 2, render: { kind: 'decor', model: 'tree' },
  },
  lamp: {
    type: 'lamp', name: 'Lampadaire', category: 'decor', w: 1, h: 1, cost: 40,
    maintenance: 0, appeal: 1, render: { kind: 'decor', model: 'lamp' },
  },
  bin: {
    type: 'bin', name: 'Poubelle', category: 'decor', w: 1, h: 1, cost: 25,
    maintenance: 0, appeal: 1, render: { kind: 'decor', model: 'bin' },
  },
};

export const BUILDING_LIST: BuildingDef[] = Object.values(BUILDINGS);

/** Les types de bâtiments « stand » où les visiteurs dépensent (faim). */
export const FOOD_TYPES: BuildingType[] = ['food', 'giftshop'];
/** Prix d'un achat au stand. */
export const FOOD_PRICE: DecimalSource = 12;
/** Don moyen d'un visiteur devant un bac (× appeal du bac). */
export const DONATION_PER_APPEAL: DecimalSource = 0.8;
