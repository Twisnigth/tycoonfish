import { Decimal, D } from './numbers';
import type { BiomeId } from '../data/types';
import type { BuildingType } from '../data/buildings';
import type { Fish } from './Fish';
import { STARTING_BAIT } from '../data/balance';

/** Données d'un bac. Les poissons sont des ENTITÉS individuelles (rendu 1:1). */
export interface TankState {
  id: string;
  name: string;
  biome: BiomeId;
  volume: number;
  waterTemp: number;
  fish: Fish[];
  /** État de l'eau (activé en M3). */
  water: { quality: number; foodStock: number };
}

/** Un bâtiment posé sur la grille. */
export interface PlacedBuilding {
  id: string;
  type: BuildingType;
  gx: number;
  gy: number;
  rot: 0 | 1 | 2 | 3;
  tank?: TankState; // uniquement si type === tank_*
  /** Prix de vente réglable (boutiques : snacks/merch). */
  salePrice?: number;
}

export interface ParkState {
  /** Le parc accepte des visiteurs uniquement s'il est ouvert. */
  isOpen: boolean;
  ticketPrice: number;
  day: number;
  dayTimeMs: number;
  appeal: number;
  avgSatisfaction: number;
  guestsInPark: number;
  incomeToday: Decimal;
  expensesToday: Decimal;
}

/**
 * État global v3 (Park Builder + entités poissons). NE contient PAS les tableaux
 * de grille (reconstruits depuis `buildings` + `plots`) ni les agents
 * (transitoires). Sérialisable (Decimal -> string au save).
 */
export interface GameState {
  schema: number;
  money: Decimal;
  research: Decimal;
  bait: number;

  buildings: PlacedBuilding[];
  /** Parcelles achetées en plus de la zone de départ (index d'origine packé). */
  plots: number[];

  /** Poissons pêchés en attente d'affectation à un bac (entités individuelles). */
  caughtInventory: Fish[];

  park: ParkState;

  unlockedBiomes: BiomeId[];
  unlockedResearch: string[];

  /** Personnel embauché (M3 : soigneurs ; M5 : mécanos/vétos). */
  staff: { keepers: number };

  stats: { fishCaught: number; guestsServed: number; playtimeMs: number };
  lastSaved: number;
}

let _id = 0;
export const nextId = (prefix: string): string => `${prefix}-${Date.now().toString(36)}-${_id++}`;

export function createTank(biome: BiomeId, volume: number, waterTemp: number): TankState {
  return {
    id: nextId('tank'),
    name: 'Bac',
    biome,
    volume,
    waterTemp,
    fish: [],
    water: { quality: 1, foodStock: 1 },
  };
}

/**
 * État initial (schéma v3) : terrain vide, une Porte d'Entrée au bord sud de la
 * zone possédée, et deux cases de chemin déjà reliées à l'entrée (pour que les
 * visiteurs puissent entrer dès qu'on ouvre le parc).
 */
export function createInitialState(): GameState {
  const entrance: PlacedBuilding = { id: nextId('b'), type: 'entrance', gx: 23, gy: 29, rot: 0 };
  const startPaths: PlacedBuilding[] = [
    { id: nextId('b'), type: 'path', gx: 23, gy: 28, rot: 0 },
    { id: nextId('b'), type: 'path', gx: 24, gy: 28, rot: 0 },
  ];
  return {
    schema: 4,
    money: D(1500),
    research: D(0),
    bait: STARTING_BAIT,
    buildings: [entrance, ...startPaths],
    plots: [],
    caughtInventory: [],
    park: {
      isOpen: true,
      ticketPrice: 8,
      day: 1,
      dayTimeMs: 0,
      appeal: 0,
      avgSatisfaction: 1,
      guestsInPark: 0,
      incomeToday: D(0),
      expensesToday: D(0),
    },
    unlockedBiomes: ['tropical'],
    unlockedResearch: [],
    staff: { keepers: 0 },
    stats: { fishCaught: 0, guestsServed: 0, playtimeMs: 0 },
    lastSaved: Date.now(),
  };
}
