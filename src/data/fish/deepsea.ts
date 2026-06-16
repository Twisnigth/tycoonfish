import { Rarity } from '../types';
import { defineFish } from './factory';

/** Biome eaux profondes — froid, sombre, créatures étranges. */
export const DEEPSEA_FISH = [
  defineFish({
    id: 'lanternfish', name: 'Poisson-Lanterne', rarity: Rarity.Rare, biome: 'deepsea',
    revenueFactor: 1.5, temp: [3, 9], modelRef: 'fish.basic', tint: 0x4dd0e1, scale: 0.8, school: true,
  }),
  defineFish({
    id: 'anglerfish', name: 'Baudroie Abyssale', rarity: Rarity.Epic, biome: 'deepsea',
    revenueFactor: 1.8, temp: [2, 7], minVolume: 20, modelRef: 'fish.exotic', tint: 0x37474f, scale: 1.3,
    predator: true,
  }),
  defineFish({
    id: 'giant_isopod', name: 'Bathynome Géant', rarity: Rarity.Epic, biome: 'deepsea',
    revenueFactor: 1.4, temp: [2, 6], modelRef: 'fish.round', tint: 0x8d6e63, scale: 1.1,
  }),
  defineFish({
    id: 'gulper_eel', name: 'Grandgousier', rarity: Rarity.Legendary, biome: 'deepsea',
    revenueFactor: 1.5, temp: [2, 6], minVolume: 25, modelRef: 'fish.eel', tint: 0x263238, scale: 1.8,
  }),
];
