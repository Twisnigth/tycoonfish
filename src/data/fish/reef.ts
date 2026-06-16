import { Rarity } from '../types';
import { defineFish } from './factory';

/** Biome récif corallien — eaux chaudes et colorées, poissons grégaires. */
export const REEF_FISH = [
  defineFish({
    id: 'royal_gramma', name: 'Gramma Royal', rarity: Rarity.Rare, biome: 'reef',
    revenueFactor: 1.4, temp: [24, 28], modelRef: 'fish.round', tint: 0xb14ad6, scale: 0.8, school: true,
  }),
  defineFish({
    id: 'copperband', name: 'Chelmon à Bandes', rarity: Rarity.Rare, biome: 'reef',
    revenueFactor: 1.6, temp: [24, 28], modelRef: 'fish.exotic', tint: 0xf0b429, scale: 1.0,
  }),
  defineFish({
    id: 'powder_blue_tang', name: 'Chirurgien Poudré', rarity: Rarity.Epic, biome: 'reef',
    revenueFactor: 1.3, temp: [24, 27], modelRef: 'fish.round', tint: 0x3aa0ff, scale: 1.1, school: true,
  }),
  defineFish({
    id: 'flame_angelfish', name: 'Ange de Feu', rarity: Rarity.Epic, biome: 'reef',
    revenueFactor: 1.7, temp: [24, 28], modelRef: 'fish.exotic', tint: 0xff5722, scale: 1.0,
  }),
  defineFish({
    id: 'mandarin_dragonet', name: 'Dragonnet Mandarin', rarity: Rarity.Legendary, biome: 'reef',
    revenueFactor: 1.4, temp: [25, 27], modelRef: 'fish.exotic', tint: 0x1de9b6, scale: 0.95,
  }),
];
