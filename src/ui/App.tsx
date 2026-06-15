import { useCallback, useRef, useState } from 'react';
import { useGame } from './GameContext';
import { HUD } from './HUD';
import { ShopPanel } from './ShopPanel';
import { ResearchPanel } from './ResearchPanel';
import { FishingMinigame } from './FishingMinigame';
import { FloatingTexts } from './FloatingTexts';
import type { FishSpecies, Rarity } from '../data/types';

/** Racine de l'overlay React. Le canvas 3D est DERRIÈRE (voir main.tsx). */
export function App() {
  const game = useGame();
  const [activeSpecies, setActiveSpecies] = useState<FishSpecies | null>(null);
  const [showResearch, setShowResearch] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef(0);

  const flash = useCallback((msg: string) => {
    setToast(msg);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2200);
  }, []);

  const startExpedition = useCallback(
    (rarity: Rarity) => {
      const species = game.beginExpedition(rarity);
      if (!species) {
        flash("Impossible : pas assez d'appâts ou aucune espèce capturable.");
        return;
      }
      setActiveSpecies(species);
    },
    [game, flash],
  );

  return (
    <div className="overlay">
      <HUD />

      <div className="side-controls">
        <button className="btn btn-icon" onClick={() => setShowResearch(true)}>
          🔬 Recherche
        </button>
      </div>

      <ShopPanel onStartExpedition={startExpedition} />

      <FloatingTexts />

      {activeSpecies && (
        <FishingMinigame species={activeSpecies} onClose={() => setActiveSpecies(null)} />
      )}
      {showResearch && <ResearchPanel onClose={() => setShowResearch(false)} />}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
