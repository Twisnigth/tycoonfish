import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Game } from './core/Game';
import { GameLoop } from './core/GameLoop';
import { SceneManager } from './render/SceneManager';
import { loadGame, saveGame } from './systems/SaveSystem';
import { GameProvider } from './ui/GameContext';
import { App } from './ui/App';
import './ui/styles.css';

const AUTOSAVE_MS = 15_000;

async function bootstrap(): Promise<void> {
  const canvas = document.getElementById('scene') as HTMLCanvasElement;
  const uiRoot = document.getElementById('ui')!;

  // 1) Charger la sauvegarde (schéma v2) ou démarrer une partie vide.
  const saved = await loadGame();
  const game = new Game(saved ?? undefined);

  // 2) Scène 3D (impérative) + boucle.
  const scene = new SceneManager(canvas, game);
  const loop = new GameLoop(game, (dt) => scene.render(dt));
  loop.start();

  // 3) Persistance.
  window.setInterval(() => void saveGame(game.state), AUTOSAVE_MS);
  window.addEventListener('beforeunload', () => void saveGame(game.state));
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) void saveGame(game.state);
  });

  // 4) Overlay React.
  createRoot(uiRoot).render(
    <StrictMode>
      <GameProvider game={game}>
        <App />
      </GameProvider>
    </StrictMode>,
  );

  Object.assign(window as unknown as Record<string, unknown>, { game, loop, scene });
}

void bootstrap();
