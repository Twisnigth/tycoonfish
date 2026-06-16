import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Game } from './core/Game';
import { GameLoop } from './core/GameLoop';
import { SceneManager } from './render/SceneManager';
import { createInitialState, type GameMode } from './core/GameState';
import { hasSave, loadGame, saveGame } from './systems/SaveSystem';
import { useUiStore } from './store/uiStore';
import { GameProvider } from './ui/GameContext';
import { App } from './ui/App';
import { Menu } from './ui/Menu';
import './ui/styles.css';

const AUTOSAVE_MS = 15_000;

interface Session {
  game: Game;
  loop: GameLoop;
  scene: SceneManager;
}

let persistenceWired = false;

/** Crée la session de jeu (Game + scène 3D + boucle) et branche la persistance. */
async function startSession(choice: GameMode | 'continue'): Promise<Session> {
  const canvas = document.getElementById('scene') as HTMLCanvasElement;

  const initial =
    choice === 'continue' ? (await loadGame()) ?? createInitialState('story') : createInitialState(choice);
  const game = new Game(initial);
  if (choice === 'continue') game.applyOffline(); // gains pendant l'absence

  const scene = new SceneManager(canvas, game);
  const loop = new GameLoop(game, (dt) => scene.render(dt), () => useUiStore.getState().speed);
  loop.start();

  // Sauvegarde immédiate (une nouvelle partie remplace l'ancienne dès le départ).
  void saveGame(game.state);

  if (!persistenceWired) {
    persistenceWired = true;
    window.setInterval(() => void saveGame(game.state), AUTOSAVE_MS);
    window.addEventListener('beforeunload', () => void saveGame(game.state));
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) void saveGame(game.state);
    });
  }

  Object.assign(window as unknown as Record<string, unknown>, { game, loop, scene });
  return { game, scene, loop };
}

/** Racine : affiche le menu principal, puis lance la session de jeu au choix. */
function Root() {
  const [session, setSession] = useState<Session | null>(null);
  const [canContinue, setCanContinue] = useState(false);

  useEffect(() => {
    void hasSave().then(setCanContinue);
  }, []);

  if (!session) {
    return (
      <Menu
        canContinue={canContinue}
        onContinue={() => void startSession('continue').then(setSession)}
        onNewGame={(mode) => void startSession(mode).then(setSession)}
      />
    );
  }

  return (
    <GameProvider game={session.game}>
      <App />
    </GameProvider>
  );
}

// Racine réutilisée entre les hot-updates Vite (sinon createRoot rejoue sur le
// même conteneur et avertit / casse le rendu).
const w = window as unknown as { __uiRoot?: ReturnType<typeof createRoot> };
const root = (w.__uiRoot ??= createRoot(document.getElementById('ui')!));
root.render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
