import type { DecimalSource } from '../core/numbers';

/** Rareté d'un poisson — pilote la difficulté du mini-jeu et le revenu. */
export enum Rarity {
  Common = 'common',
  Rare = 'rare',
  Epic = 'epic',
  Legendary = 'legendary',
  Mythic = 'mythic',
}

export const RARITY_ORDER: Rarity[] = [
  Rarity.Common,
  Rarity.Rare,
  Rarity.Epic,
  Rarity.Legendary,
  Rarity.Mythic,
];

export const RARITY_LABEL: Record<Rarity, string> = {
  [Rarity.Common]: 'Commune',
  [Rarity.Rare]: 'Rare',
  [Rarity.Epic]: 'Épique',
  [Rarity.Legendary]: 'Légendaire',
  [Rarity.Mythic]: 'Mythique',
};

export const RARITY_COLOR: Record<Rarity, number> = {
  [Rarity.Common]: 0x9fb8c8,
  [Rarity.Rare]: 0x6cb6ff,
  [Rarity.Epic]: 0xb98cff,
  [Rarity.Legendary]: 0xffcf6c,
  [Rarity.Mythic]: 0xff7cc4,
};

export type BiomeId =
  | 'tropical'
  | 'coldwater'
  | 'reef'
  | 'deepsea'
  | 'abyssal'
  | 'mythic';

/**
 * Paramètres du mini-jeu de pêche — mécanique TIMING / PRÉCISION.
 * Un curseur balaie une barre en ping-pong ; le joueur frappe (clic/Espace)
 * quand le curseur chevauche la zone cible.
 */
export interface FishingDifficulty {
  /** Allers-retours du curseur par seconde (vitesse de balayage). */
  sweepSpeed: number;
  /** Largeur de la zone cible (fraction 0..1 de la barre). */
  zoneSize: number;
  /** Largeur de la sous-zone « Parfait » (bonus), incluse dans la zone. */
  perfectSize: number;
  /** Nombre de frappes réussies nécessaires pour ferrer le poisson. */
  requiredHits: number;
  /** Ratés autorisés avant rupture de la ligne. */
  missTolerance: number;
  /** La zone cible se repositionne après chaque frappe (raretés élevées). */
  zoneShuffle: boolean;
}

export interface FishRequirements {
  biome: BiomeId;
  minTemp: number; // °C
  maxTemp: number; // °C
  minVolume: number; // unités de volume du bac
}

/** Définition complète d'une espèce — structure extensible à 100+ poissons. */
export interface FishSpecies {
  id: string;
  name: string;
  rarity: Rarity;
  /** Revenu de base par tick. Multiplié par les bonus globaux à l'exécution. */
  baseRevenuePerTick: DecimalSource;
  fishingDifficulty: FishingDifficulty;
  requirements: FishRequirements;
  /** Clé du mesh low-poly dans le MeshRegistry. */
  modelRef: string;
  /** Couleur flat-shading (override esthétique). */
  tint: number;
  /** Échelle visuelle relative. */
  scale: number;
  /** Prédateur : mange les poissons de classe de taille inférieure (M3). */
  predator: boolean;
  /** Classe de taille 1 (petit) .. 3 (grand) — prédation & compatibilité. */
  sizeClass: number;
}

/** Catégorie d'amélioration de boutique. */
export type UpgradeKind = 'filter' | 'pump' | 'food' | 'decoration' | 'heater';

export interface Upgrade {
  id: string;
  name: string;
  description: string;
  kind: UpgradeKind;
  /** Courbe de coût géométrique : base · growth^niveau. */
  cost: { base: DecimalSource; growth: number };
  /** Niveau maximum (0 = illimité). */
  maxLevel: number;
  /** Bonus multiplicatif au revenu global par niveau (ex 0.05 = +5%/niveau). */
  revenueMultPerLevel: number;
  /** Recherche débloquante (optionnel). */
  requiresResearch?: string;
}

export interface ResearchNode {
  id: string;
  name: string;
  description: string;
  cost: DecimalSource; // en Points de Recherche
  /** Prérequis (autres nœuds). */
  requires: string[];
  /** Effets déclaratifs appliqués à l'achat. */
  effects: ResearchEffect[];
  /** Position dans l'arbre (pour l'UI). */
  position: { x: number; y: number };
}

export type ResearchEffect =
  | { type: 'unlockBiome'; biome: BiomeId }
  | { type: 'unlockUpgrade'; upgradeId: string }
  | { type: 'globalRevenueMult'; value: number }
  | { type: 'researchRateMult'; value: number }
  | { type: 'unlockTank'; tankTemplate: string };

export interface Biome {
  id: BiomeId;
  name: string;
  description: string;
  baseTemp: number;
  /** Couleur d'eau (flat). */
  waterColor: number;
}
