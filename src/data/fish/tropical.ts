import { Rarity } from '../types';
import { defineFish } from './factory';

/** Biome tropical — eaux chaudes, point de départ du joueur. */
export const TROPICAL_FISH = [
  defineFish({
    id: 'guppy', name: 'Guppy', rarity: Rarity.Common, biome: 'tropical',
    revenueFactor: 1, temp: [22, 28], modelRef: 'fish.basic', tint: 0xffa15c, scale: 0.8,
  }),
  defineFish({
    id: 'neon_tetra', name: 'Néon Bleu', rarity: Rarity.Common, biome: 'tropical',
    revenueFactor: 1.4, temp: [21, 27], modelRef: 'fish.basic', tint: 0x4fc3f7, scale: 0.7,
  }),
  defineFish({
    id: 'clownfish', name: 'Poisson-Clown', rarity: Rarity.Rare, biome: 'tropical',
    revenueFactor: 1, temp: [24, 28], modelRef: 'fish.round', tint: 0xff7043, scale: 0.9,
  }),
  defineFish({
    id: 'angelfish', name: 'Scalaire', rarity: Rarity.Rare, biome: 'tropical',
    revenueFactor: 1.6, temp: [24, 30], modelRef: 'fish.round', tint: 0xfff176, scale: 1.1,
  }),
  defineFish({
    id: 'mandarin', name: 'Poisson-Mandarin', rarity: Rarity.Epic, biome: 'tropical',
    revenueFactor: 1, temp: [24, 27], modelRef: 'fish.exotic', tint: 0x26a69a, scale: 1,
  }),
  defineFish({
    id: 'lionfish', name: 'Rascasse Volante', rarity: Rarity.Epic, biome: 'tropical',
    revenueFactor: 1.8, temp: [23, 28], modelRef: 'fish.exotic', tint: 0xb71c1c, scale: 1.2,
  }),
  defineFish({
    id: 'golden_arowana', name: 'Arowana Dorée', rarity: Rarity.Legendary, biome: 'tropical',
    revenueFactor: 1, temp: [26, 30], modelRef: 'fish.long', tint: 0xffd54f, scale: 1.6,
  }),
  // --- Espèces récifales (modèles 3D Higgsfield dédiés) ---
  defineFish({
    id: 'blue_tang', name: 'Chirurgien Bleu', rarity: Rarity.Rare, biome: 'tropical',
    revenueFactor: 1.3, temp: [24, 27], modelRef: 'fish.round', tint: 0x2563eb, scale: 1.0,
  }),
  defineFish({
    id: 'yellow_tang', name: 'Chirurgien Jaune', rarity: Rarity.Rare, biome: 'tropical',
    revenueFactor: 1.5, temp: [24, 27], modelRef: 'fish.round', tint: 0xfacc15, scale: 0.95,
  }),
  defineFish({
    id: 'emperor_angelfish', name: 'Poisson-Empereur', rarity: Rarity.Epic, biome: 'tropical',
    revenueFactor: 1.4, temp: [24, 28], modelRef: 'fish.exotic', tint: 0x1e88e5, scale: 1.15,
  }),
];
