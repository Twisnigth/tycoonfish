import { Rarity, type FishingDifficulty } from './types';
import { D, type DecimalSource } from '../core/numbers';

/**
 * ===========================================================================
 *  CONSTANTES D'ÉQUILIBRAGE CENTRALISÉES
 *  Toutes les valeurs qui pilotent la longévité du jeu sont ici, et nulle
 *  part ailleurs. Modifier l'équilibre = éditer ce seul fichier.
 * ===========================================================================
 */

/** Fréquence du tick logique (revenus, recherche), en millisecondes. */
export const TICK_MS = 1000;

/** Fréquence de mise à jour des boids (IA poissons), en Hz. */
export const BOID_HZ = 20;

/** Plafond de progression hors-ligne, en heures. */
export const OFFLINE_CAP_HOURS = 8;
/** Rendement hors-ligne (les revenus passifs hors-ligne sont réduits). */
export const OFFLINE_EFFICIENCY = 0.5;

/** Argent de départ. */
export const STARTING_MONEY: DecimalSource = 50;
/** Appâts de départ (pour lancer les premières expéditions de pêche). */
export const STARTING_BAIT = 10;

/**
 * Profil de difficulté du mini-jeu TIMING par rareté.
 * Rareté ↑  =>  curseur plus rapide, zone plus petite, plus de frappes,
 * moins de droit à l'erreur, zone qui se repositionne.
 */
export const RARITY_PROFILE: Record<Rarity, FishingDifficulty> = {
  [Rarity.Common]:    { sweepSpeed: 0.8, zoneSize: 0.40, perfectSize: 0.15, requiredHits: 3, missTolerance: 4, zoneShuffle: false },
  [Rarity.Rare]:      { sweepSpeed: 1.2, zoneSize: 0.30, perfectSize: 0.10, requiredHits: 4, missTolerance: 3, zoneShuffle: false },
  [Rarity.Epic]:      { sweepSpeed: 1.8, zoneSize: 0.22, perfectSize: 0.07, requiredHits: 5, missTolerance: 3, zoneShuffle: true  },
  [Rarity.Legendary]: { sweepSpeed: 2.4, zoneSize: 0.16, perfectSize: 0.05, requiredHits: 6, missTolerance: 2, zoneShuffle: true  },
  [Rarity.Mythic]:    { sweepSpeed: 3.2, zoneSize: 0.11, perfectSize: 0.03, requiredHits: 7, missTolerance: 2, zoneShuffle: true  },
};

/**
 * Multiplicateur de revenu de base par rareté. Sert de référence quand on
 * définit `baseRevenuePerTick` d'une espèce (croissance ~×12 par palier).
 */
export const RARITY_REVENUE_BASE: Record<Rarity, DecimalSource> = {
  [Rarity.Common]: 1,
  [Rarity.Rare]: 12,
  [Rarity.Epic]: 150,
  [Rarity.Legendary]: 2_000,
  [Rarity.Mythic]: 30_000,
};

/** Prix d'achat d'un appât en boutique (monnaie courante). */
export const BAIT_PRICE: DecimalSource = 8;

/** Coût d'une expédition de pêche selon la rareté ciblée (en appâts). */
export const BAIT_COST: Record<Rarity, number> = {
  [Rarity.Common]: 1,
  [Rarity.Rare]: 3,
  [Rarity.Epic]: 8,
  [Rarity.Legendary]: 20,
  [Rarity.Mythic]: 50,
};

/** Bonus de qualité (multiplicateur de revenu du poisson pêché) selon la performance. */
export const CATCH_QUALITY_BONUS = {
  /** Au moins une frappe « Parfait » sur la prise. */
  perfect: 1.5,
  /** Aucun raté. */
  flawless: 1.25,
  normal: 1,
};

/** Courbe de coût géométrique générique : coût(n) = base · growth^n. */
export interface CostCurve {
  base: DecimalSource;
  growth: number;
}

/** Coût du n-ième achat (0-indexé) d'une courbe géométrique. */
export function costAt(curve: CostCurve, level: number) {
  return D(curve.base).mul(D(curve.growth).pow(level));
}

/**
 * Coût cumulé de `count` achats à partir du niveau `from`.
 * Forme close de la série géométrique — pas de boucle, scalable.
 *   base · growth^from · (growth^count − 1) / (growth − 1)
 */
export function bulkCost(curve: CostCurve, from: number, count: number) {
  const g = D(curve.growth);
  const num = g.pow(count).sub(1);
  const den = g.sub(1);
  return D(curve.base).mul(g.pow(from)).mul(num).div(den);
}

/** Coût d'agrandissement d'un bac (augmente le volume). */
export const TANK_UPGRADE_COST: CostCurve = { base: 100, growth: 1.18 };
/** Gain de volume par niveau d'agrandissement. */
export const TANK_VOLUME_PER_LEVEL = 8;

/** Paliers majeurs d'évolution du complexe (machine d'états ProgressionFSM). */
export interface ProgressionTier {
  id: number;
  name: string;
  /** Argent total gagné requis pour débloquer ce palier. */
  threshold: DecimalSource;
  /** Description affichée. */
  blurb: string;
}

export const PROGRESSION_TIERS: ProgressionTier[] = [
  { id: 0, name: 'DÉBUT',          threshold: 0,        blurb: 'Un minuscule bac cubique.' },
  { id: 1, name: 'Petit Aquarium', threshold: 1_000,    blurb: 'Le premier vrai bac.' },
  { id: 2, name: 'Galerie',        threshold: 25_000,   blurb: 'Plusieurs bacs alignés.' },
  { id: 3, name: 'Pavillon',       threshold: 500_000,  blurb: 'Un pavillon vitré.' },
  { id: 4, name: 'Aquaparc',       threshold: 1e7,      blurb: 'Bassins reliés par des tuyaux.' },
  { id: 5, name: 'Dôme Océanique', threshold: 5e8,      blurb: 'Premier dôme sous-marin.' },
  { id: 6, name: 'Complexe',       threshold: 1e10,     blurb: 'Réseau de dômes + monorail.' },
  { id: 7, name: 'GRAND COMPLEXE', threshold: 1e13,     blurb: 'Cité sous-marine de créatures mythiques.' },
];
