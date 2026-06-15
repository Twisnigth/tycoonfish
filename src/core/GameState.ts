import { Decimal, D } from './numbers';
import type { BiomeId } from '../data/types';
import { STARTING_BAIT, STARTING_MONEY, TANK_VOLUME_PER_LEVEL } from '../data/balance';

/** État d'un bac : son biome, ses stats physiques et sa population. */
export interface TankState {
  id: string;
  name: string;
  biome: BiomeId;
  /** Niveau d'agrandissement (pilote le volume). */
  level: number;
  /** Volume courant (dérivé du niveau, stocké pour accès rapide). */
  volume: number;
  /** Température de l'eau (°C). */
  waterTemp: number;
  /** Population économique : speciesId -> nombre. Découplé du rendu. */
  fish: Record<string, number>;
}

/**
 * État global du jeu — UNIQUE source de vérité, entièrement sérialisable.
 * Les `Decimal` sont convertis en chaîne par le SaveSystem.
 */
export interface GameState {
  /** Version du schéma de sauvegarde (migrations futures). */
  schema: number;
  money: Decimal;
  research: Decimal;
  bait: number;

  tanks: TankState[];

  /** Niveaux d'améliorations achetées : upgradeId -> niveau. */
  upgrades: Record<string, number>;
  /** Nœuds de recherche débloqués. */
  unlockedResearch: string[];
  /** Biomes débloqués. */
  unlockedBiomes: BiomeId[];

  /** Palier d'évolution courant du complexe (ProgressionFSM). */
  progressionTier: number;
  /** Cumul historique de l'argent gagné (sert aux seuils de progression). */
  totalEarned: Decimal;

  stats: {
    fishCaught: number;
    playtimeMs: number;
  };

  /** Horodatage (epoch ms) de la dernière sauvegarde — pour l'offline. */
  lastSaved: number;
}

function volumeForLevel(level: number): number {
  return TANK_VOLUME_PER_LEVEL * (level + 1);
}

export function createTank(
  id: string,
  name: string,
  biome: BiomeId,
  level = 0,
  waterTemp = 25,
): TankState {
  return {
    id,
    name,
    biome,
    level,
    volume: volumeForLevel(level),
    waterTemp,
    fish: {},
  };
}

/** État initial : le minuscule bac cubique « DÉBUT ». */
export function createInitialState(): GameState {
  return {
    schema: 1,
    money: D(STARTING_MONEY),
    research: D(0),
    bait: STARTING_BAIT,
    tanks: [createTank('tank-0', 'Bac de départ', 'tropical', 0, 25)],
    upgrades: {},
    unlockedResearch: [],
    unlockedBiomes: ['tropical'],
    progressionTier: 0,
    totalEarned: D(0),
    stats: { fishCaught: 0, playtimeMs: 0 },
    lastSaved: Date.now(),
  };
}

export { volumeForLevel };
