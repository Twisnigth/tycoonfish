import { create } from 'zustand';
import { createInitialState, type GameState } from '../core/GameState';

/**
 * Store Zustand = SOURCE DE VÉRITÉ de l'état macro/UI (argent, parc, bâtiments…).
 * ⚠️ La simulation haute fréquence (grille, agents, pathfinding) ne passe PAS
 * par ici : elle vit dans `world/` + les systèmes, et la boucle de jeu ne pousse
 * que des résumés (par batch ~3 Hz). React lit UNIQUEMENT via ce store.
 *
 * Convention : le contrôleur `Game` mute l'état en place (perf + Decimal), puis
 * appelle `bumpStore()` pour notifier React — `_v` change d'identité à chaque
 * notification (équivalent du `bump()` de l'ancien store custom).
 */
export interface GameStore extends GameState {
  _v: number;
}

export const useGameStore = create<GameStore>(() => ({
  ...createInitialState(),
  _v: 0,
}));

/** Notifie React après une mutation en place de l'état. */
export const bumpStore = (): void => {
  useGameStore.setState((s) => ({ _v: s._v + 1 }));
};

/** Remplace entièrement l'état (chargement d'une sauvegarde). */
export const replaceState = (next: GameState): void => {
  useGameStore.setState((s) => ({ ...next, _v: s._v + 1 }), true);
};
