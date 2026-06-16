import { Decimal, D } from './numbers';
import type { BiomeId } from '../data/types';
import { ALL_BIOMES, BIOMES } from '../data/biomes';
import type { BuildingType } from '../data/buildings';
import type { Fish } from './Fish';
import { RESEARCH, STARTING_BAIT } from '../data/balance';

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
  /** Enrichissement / décoration intérieure (0..1) — levier de bien-être (M7). */
  enrichment: number;
  /** Équipements installés (ids du catalogue equipment.ts) — M8. */
  equipment: string[];
  /** Décors 3D placés à l'intérieur du bac (ids decor) — M8. */
  decor: string[];
  /** Chimie de l'eau (M9) — leviers de bien-être réglables. */
  ph: number;
  salinity: number;
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
  /** Produits proposés (boutiques) — ids du catalogue products.ts. */
  products?: string[];
}

export interface ParkState {
  /** Le parc accepte des visiteurs uniquement s'il est ouvert. */
  isOpen: boolean;
  ticketPrice: number;
  day: number;
  dayTimeMs: number;
  appeal: number;
  /** Attractivité instantanée lissée (monte progressivement à l'ouverture). */
  popularity: number;
  avgSatisfaction: number;
  guestsInPark: number;
  incomeToday: Decimal;
  expensesToday: Decimal;
  /** Recettes du jour par source (nombres simples, pour le bilan ; reset chaque jour). */
  income: { tickets: number; donations: number; shops: number };
}

/**
 * État global v3 (Park Builder + entités poissons). NE contient PAS les tableaux
 * de grille (reconstruits depuis `buildings` + `plots`) ni les agents
 * (transitoires). Sérialisable (Decimal -> string au save).
 */
export type GameMode = 'story' | 'sandbox';

/** Un œuf en incubation à la Nursery (éclôt en un petit après un délai). */
export interface Egg {
  id: string;
  species: string;
  remainingMs: number;
  totalMs: number;
  child: Fish;
  boosted: boolean;
}

/** Rôle d'un employé. */
export type StaffRole = 'keeper' | 'janitor';

/** Un employé individuel (affectable à un bac pour les soigneurs). */
export interface Employee {
  id: string;
  role: StaffRole;
  /** Bac assigné (soigneur) ; null = libre (s'occupe de tout). */
  tankId: string | null;
}

export interface GameState {
  schema: number;
  /** Mode de jeu : 'story' (campagne à quêtes) ou 'sandbox' (libre). */
  mode: GameMode;
  /** Index de la quête active (mode Histoire). */
  questIndex: number;
  money: Decimal;
  /** Recherche en cours (payée, en décompte) ou null. */
  activeResearch: { id: string; remainingMs: number } | null;
  bait: number;

  buildings: PlacedBuilding[];
  /** Parcelles achetées en plus de la zone de départ (index d'origine packé). */
  plots: number[];

  /** Poissons pêchés en attente d'affectation à un bac (entités individuelles). */
  caughtInventory: Fish[];

  /** Œufs en incubation à la Nursery. */
  eggs: Egg[];

  park: ParkState;

  unlockedBiomes: BiomeId[];
  unlockedResearch: string[];

  /** Personnel embauché — employés individuels (soigneur / agent d'entretien). */
  staff: { employees: Employee[] };

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
    enrichment: 0.3,
    equipment: [],
    decor: [],
    ph: BIOMES[biome].idealPh,
    salinity: BIOMES[biome].idealSalinity,
  };
}

/**
 * État initial (schéma v3) : terrain vide, une Porte d'Entrée au bord sud de la
 * zone possédée, et deux cases de chemin déjà reliées à l'entrée (pour que les
 * visiteurs puissent entrer dès qu'on ouvre le parc).
 */
export function createInitialState(mode: GameMode = 'story'): GameState {
  const entrance: PlacedBuilding = { id: nextId('b'), type: 'entrance', gx: 23, gy: 29, rot: 0 };
  const startPaths: PlacedBuilding[] = [
    { id: nextId('b'), type: 'path', gx: 23, gy: 28, rot: 0 },
    { id: nextId('b'), type: 'path', gx: 24, gy: 28, rot: 0 },
  ];
  const sandbox = mode === 'sandbox';
  return {
    schema: 17,
    mode,
    questIndex: 0,
    money: D(sandbox ? 1_000_000 : 800),
    activeResearch: null,
    bait: sandbox ? 999 : STARTING_BAIT,
    buildings: [entrance, ...startPaths],
    plots: [],
    caughtInventory: [],
    eggs: [],
    park: {
      // Histoire : le parc démarre fermé (l'ouvrir est la 1re vraie quête).
      isOpen: sandbox,
      ticketPrice: 8,
      day: 1,
      dayTimeMs: 0,
      appeal: 0,
      popularity: 0,
      avgSatisfaction: 1,
      guestsInPark: 0,
      incomeToday: D(0),
      expensesToday: D(0),
      income: { tickets: 0, donations: 0, shops: 0 },
    },
    unlockedBiomes: [...ALL_BIOMES],
    unlockedResearch: sandbox ? RESEARCH.map((u) => u.id) : [],
    staff: { employees: [] },
    stats: { fishCaught: 0, guestsServed: 0, playtimeMs: 0 },
    lastSaved: Date.now(),
  };
}
