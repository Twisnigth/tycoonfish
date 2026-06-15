import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Game } from './core/Game';
import { GameLoop } from './core/GameLoop';
import { SceneManager } from './render/SceneManager';
import { applyOffline } from './core/EconomyEngine';
import { loadGame, saveGame } from './systems/SaveSystem';
import { GameProvider } from './ui/GameContext';
import { App } from './ui/App';
import './ui/styles.css';

const AUTOSAVE_MS = 15_000;

async function bootstrap(): Promise<void> {
  const canvas = document.getElementById('scene') as HTMLCanvasElement;
  const uiRoot = document.getElementById('ui')!;

  // 1) Charger la sauvegarde + appliquer la progression hors-ligne.
  const saved = await loadGame();
  const game = new Game(saved ?? undefined);
  if (saved) {
    applyOffline(game.state);
    game.store.bump();
  }

  // 2) Scène 3D (impérative) dans sa propre boucle rAF.
  const scene = new SceneManager(canvas, game);
  const loop = new GameLoop(game, (dt) => scene.render(dt));
  loop.start();

  // 3) Persistance : autosave + sauvegarde sur sortie/onglet caché.
  window.setInterval(() => void saveGame(game.state), AUTOSAVE_MS);
  window.addEventListener('beforeunload', () => void saveGame(game.state));
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) void saveGame(game.state);
  });

  // 4) Overlay React par-dessus le canvas.
  createRoot(uiRoot).render(
    <StrictMode>
      <GameProvider game={game}>
        <App />
      </GameProvider>
    </StrictMode>,
  );

  // Accès debug en console (game, boucle, scène).
  Object.assign(window as unknown as Record<string, unknown>, { game, loop, scene });
}

void bootstrap();
