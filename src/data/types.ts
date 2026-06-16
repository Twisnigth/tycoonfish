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
  // ---- Bien-être / habitat (M7) ----
  /** Température idéale (°C) — au centre de la plage tolérée. */
  idealTemp: number;
  /** Volume requis par individu (espace vital). */
  spacePerFish: number;
  /** Taille de groupe minimale de la MÊME espèce pour le confort (banc). */
  socialMin: number;
  /** Agressif : stresse les co-occupants plus petits (au-delà de la prédation). */
  aggressive: boolean;
}
