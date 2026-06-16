import { nextId } from './GameState';

/**
 * Entité « poisson individuel » + génétique (M4). Chaque poisson a des gènes
 * (taille, longévité, immunité, mutation de couleur), une lignée (`family`) et
 * une fertilité. La reproduction transmet les gènes ; croiser la même lignée
 * (consanguinité) dégrade l'immunité et peut rendre stérile.
 */

export interface FishGenes {
  size: number; // 0.5..1.8 (1 = standard) — un grand spécimen attire plus
  longevity: number; // multiplicateur de durée de vie
  immunity: number; // résistance aux maladies
  colorMutation: number; // 0..1 — > seuil = albinos (visible)
}

export interface FishVitals {
  age: number;
  hunger: number;
  health: number;
  stress: number;
}

export type FishOrigin = 'caught' | 'bred';

export interface Fish {
  id: string;
  species: string;
  alive: boolean;
  origin: FishOrigin;
  /** Identifiant de lignée (consanguinité si deux parents la partagent). */
  family: number;
  fertile: boolean;
  genes: FishGenes;
  vitals: FishVitals;
}

export const NEUTRAL_GENES: FishGenes = { size: 1, longevity: 1, immunity: 1, colorMutation: 0 };
export const ALBINO_THRESHOLD = 0.9;
export const isAlbino = (g: FishGenes): boolean => g.colorMutation > ALBINO_THRESHOLD;

let _family = 0;
const newFamily = (): number => ++_family;
const rand = (lo: number, hi: number): number => lo + Math.random() * (hi - lo);
const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

/** Gènes d'un spécimen sauvage (pêché) — variabilité naturelle. */
export function rollWildGenes(): FishGenes {
  return {
    size: rand(0.7, 1.35),
    longevity: rand(0.7, 1.3),
    immunity: rand(0.7, 1.3),
    colorMutation: Math.random(),
  };
}

export function createFish(
  speciesId: string,
  opts?: { origin?: FishOrigin; genes?: FishGenes; family?: number; fertile?: boolean },
): Fish {
  return {
    id: nextId('fish'),
    species: speciesId,
    alive: true,
    origin: opts?.origin ?? 'caught',
    family: opts?.family ?? newFamily(),
    fertile: opts?.fertile ?? true,
    genes: opts?.genes ?? rollWildGenes(),
    vitals: { age: 0, hunger: 0, health: 1, stress: 0 },
  };
}

export interface BreedOutcome {
  child: Fish;
  inbred: boolean;
}

/** Croise deux poissons (même espèce) → un descendant aux gènes hérités + mutation. */
export function breedFish(a: Fish, b: Fish): BreedOutcome {
  const inbred = a.family === b.family;
  const mix = (x: number, y: number) => (x + y) / 2 + (Math.random() - 0.5) * 0.2;
  const genes: FishGenes = {
    size: clamp(mix(a.genes.size, b.genes.size), 0.5, 1.9),
    longevity: clamp(mix(a.genes.longevity, b.genes.longevity), 0.5, 1.7),
    // Consanguinité → immunité fortement réduite (maladies).
    immunity: clamp(mix(a.genes.immunity, b.genes.immunity) * (inbred ? 0.55 : 1), 0.25, 1.6),
    colorMutation: clamp(
      (a.genes.colorMutation + b.genes.colorMutation) / 2 + (Math.random() < 0.12 ? rand(0.2, 0.5) : (Math.random() - 0.5) * 0.1),
      0,
      1,
    ),
  };
  // Consanguinité → risque de stérilité.
  const fertile = inbred ? Math.random() > 0.45 : true;
  const child = createFish(a.species, { origin: 'bred', genes, family: a.family, fertile });
  return { child, inbred };
}
