import { Rarity } from '../types';
import { defineFish } from './factory';

/** Biome mythique — créatures légendaires, le sommet de la collection. */
export const MYTHIC_FISH = [
  defineFish({
    id: 'bioluminescent_jelly', name: 'Méduse Bioluminescente', rarity: Rarity.Epic, biome: 'mythic',
    revenueFactor: 1.6, temp: [12, 18], modelRef: 'fish.round', tint: 0x18ffff, scale: 1.0, school: true,
  }),
  defineFish({
    id: 'sea_serpent', name: 'Serpent de Mer', rarity: Rarity.Mythic, biome: 'mythic',
    revenueFactor: 1.3, temp: [12, 18], minVolume: 45, modelRef: 'fish.eel', tint: 0x00bfa5, scale: 2.6,
    predator: true,
  }),
  defineFish({
    id: 'kraken', name: 'Kraken', rarity: Rarity.Mythic, biome: 'mythic',
    revenueFactor: 1.6, temp: [10, 18], minVolume: 60, modelRef: 'fish.exotic', tint: 0x4a148c, scale: 3.0,
    predator: true,
  }),
  defineFish({
    id: 'leviathan', name: 'Léviathan', rarity: Rarity.Mythic, biome: 'mythic',
    revenueFactor: 2, temp: [10, 16], minVolume: 70, modelRef: 'fish.long', tint: 0x311b92, scale: 3.2,
    predator: true,
  }),
];
