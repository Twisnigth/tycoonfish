import {
  createContext,
  useContext,
  useRef,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import type { Game } from '../core/Game';

const GameCtx = createContext<Game | null>(null);

export function GameProvider({ game, children }: { game: Game; children: ReactNode }) {
  return <GameCtx.Provider value={game}>{children}</GameCtx.Provider>;
}

export function useGame(): Game {
  const g = useContext(GameCtx);
  if (!g) throw new Error('useGame doit être utilisé dans <GameProvider>');
  return g;
}

/**
 * Pont Store → React via l'API dédiée `useSyncExternalStore`. Le sélecteur DOIT
 * renvoyer une valeur primitive (string/number/bool) : on met en cache la
 * dernière valeur et on ne re-render que si elle change réellement. Ainsi le
 * tick à 1 Hz ne provoque un rendu React que lorsque l'affichage change
 * vraiment — et jamais à la fréquence du rendu 3D.
 */
export function useGameSelector<R>(
  selector: (g: Game) => R,
  isEqual: (a: R, b: R) => boolean = Object.is,
): R {
  const game = useGame();
  const lastRef = useRef<{ value: R } | null>(null);

  const getSnapshot = (): R => {
    const next = selector(game);
    const last = lastRef.current;
    if (last && isEqual(last.value, next)) return last.value;
    lastRef.current = { value: next };
    return next;
  };

  return useSyncExternalStore(game.store.subscribe, getSnapshot, getSnapshot);
}

/**
 * S'abonne à TOUT changement d'état (retourne la version du store). Pratique
 * pour les panneaux riches (boutique, recherche) qui dérivent de nombreuses
 * valeurs : on relit `game.state` directement après ce hook. À réserver aux
 * vues peu fréquentes — le HUD, lui, utilise des sélecteurs granulaires.
 */
export function useGameVersion(): number {
  return useGameSelector((g) => g.store.version);
}
