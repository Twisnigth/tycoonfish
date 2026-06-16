import { Rarity } from '../types';
import { defineFish } from './factory';

/** Biome tropical — eaux chaudes, point de départ du joueur. */
export const TROPICAL_FISH = [
  defineFish({
    id: 'guppy', name: 'Guppy', rarity: Rarity.Common, biome: 'tropical',
    revenueFactor: 1, temp: [22, 28], modelRef: 'fish.basic', tint: 0xffa15c, scale: 0.8, school: true,
  }),
  defineFish({
    id: 'neon_tetra', name: 'Néon Bleu', rarity: Rarity.Common, biome: 'tropical',
    revenueFactor: 1.4, temp: [21, 27], modelRef: 'fish.basic', tint: 0x4fc3f7, scale: 0.7, school: true,
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
    revenueFactor: 1.3, temp: [24, 27], modelRef: 'fish.round', tint: 0x2563eb, scale: 1.0, school: true,
  }),
  defineFish({
    id: 'yellow_tang', name: 'Chirurgien Jaune', rarity: Rarity.Rare, biome: 'tropical',
    revenueFactor: 1.5, temp: [24, 27], modelRef: 'fish.round', tint: 0xfacc15, scale: 0.95, school: true,
  }),
  defineFish({
    id: 'emperor_angelfish', name: 'Poisson-Empereur', rarity: Rarity.Epic, biome: 'tropical',
    revenueFactor: 1.4, temp: [24, 28], modelRef: 'fish.exotic', tint: 0x1e88e5, scale: 1.15,
  }),
  // --- Grandes créatures (modèles 3D dédiés) — exigent un grand bac ---
  defineFish({
    id: 'manta_ray', name: 'Raie Manta', rarity: Rarity.Epic, biome: 'tropical',
    revenueFactor: 1.2, temp: [22, 28], minVolume: 30, modelRef: 'fish.ray', tint: 0x4a5568, scale: 2.0,
  }),
  defineFish({
    id: 'dolphin', name: 'Dauphin', rarity: Rarity.Legendary, biome: 'tropical',
    revenueFactor: 1.3, temp: [20, 28], minVolume: 35, modelRef: 'fish.long', tint: 0x90a4ae, scale: 1.8,
  }),
  defineFish({
    id: 'shark', name: 'Requin', rarity: Rarity.Legendary, biome: 'tropical',
    revenueFactor: 1.6, temp: [20, 28], minVolume: 40, modelRef: 'fish.long', tint: 0x607d8b, scale: 2.4,
    predator: true,
  }),
  defineFish({
    id: 'cardinalfish', name: 'Apogon Cardinal', rarity: Rarity.Common, biome: 'tropical',
    revenueFactor: 1.2, temp: [23, 28], modelRef: 'fish.basic', tint: 0xe53935, scale: 0.75, school: true,
  }),
  defineFish({
    id: 'discus', name: 'Discus', rarity: Rarity.Epic, biome: 'tropical',
    revenueFactor: 1.5, temp: [26, 30], modelRef: 'fish.round', tint: 0xff7043, scale: 1.2, school: true,
  }),
];
