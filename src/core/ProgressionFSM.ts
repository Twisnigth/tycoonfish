import type { GameState } from './GameState';
import { PROGRESSION_TIERS, type ProgressionTier } from '../data/balance';
import { D } from './numbers';

/**
 * Machine d'états de l'évolution du complexe. À chaque vérification, fait
 * avancer le palier tant que le cumul d'argent gagné dépasse le seuil suivant.
 * Retourne les paliers franchis pour déclencher les animations 3D (scale bounce).
 */
export function checkProgression(state: GameState): ProgressionTier[] {
  const crossed: ProgressionTier[] = [];
  let next = PROGRESSION_TIERS[state.progressionTier + 1];
  while (next && state.totalEarned.gte(D(next.threshold))) {
    state.progressionTier = next.id;
    crossed.push(next);
    next = PROGRESSION_TIERS[state.progressionTier + 1];
  }
  return crossed;
}

export function currentTier(state: GameState): ProgressionTier {
  return PROGRESSION_TIERS[state.progressionTier];
}

export function nextTier(state: GameState): ProgressionTier | undefined {
  return PROGRESSION_TIERS[state.progressionTier + 1];
}

/** Avancement 0..1 vers le palier suivant (pour la barre de progression UI). */
export function progressToNextTier(state: GameState): number {
  const cur = currentTier(state);
  const nxt = nextTier(state);
  if (!nxt) return 1;
  const lo = D(cur.threshold);
  const hi = D(nxt.threshold);
  const span = hi.sub(lo);
  if (span.lte(0)) return 1;
  const p = state.totalEarned.sub(lo).div(span).toNumber();
  return Math.max(0, Math.min(1, p));
}
