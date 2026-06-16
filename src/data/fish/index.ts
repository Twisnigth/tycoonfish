import type { BiomeId, FishSpecies, Rarity } from '../types';
import { TROPICAL_FISH } from './tropical';
import { COLDWATER_FISH } from './coldwater';
import { REEF_FISH } from './reef';
import { DEEPSEA_FISH } from './deepsea';
import { ABYSSAL_FISH } from './abyssal';
import { MYTHIC_FISH } from './mythic';

/** Registre global de toutes les espèces, tous biomes confondus. */
export const ALL_FISH: FishSpecies[] = [
  ...TROPICAL_FISH,
  ...COLDWATER_FISH,
  ...REEF_FISH,
  ...DEEPSEA_FISH,
  ...ABYSSAL_FISH,
  ...MYTHIC_FISH,
];

const BY_ID = new Map<string, FishSpecies>(ALL_FISH.map((f) => [f.id, f]));

export function getFish(id: string): FishSpecies | undefined {
  return BY_ID.get(id);
}

export function requireFish(id: string): FishSpecies {
  const f = BY_ID.get(id);
  if (!f) throw new Error(`Espèce inconnue: ${id}`);
  return f;
}

export function fishByBiome(biome: BiomeId): FishSpecies[] {
  return ALL_FISH.filter((f) => f.requirements.biome === biome);
}

export function fishByRarity(rarity: Rarity): FishSpecies[] {
  return ALL_FISH.filter((f) => f.rarity === rarity);
}
