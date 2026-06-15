import { Decimal, D } from './numbers';
import type { GameState } from './GameState';
import { getUpgrade } from '../data/upgrades';
import { getResearch } from '../data/research';
import { getFish } from '../data/fish';
import { OFFLINE_CAP_HOURS, OFFLINE_EFFICIENCY } from '../data/balance';

/** Recherche passive de base, par espèce distincte élevée et par tick. */
const BASE_RESEARCH_PER_SPECIES = 0.2;

/**
 * Multiplicateur de revenu GLOBAL : additionne les bonus des améliorations
 * (× niveau) et les effets de recherche. Retourne un facteur >= 1.
 */
export function globalRevenueMultiplier(state: GameState): number {
  let mult = 1;
  for (const [id, level] of Object.entries(state.upgrades)) {
    const u = getUpgrade(id);
    if (u) mult += u.revenueMultPerLevel * level;
  }
  for (const id of state.unlockedResearch) {
    const r = getResearch(id);
    if (!r) continue;
    for (const e of r.effects) if (e.type === 'globalRevenueMult') mult += e.value;
  }
  return mult;
}

export function researchRateMultiplier(state: GameState): number {
  let mult = 1;
  for (const id of state.unlockedResearch) {
    const r = getResearch(id);
    if (!r) continue;
    for (const e of r.effects) if (e.type === 'researchRateMult') mult += e.value;
  }
  return mult;
}

/** Nombre d'espèces distinctes effectivement élevées (pilote la recherche). */
export function distinctSpeciesCount(state: GameState): number {
  const set = new Set<string>();
  for (const tank of state.tanks) {
    for (const [id, n] of Object.entries(tank.fish)) if (n > 0) set.add(id);
  }
  return set.size;
}

/**
 * Revenu par tick — AGRÉGÉ. On ne boucle jamais sur les poissons individuels :
 * on somme `base × count` par espèce, puis on applique le multiplicateur global.
 * Tient des millions de poissons sans coût.
 */
export function revenuePerTick(state: GameState): Decimal {
  let sum = D(0);
  for (const tank of state.tanks) {
    for (const [id, count] of Object.entries(tank.fish)) {
      if (count <= 0) continue;
      const sp = getFish(id);
      if (!sp) continue;
      sum = sum.add(D(sp.baseRevenuePerTick).mul(count));
    }
  }
  return sum.mul(globalRevenueMultiplier(state));
}

export function researchPerTick(state: GameState): Decimal {
  return D(BASE_RESEARCH_PER_SPECIES)
    .mul(distinctSpeciesCount(state))
    .mul(researchRateMultiplier(state));
}

/** Avance l'économie de `ticks` ticks (peut être fractionnaire). */
export function tick(state: GameState, ticks = 1): void {
  const rev = revenuePerTick(state).mul(ticks);
  state.money = state.money.add(rev);
  state.totalEarned = state.totalEarned.add(rev);
  state.research = state.research.add(researchPerTick(state).mul(ticks));
}

export interface OfflineReport {
  elapsedMs: number;
  earned: Decimal;
  research: Decimal;
}

/**
 * Applique la progression hors-ligne en une passe (forme close, pas de boucle).
 * Plafonnée et atténuée par les constantes d'équilibrage.
 */
export function applyOffline(state: GameState, now = Date.now()): OfflineReport {
  const elapsed = Math.max(0, now - state.lastSaved);
  const capped = Math.min(elapsed, OFFLINE_CAP_HOURS * 3600_000);
  const ticks = (capped / 1000) * OFFLINE_EFFICIENCY;

  const earned = revenuePerTick(state).mul(ticks);
  const research = researchPerTick(state).mul(ticks);

  state.money = state.money.add(earned);
  state.totalEarned = state.totalEarned.add(earned);
  state.research = state.research.add(research);

  return { elapsedMs: capped, earned, research };
}
