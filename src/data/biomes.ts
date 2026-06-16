import type { BiomeId } from './types';

/**
 * Métadonnées de biome (M8) — nom, couleur d'eau (pour le shader du bac) et
 * température ambiante indicative. Les 6 biomes sont jouables ; la progression
 * vient de la rareté des espèces, pas d'un verrou de biome.
 */
export interface BiomeMeta {
  id: BiomeId;
  name: string;
  waterColor: number;
  ambientTemp: number;
  /** pH idéal de l'eau pour ce biome (échelle 5..9). */
  idealPh: number;
  /** Salinité idéale en ppt (0 = eau douce, ~35 = eau de mer). */
  idealSalinity: number;
}

export const BIOMES: Record<BiomeId, BiomeMeta> = {
  tropical: { id: 'tropical', name: 'Tropical', waterColor: 0x3fa9c9, ambientTemp: 25, idealPh: 7.0, idealSalinity: 2 },
  coldwater: { id: 'coldwater', name: 'Eaux froides', waterColor: 0x4f86c6, ambientTemp: 8, idealPh: 7.5, idealSalinity: 0 },
  reef: { id: 'reef', name: 'Récif corallien', waterColor: 0x2ec4b6, ambientTemp: 26, idealPh: 8.2, idealSalinity: 35 },
  deepsea: { id: 'deepsea', name: 'Eaux profondes', waterColor: 0x1f4e79, ambientTemp: 5, idealPh: 8.0, idealSalinity: 35 },
  abyssal: { id: 'abyssal', name: 'Abysses', waterColor: 0x142a4a, ambientTemp: 2, idealPh: 8.0, idealSalinity: 35 },
  mythic: { id: 'mythic', name: 'Mythique', waterColor: 0x7e57c2, ambientTemp: 15, idealPh: 7.5, idealSalinity: 20 },
};

export const ALL_BIOMES: BiomeId[] = Object.keys(BIOMES) as BiomeId[];

export const biomeWaterColor = (b: BiomeId): number => BIOMES[b]?.waterColor ?? 0x3fa9c9;
export const biomeName = (b: BiomeId): string => BIOMES[b]?.name ?? b;
