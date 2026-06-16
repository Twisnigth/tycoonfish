import { Rarity, type BiomeId, type FishingDifficulty } from './types';
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

/** Niveau de Parc minimal pour lancer une expédition d'une rareté donnée (time-gating). */
export const RARITY_MIN_LEVEL: Record<Rarity, number> = {
  [Rarity.Common]: 1,
  [Rarity.Rare]: 2,
  [Rarity.Epic]: 4,
  [Rarity.Legendary]: 7,
  [Rarity.Mythic]: 10,
};

/**
 * Recherche : on PAIE en argent pour LANCER une recherche, qui prend ensuite du
 * TEMPS (durée en ms de temps de jeu, accélérée par le nombre de Laboratoires).
 * Une seule recherche active à la fois ; chaîne de prérequis. On débloque ainsi
 * les RARETÉS de poissons et les ÉQUIPEMENTS d'aquarium.
 */
const MIN = 60_000; // 1 minute de temps de jeu

export interface ResearchItem {
  id: string;
  label: string;
  category: 'rarity' | 'equipment';
  cost: number; // argent pour lancer
  durationMs: number; // temps de jeu (à 1 labo)
  requires?: string;
}

export const RESEARCH: ResearchItem[] = [
  // Raretés (chaînées, de plus en plus longues/chères)
  { id: 'res-rare', label: 'Espèces Rares', category: 'rarity', cost: 1500, durationMs: 10 * MIN },
  { id: 'res-epic', label: 'Espèces Épiques', category: 'rarity', cost: 6000, durationMs: 20 * MIN, requires: 'res-rare' },
  { id: 'res-legendary', label: 'Espèces Légendaires', category: 'rarity', cost: 25000, durationMs: 35 * MIN, requires: 'res-epic' },
  { id: 'res-mythic', label: 'Espèces Mythiques', category: 'rarity', cost: 100000, durationMs: 60 * MIN, requires: 'res-legendary' },
  // Équipements d'aquarium (débloqués par la recherche, plus par le niveau)
  { id: 'res-filter', label: 'Filtre', category: 'equipment', cost: 600, durationMs: 4 * MIN },
  { id: 'res-oxygenator', label: 'Pompe à O₂', category: 'equipment', cost: 900, durationMs: 5 * MIN },
  { id: 'res-autofeeder', label: 'Distributeur auto', category: 'equipment', cost: 1100, durationMs: 6 * MIN, requires: 'res-filter' },
  { id: 'res-lighting', label: 'Éclairage récifal', category: 'equipment', cost: 1000, durationMs: 6 * MIN },
  { id: 'res-heater', label: 'Régulateur thermique', category: 'equipment', cost: 1600, durationMs: 8 * MIN, requires: 'res-filter' },
  { id: 'res-doser', label: 'Doseur automatique', category: 'equipment', cost: 2600, durationMs: 10 * MIN, requires: 'res-heater' },
];

export const RESEARCH_BY_ID: Record<string, ResearchItem> = Object.fromEntries(RESEARCH.map((r) => [r.id, r]));

/** Map rareté → id de recherche qui la débloque (Common = toujours ouvert). */
export const RARITY_RESEARCH: Partial<Record<Rarity, string>> = {
  [Rarity.Rare]: 'res-rare',
  [Rarity.Epic]: 'res-epic',
  [Rarity.Legendary]: 'res-legendary',
  [Rarity.Mythic]: 'res-mythic',
};

/** Map équipement → id de recherche qui le débloque. */
export const EQUIPMENT_RESEARCH: Record<string, string> = {
  filter: 'res-filter',
  oxygenator: 'res-oxygenator',
  autofeeder: 'res-autofeeder',
  lighting: 'res-lighting',
  heater: 'res-heater',
  doser: 'res-doser',
};

/** Niveau de Parc minimal pour DÉBLOQUER un biome (mode Histoire). Sandbox = tout ouvert. */
export const BIOME_MIN_LEVEL: Record<BiomeId, number> = {
  tropical: 1,
  coldwater: 1,
  reef: 3,
  deepsea: 5,
  abyssal: 7,
  mythic: 9,
};

/** Durée d'incubation d'un œuf (temps de jeu, ms) — plus c'est rare, plus c'est long. */
export const BREED_DURATION_MS: Record<Rarity, number> = {
  [Rarity.Common]: 60_000,
  [Rarity.Rare]: 120_000,
  [Rarity.Epic]: 240_000,
  [Rarity.Legendary]: 420_000,
  [Rarity.Mythic]: 600_000,
};

/** Probabilité que le petit hérite de gènes AMÉLIORÉS (plus élevée pour les espèces rares). */
export const BREED_BOOST_CHANCE: Record<Rarity, number> = {
  [Rarity.Common]: 0.2,
  [Rarity.Rare]: 0.3,
  [Rarity.Epic]: 0.4,
  [Rarity.Legendary]: 0.5,
  [Rarity.Mythic]: 0.6,
};

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
