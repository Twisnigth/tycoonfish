import { Decimal, D } from './numbers';
import type { GameState, PlacedBuilding, TankState } from './GameState';
import { BUILDINGS } from '../data/buildings';
import { getFish } from '../data/fish';
import { Rarity } from '../data/types';
import { STAFF_SALARY } from './Ecosystem';
import { computeWelfare } from './Welfare';
import { equipmentEffects, equipmentMaintenance } from '../data/equipment';

/** Durée d'une « journée » (cycle d'entretien), en ms. Journées longues = gestion confortable. */
export const DAY_MS = 300_000;

const SPAWN_K = 0.12; // visiteurs/s par unité de « popularité »
const CAP_C = 4; // capacité ≈ C · ln(1 + attrait)
/** Vitesse de montée/descente de la popularité (rampe douce à l'ouverture). */
export const POPULARITY_RAMP = 0.05;

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

/**
 * Attrait DYNAMIQUE d'un bac = Σ (attrait espèce × gène taille × santé) modulé
 * par le BIEN-ÊTRE de l'habitat (un exhibit négligé attire bien moins).
 */
export function tankAppeal(tank: TankState, labBonus = 0): number {
  let a = 0;
  for (const f of tank.fish) a += speciesAppeal(f.species) * f.genes.size * f.vitals.health;
  const welfare = computeWelfare(tank, labBonus).score;
  const appealMult = equipmentEffects(tank.equipment).appealMult;
  return a * (0.4 + 0.6 * welfare) * appealMult;
}

export function buildingAppeal(b: PlacedBuilding, labBonus = 0): number {
  return b.tank ? tankAppeal(b.tank, labBonus) : BUILDINGS[b.type].appeal;
}

export function computeAppeal(state: GameState): number {
  const lab = state.buildings.some((b) => b.type === 'research') ? 1 : 0;
  let a = 0;
  for (const b of state.buildings) a += buildingAppeal(b, lab);
  return a;
}

/** Attractivité cible : LOGARITHMIQUE en attrait, pénalisée par le prix du billet. */
export function targetDraw(state: GameState): number {
  const priceFactor = 1 / (1 + state.park.ticketPrice / 15);
  return Math.log1p(Math.max(0, state.park.appeal)) * priceFactor;
}

/** Capacité max de visiteurs simultanés (empêche la surpopulation instantanée). */
export function maxConcurrent(state: GameState): number {
  return Math.ceil(CAP_C * Math.log1p(Math.max(0, state.park.appeal)));
}

/** Visiteurs/s — basé sur la popularité, qui monte progressivement vers `targetDraw`. */
export function spawnRatePerSec(state: GameState): number {
  return SPAWN_K * state.park.popularity;
}

/** Ventilation des dépenses quotidiennes par poste. */
export function expenseBreakdown(state: GameState): { buildings: number; equipment: number; salaries: number } {
  let buildings = 0;
  let equipment = 0;
  for (const b of state.buildings) {
    buildings += BUILDINGS[b.type].maintenance;
    if (b.tank) equipment += equipmentMaintenance(b.tank.equipment);
  }
  let salaries = 0;
  for (const e of state.staff.employees) salaries += STAFF_SALARY[e.role] ?? 0;
  return { buildings, equipment, salaries };
}

export function dailyMaintenance(state: GameState): Decimal {
  const e = expenseBreakdown(state);
  return D(e.buildings + e.equipment + e.salaries);
}

export type IncomeSource = 'tickets' | 'donations' | 'shops';

export function addIncome(state: GameState, amount: Decimal, source?: IncomeSource): void {
  state.money = state.money.add(amount);
  state.park.incomeToday = state.park.incomeToday.add(amount);
  if (source) state.park.income[source] += amount.toNumber();
}

/** Estimation du résultat net par seconde (pour la progression hors-ligne). */
export function estimateNetPerSec(state: GameState): number {
  const maintPerSec = dailyMaintenance(state).toNumber() / (DAY_MS / 1000);
  if (!state.park.isOpen) return -maintPerSec;
  const visitorsPerSec = SPAWN_K * targetDraw(state);
  const avgSpend = state.park.ticketPrice + 5; // billet + dons/achats moyens
  return visitorsPerSec * avgSpend - maintPerSec;
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
  state.park.income = { tickets: 0, donations: 0, shops: 0 };
  return { newDay: true, maintenance: m };
}
