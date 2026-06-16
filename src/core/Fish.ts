import { nextId } from './GameState';

/**
 * Entité « poisson individuel » — fondation de tout le gameplay vivant.
 * Les champs `genes`/`vitals` sont déclarés dès maintenant (valeurs neutres) ;
 * ils resteront inertes jusqu'aux milestones qui les activent :
 *   - vitals (faim / âge / santé / stress) → M3 (survie) puis M4/M5
 *   - genes (taille / longévité / immunité / mutation) → M4 (génétique)
 * Conséquence du modèle : 1 poisson pêché = 1 entité = 1 modèle 3D (rendu 1:1).
 */

export interface FishGenes {
  /** Multiplicateur de taille (1 = standard). Un grand poisson rare attire plus. */
  size: number;
  /** Multiplicateur de durée de vie. */
  longevity: number;
  /** Résistance aux maladies (0..1+). */
  immunity: number;
  /** 0..1 — au-delà d'un seuil, variante de couleur (ex. albinos). */
  colorMutation: number;
}

export interface FishVitals {
  /** Secondes vécues. */
  age: number;
  /** 0 = rassasié … 1 = affamé. */
  hunger: number;
  /** 0..1. */
  health: number;
  /** 0..1 — monte si besoins d'habitat/sociaux non remplis. */
  stress: number;
}

export type FishOrigin = 'caught' | 'bred';

export interface Fish {
  id: string;
  /** Identifiant d'espèce (clé dans la base de données poissons). */
  species: string;
  alive: boolean;
  origin: FishOrigin;
  genes: FishGenes;
  vitals: FishVitals;
}

export const NEUTRAL_GENES: FishGenes = { size: 1, longevity: 1, immunity: 1, colorMutation: 0 };

export function createFish(
  speciesId: string,
  opts?: { origin?: FishOrigin; genes?: Partial<FishGenes> },
): Fish {
  return {
    id: nextId('fish'),
    species: speciesId,
    alive: true,
    origin: opts?.origin ?? 'caught',
    genes: { ...NEUTRAL_GENES, ...opts?.genes },
    vitals: { age: 0, hunger: 0, health: 1, stress: 0 },
  };
}
