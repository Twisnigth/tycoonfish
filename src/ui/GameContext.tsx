import { createContext, useContext, type ReactNode } from 'react';
import type { Game } from '../core/Game';
import { useGameStore } from '../store/gameStore';

/**
 * Le contexte fournit le contrôleur `Game` (pour les ACTIONS). Les LECTURES
 * réactives passent par le store Zustand via `useGameSelector` : le sélecteur
 * est ré-évalué à chaque notification (`bumpStore`), et React ne re-render que
 * si la valeur retournée change (comparaison Object.is). Les sélecteurs doivent
 * donc retourner des primitives (string/number/bool).
 */
const GameCtx = createContext<Game | null>(null);

export function GameProvider({ game, children }: { game: Game; children: ReactNode }) {
  return <GameCtx.Provider value={game}>{children}</GameCtx.Provider>;
}

export function useGame(): Game {
  const g = useContext(GameCtx);
  if (!g) throw new Error('useGame doit être utilisé dans <GameProvider>');
  return g;
}

/** Lecture réactive dérivée du contrôleur `Game`, re-render uniquement au changement. */
export function useGameSelector<R>(selector: (g: Game) => R): R {
  const game = useGame();
  return useGameStore(() => selector(game));
}

/** S'abonne à tout changement d'état (version du store). Pour les panneaux riches. */
export function useGameVersion(): number {
  return useGameStore((s) => s._v);
}
