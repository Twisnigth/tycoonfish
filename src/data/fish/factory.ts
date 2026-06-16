import {
  Rarity,
  RARITY_COLOR,
  type BiomeId,
  type FishSpecies,
  type FishingDifficulty,
} from '../types';
import { RARITY_PROFILE, RARITY_REVENUE_BASE } from '../balance';
import { D } from '../../core/numbers';

/**
 * Forme compacte de définition d'un poisson. La factory remplit
 * automatiquement la difficulté de pêche (depuis le profil de rareté) et le
 * revenu de base (depuis la rareté × un facteur). Décrire une espèce ne
 * coûte donc que ~5 lignes — scalable à 100+ poissons sans copier-coller.
 */
export interface FishDef {
  id: string;
  name: string;
  rarity: Rarity;
  biome: BiomeId;
  /** Multiplie la base de revenu de rareté (défaut 1). Crée la variété intra-rareté. */
  revenueFactor?: number;
  /** Plage de température tolérée [min, max] en °C. */
  temp?: [number, number];
  /** Volume minimal requis du bac. */
  minVolume?: number;
  /** Archétype de mesh low-poly (défaut 'fish.basic'). */
  modelRef?: string;
  /** Couleur flat-shading (défaut = couleur de rareté). */
  tint?: number;
  /** Échelle visuelle (défaut 1). */
  scale?: number;
  /** Ajustements fins de la difficulté, par-dessus le profil de rareté. */
  difficulty?: Partial<FishingDifficulty>;
  /** Prédateur (mange les plus petits). Défaut false. */
  predator?: boolean;
  /** Classe de taille 1..3. Défaut déduit de `scale`. */
  sizeClass?: number;
}

export function defineFish(def: FishDef): FishSpecies {
  const profile = RARITY_PROFILE[def.rarity];
  const [minTemp, maxTemp] = def.temp ?? [18, 28];

  return {
    id: def.id,
    name: def.name,
    rarity: def.rarity,
    baseRevenuePerTick: D(RARITY_REVENUE_BASE[def.rarity]).mul(def.revenueFactor ?? 1),
    fishingDifficulty: { ...profile, ...def.difficulty },
    requirements: {
      biome: def.biome,
      minTemp,
      maxTemp,
      minVolume: def.minVolume ?? 1,
    },
    modelRef: def.modelRef ?? 'fish.basic',
    tint: def.tint ?? RARITY_COLOR[def.rarity],
    scale: def.scale ?? 1,
    predator: def.predator ?? false,
    sizeClass: def.sizeClass ?? sizeFromScale(def.scale ?? 1),
  };
}

/** Déduit une classe de taille (1..3) à partir de l'échelle visuelle. */
function sizeFromScale(scale: number): number {
  if (scale < 1.2) return 1;
  if (scale < 1.8) return 2;
  return 3;
}
