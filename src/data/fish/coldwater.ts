import { Rarity } from '../types';
import { defineFish } from './factory';

/** Biome eaux froides — second biome débloqué par défaut. */
export const COLDWATER_FISH = [
  defineFish({
    id: 'goldfish', name: 'Poisson Rouge', rarity: Rarity.Common, biome: 'coldwater',
    revenueFactor: 1.2, temp: [10, 22], modelRef: 'fish.round', tint: 0xff8a65, scale: 0.9, school: true,
  }),
  defineFish({
    id: 'koi', name: 'Carpe Koï', rarity: Rarity.Rare, biome: 'coldwater',
    revenueFactor: 2, temp: [8, 24], modelRef: 'fish.long', tint: 0xfff8e1, scale: 1.4,
  }),
  defineFish({
    id: 'arctic_char', name: 'Omble Chevalier', rarity: Rarity.Epic, biome: 'coldwater',
    revenueFactor: 1.3, temp: [4, 16], modelRef: 'fish.long', tint: 0x90caf9, scale: 1.3,
  }),
  defineFish({
    id: 'frostfin', name: 'Givre-Nageoire', rarity: Rarity.Legendary, biome: 'coldwater',
    revenueFactor: 1.5, temp: [0, 10], modelRef: 'fish.exotic', tint: 0xb3e5fc, scale: 1.5,
  }),
  defineFish({
    id: 'leviathan_eel', name: 'Anguille Léviathan', rarity: Rarity.Mythic, biome: 'coldwater',
    revenueFactor: 1, temp: [2, 12], modelRef: 'fish.eel', tint: 0x7e57c2, scale: 2.2,
    difficulty: { sweepSpeed: 3.6 },
  }),
  defineFish({
    id: 'sturgeon', name: 'Esturgeon', rarity: Rarity.Epic, biome: 'coldwater',
    revenueFactor: 1.6, temp: [4, 18], minVolume: 25, modelRef: 'fish.long', tint: 0x78909c, scale: 1.7,
  }),
  defineFish({
    id: 'axolotl', name: 'Axolotl', rarity: Rarity.Rare, biome: 'coldwater',
    revenueFactor: 1.7, temp: [14, 20], modelRef: 'fish.round', tint: 0xf48fb1, scale: 0.9,
  }),
];
