import type { BuildingType } from './buildings';

/**
 * Produits vendus par les boutiques (M-Vague2). Un stand snack vend de la
 * nourriture (hot-dog, chips, soda…), une boutique souvenirs de la marchandise.
 * Le joueur choisit ce qui est proposé ; les visiteurs achètent un produit
 * activé au hasard → recette = prix du produit.
 */
export interface Product {
  id: string;
  name: string;
  icon: string;
  price: number;
}

export const PRODUCTS: Record<string, Product> = {
  hot_dog: { id: 'hot_dog', name: 'Hot-dog', icon: '🌭', price: 14 },
  chips: { id: 'chips', name: 'Chips', icon: '🍟', price: 8 },
  soda: { id: 'soda', name: 'Soda', icon: '🥤', price: 6 },
  popcorn: { id: 'popcorn', name: 'Popcorn', icon: '🍿', price: 9 },
  ice_cream: { id: 'ice_cream', name: 'Glace', icon: '🍦', price: 11 },
  plush: { id: 'plush', name: 'Peluche', icon: '🧸', price: 32 },
  tshirt: { id: 'tshirt', name: 'T-shirt', icon: '👕', price: 28 },
  cap: { id: 'cap', name: 'Casquette', icon: '🧢', price: 22 },
  mug: { id: 'mug', name: 'Mug', icon: '☕', price: 16 },
};

const FOOD_PRODUCTS = ['hot_dog', 'chips', 'soda', 'popcorn', 'ice_cream'];
const MERCH_PRODUCTS = ['plush', 'tshirt', 'cap', 'mug'];

/** Catalogue proposable selon le type de boutique. */
export function catalogFor(type: BuildingType): string[] {
  return type === 'giftshop' ? MERCH_PRODUCTS : FOOD_PRODUCTS;
}

/** Produits activés par défaut à la construction. */
export function defaultProducts(type: BuildingType): string[] {
  return type === 'giftshop' ? ['plush', 'tshirt'] : ['hot_dog', 'soda'];
}
