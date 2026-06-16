import type { BiomeId } from './types';
import type { DecimalSource } from '../core/numbers';

/** Catégories d'objets constructibles (onglets de la barre de construction). */
export type BuildCategory = 'tanks' | 'infra' | 'paths' | 'decor';

export type BuildingType =
  | 'entrance'
  | 'path'
  | 'path_stone'
  | 'path_wood'
  | 'tank_tropical'
  | 'tank_large'
  | 'tank_cold'
  | 'food'
  | 'restroom'
  | 'giftshop'
  | 'bench'
  | 'tree'
  | 'lamp'
  | 'bin'
  | 'bench2'
  | 'fountain'
  | 'gazebo'
  | 'fishbone'
  | 'rock'
  | 'chest';

export interface BuildingDef {
  type: BuildingType;
  name: string;
  category: BuildCategory;
  w: number;
  h: number;
  cost: DecimalSource;
  maintenance: number;
  appeal: number;
  /** Taille cible du modèle 3D (plus grande dimension, unités monde). */
  modelSize: number;
  /** Couleur (pour les chemins, et fallback). */
  tint?: number;
  /** Prix de vente par défaut (boutiques : snacks/merch). Réglable par le joueur. */
  defaultSalePrice?: number;
  render:
    | { kind: 'tank'; biome: BiomeId; temp: number }
    | { kind: 'building'; model: string }
    | { kind: 'decor'; model: string }
    | { kind: 'path' }
    | { kind: 'entrance' };
  requiresResearch?: string;
}

export const BUILDINGS: Record<BuildingType, BuildingDef> = {
  entrance: {
    type: 'entrance', name: 'Entrée', category: 'infra', w: 2, h: 1, cost: 0,
    maintenance: 0, appeal: 0, modelSize: 4, render: { kind: 'entrance' },
  },
  path: {
    type: 'path', name: 'Chemin de terre', category: 'paths', w: 1, h: 1, cost: 5,
    maintenance: 0, appeal: 0, modelSize: 2, tint: 0xd8c9a0, render: { kind: 'path' },
  },
  path_stone: {
    type: 'path_stone', name: 'Chemin de pierre', category: 'paths', w: 1, h: 1, cost: 10,
    maintenance: 0, appeal: 1, modelSize: 2, tint: 0x9aa3a8, render: { kind: 'path' },
  },
  path_wood: {
    type: 'path_wood', name: 'Chemin de bois', category: 'paths', w: 1, h: 1, cost: 14,
    maintenance: 0, appeal: 1, modelSize: 2, tint: 0xb07a4a, render: { kind: 'path' },
  },
  tank_tropical: {
    type: 'tank_tropical', name: 'Bac Tropical', category: 'tanks', w: 2, h: 2, cost: 200,
    maintenance: 20, appeal: 0, modelSize: 4, render: { kind: 'tank', biome: 'tropical', temp: 25 },
  },
  tank_large: {
    type: 'tank_large', name: 'Grand Bac', category: 'tanks', w: 3, h: 3, cost: 800,
    maintenance: 60, appeal: 0, modelSize: 6, render: { kind: 'tank', biome: 'tropical', temp: 25 },
  },
  tank_cold: {
    type: 'tank_cold', name: 'Bac Eaux Froides', category: 'tanks', w: 2, h: 2, cost: 500,
    maintenance: 35, appeal: 0, modelSize: 4, render: { kind: 'tank', biome: 'coldwater', temp: 8 },
    requiresResearch: 'cold-biome',
  },
  food: {
    type: 'food', name: 'Stand Snack', category: 'infra', w: 2, h: 2, cost: 300,
    maintenance: 15, appeal: 2, modelSize: 3.6, defaultSalePrice: 12, render: { kind: 'building', model: 'food' },
  },
  giftshop: {
    type: 'giftshop', name: 'Boutique Souvenirs', category: 'infra', w: 2, h: 2, cost: 600,
    maintenance: 25, appeal: 3, modelSize: 3.6, defaultSalePrice: 28, render: { kind: 'building', model: 'giftshop' },
  },
  restroom: {
    type: 'restroom', name: 'Toilettes', category: 'infra', w: 2, h: 2, cost: 250,
    maintenance: 10, appeal: 1, modelSize: 3.4, render: { kind: 'building', model: 'restroom' },
  },
  bench: {
    type: 'bench', name: 'Banc', category: 'decor', w: 1, h: 1, cost: 30,
    maintenance: 0, appeal: 1, modelSize: 1.4, render: { kind: 'decor', model: 'bench' },
  },
  bench2: {
    type: 'bench2', name: 'Banc design', category: 'decor', w: 1, h: 1, cost: 45,
    maintenance: 0, appeal: 2, modelSize: 1.4, render: { kind: 'decor', model: 'bench2' },
  },
  tree: {
    type: 'tree', name: 'Arbre', category: 'decor', w: 1, h: 1, cost: 20,
    maintenance: 0, appeal: 2, modelSize: 2.6, render: { kind: 'decor', model: 'tree' },
  },
  lamp: {
    type: 'lamp', name: 'Lampadaire', category: 'decor', w: 1, h: 1, cost: 40,
    maintenance: 0, appeal: 1, modelSize: 2.8, render: { kind: 'decor', model: 'lamp' },
  },
  bin: {
    type: 'bin', name: 'Poubelle', category: 'decor', w: 1, h: 1, cost: 25,
    maintenance: 0, appeal: 1, modelSize: 0.8, render: { kind: 'decor', model: 'bin' },
  },
  fountain: {
    type: 'fountain', name: 'Fontaine', category: 'decor', w: 2, h: 2, cost: 160,
    maintenance: 2, appeal: 5, modelSize: 2.4, render: { kind: 'decor', model: 'fountain' },
  },
  gazebo: {
    type: 'gazebo', name: 'Gazebo', category: 'decor', w: 2, h: 2, cost: 120,
    maintenance: 1, appeal: 3, modelSize: 3.0, render: { kind: 'decor', model: 'gazebo' },
  },
  fishbone: {
    type: 'fishbone', name: 'Ossements', category: 'decor', w: 1, h: 1, cost: 35,
    maintenance: 0, appeal: 1, modelSize: 1.2, render: { kind: 'decor', model: 'fishbone' },
  },
  rock: {
    type: 'rock', name: 'Rocher', category: 'decor', w: 1, h: 1, cost: 18,
    maintenance: 0, appeal: 1, modelSize: 1.6, render: { kind: 'decor', model: 'rock' },
  },
  chest: {
    type: 'chest', name: 'Coffre au trésor', category: 'decor', w: 1, h: 1, cost: 60,
    maintenance: 0, appeal: 2, modelSize: 1.2, render: { kind: 'decor', model: 'treasure_chest' },
  },
};

export const BUILDING_LIST: BuildingDef[] = Object.values(BUILDINGS);

/** Types de chemins (cases marchables). */
export const PATH_TYPES: BuildingType[] = ['path', 'path_stone', 'path_wood'];
export const isPathType = (t: BuildingType): boolean => PATH_TYPES.includes(t);

/** Boutiques où les visiteurs dépensent (faim / souvenirs). */
export const FOOD_TYPES: BuildingType[] = ['food', 'giftshop'];
/** Prix de vente par défaut si non précisé. */
export const FOOD_PRICE: DecimalSource = 12;
/** Don moyen d'un visiteur devant un bac (× appeal du bac). */
export const DONATION_PER_APPEAL: DecimalSource = 0.8;
