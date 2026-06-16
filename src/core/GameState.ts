import { Decimal, D } from './numbers';
import type { BiomeId } from '../data/types';
import type { BuildingType } from '../data/buildings';
import { STARTING_BAIT } from '../data/balance';

/** Données d'un bac (pour les bâtiments de type tank). */
export interface TankState {
  id: string;
  name: string;
  biome: BiomeId;
  volume: number;
  waterTemp: number;
  fish: Record<string, number>; // speciesId -> nombre
}

/** Un bâtiment posé sur la grille. */
export interface PlacedBuilding {
  id: string;
  type: BuildingType;
  gx: number;
  gy: number;
  rot: 0 | 1 | 2 | 3;
  tank?: TankState; // uniquement si type === tank_*
}

export interface ParkState {
  ticketPrice: number;
  day: number;
  /** ms écoulées dans la journée courante. */
  dayTimeMs: number;
  appeal: number; // cache recalculé
  avgSatisfaction: number; // 0..1
  guestsInPark: number;
  incomeToday: Decimal;
  expensesToday: Decimal;
}

/**
 * État global v2 (Park Builder). NE contient PAS les tableaux de grille
 * (reconstruits depuis `buildings` + `plots` par le `Game`) ni les agents
 * (transitoires). Entièrement sérialisable (Decimal -> string au save).
 */
export interface GameState {
  schema: number;
  money: Decimal;
  research: Decimal;
  bait: number;

  buildings: PlacedBuilding[];
  /** Parcelles achetées en plus de la zone de départ (index d'origine packé). */
  plots: number[];

  /** Poissons pêchés en attente d'affectation à un bac. */
  caughtInventory: Record<string, number>;

  park: ParkState;

  unlockedBiomes: BiomeId[];
  unlockedResearch: string[];

  stats: { fishCaught: number; guestsServed: number; playtimeMs: number };
  lastSaved: number;
}

let _id = 0;
export const nextId = (prefix: string): string => `${prefix}-${Date.now().toString(36)}-${_id++}`;

export function createTank(biome: BiomeId, volume: number, waterTemp: number): TankState {
  return { id: nextId('tank'), name: 'Bac', biome, volume, waterTemp, fish: {} };
}

/** État initial : terrain vide + une Porte d'Entrée au bord sud de la zone possédée. */
export function createInitialState(): GameState {
  const entrance: PlacedBuilding = {
    id: nextId('b'),
    type: 'entrance',
    gx: 23,
    gy: 29, // bord sud de la zone 12×12 (cases 18..29) sur une grille 48
    rot: 0,
  };
  return {
    schema: 2,
    money: D(1500),
    research: D(0),
    bait: STARTING_BAIT,
    buildings: [entrance],
    plots: [],
    caughtInventory: {},
    park: {
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
    stats: { fishCaught: 0, guestsServed: 0, playtimeMs: 0 },
    lastSaved: Date.now(),
  };
}
