import { Rarity } from '../types';
import { defineFish } from './factory';

/** Biome abyssal — froid extrême, espèces rares et bioluminescentes. */
export const ABYSSAL_FISH = [
  defineFish({
    id: 'vampire_squid', name: 'Calmar Vampire', rarity: Rarity.Epic, biome: 'abyssal',
    revenueFactor: 1.6, temp: [0, 4], minVolume: 20, modelRef: 'fish.exotic', tint: 0x7b1fa2, scale: 1.2,
  }),
  defineFish({
    id: 'dumbo_octopus', name: 'Pieuvre Dumbo', rarity: Rarity.Legendary, biome: 'abyssal',
    revenueFactor: 1.5, temp: [0, 4], minVolume: 22, modelRef: 'fish.round', tint: 0xce93d8, scale: 1.3,
  }),
  defineFish({
    id: 'abyssal_serpent', name: 'Serpent des Abysses', rarity: Rarity.Legendary, biome: 'abyssal',
    revenueFactor: 1.8, temp: [0, 3], minVolume: 30, modelRef: 'fish.eel', tint: 0x1a237e, scale: 2.0,
    predator: true,
  }),
  defineFish({
    id: 'ghost_shark', name: 'Chimère Fantôme', rarity: Rarity.Mythic, biome: 'abyssal',
    revenueFactor: 1.2, temp: [0, 4], minVolume: 40, modelRef: 'fish.long', tint: 0xb0bec5, scale: 2.3,
    predator: true,
  }),
];
