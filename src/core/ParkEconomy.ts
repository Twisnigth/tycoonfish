import { Decimal, D } from './numbers';
import type { GameState, PlacedBuilding, TankState } from './GameState';
import { BUILDINGS } from '../data/buildings';
import { getFish } from '../data/fish';
import { Rarity } from '../data/types';

/** Durée d'une « journée » (cycle d'entretien), en ms. */
export const DAY_MS = 120_000;

/** Attrait apporté par un poisson selon sa rareté (contrainte GD #1). */
const RARITY_APPEAL: Record<Rarity, number> = {
  [Rarity.Common]: 2,
  [Rarity.Rare]: 6,
  [Rarity.Epic]: 16,
  [Rarity.Legendary]: 40,
  [Rarity.Mythic]: 100,
};

export function speciesAppeal(id: string): number {
  const sp = getFish(id);
  return sp ? RARITY_APPEAL[sp.rarity] : 0;
}

/** Attrait DYNAMIQUE d'un bac = somme de l'attrait de ses poissons. */
export function tankAppeal(tank: TankState): number {
  let a = 0;
  for (const [id, n] of Object.entries(tank.fish)) a += speciesAppeal(id) * n;
  return a;
}

export function buildingAppeal(b: PlacedBuilding): number {
  return b.tank ? tankAppeal(b.tank) : BUILDINGS[b.type].appeal;
}

export function computeAppeal(state: GameState): number {
  let a = 0;
  for (const b of state.buildings) a += buildingAppeal(b);
  return a;
}

/** Visiteurs générés par seconde, fonction de l'attrait et du prix du billet. */
export function spawnRatePerSec(state: GameState): number {
  const priceFactor = 1 / (1 + state.park.ticketPrice / 15);
  return Math.max(0, state.park.appeal) * 0.03 * priceFactor;
}

export function dailyMaintenance(state: GameState): Decimal {
  let m = 0;
  for (const b of state.buildings) m += BUILDINGS[b.type].maintenance;
  return D(m);
}

export function addIncome(state: GameState, amount: Decimal): void {
  state.money = state.money.add(amount);
  state.park.incomeToday = state.park.incomeToday.add(amount);
}

/** Avance le cycle de jour ; déduit l'entretien au passage d'une journée. */
export function economyTick(state: GameState, dt: number): { newDay: boolean; maintenance: Decimal } {
  state.park.appeal = computeAppeal(state);
  state.park.dayTimeMs += dt * 1000;
  if (state.park.dayTimeMs < DAY_MS) return { newDay: false, maintenance: D(0) };

  state.park.dayTimeMs -= DAY_MS;
  state.park.day += 1;
  const m = dailyMaintenance(state);
  state.money = state.money.sub(m);
  // Nouvelle journée : on remet le registre à zéro (l'entretien compte pour le jour qui commence).
  state.park.incomeToday = D(0);
  state.park.expensesToday = m;
  return { newDay: true, maintenance: m };
}
