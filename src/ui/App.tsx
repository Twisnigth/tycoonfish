import { useCallback, useRef, useState } from 'react';
import { useGame } from './GameContext';
import { HUD } from './HUD';
import { BuildBar } from './BuildBar';
import { ParkManagementPanel } from './ParkManagementPanel';
import { BuildingInspector } from './BuildingInspector';
import { FishingMinigame } from './FishingMinigame';
import { FloatingTexts } from './FloatingTexts';
import type { FishSpecies, Rarity } from '../data/types';

/** Racine de l'overlay React (par-dessus le canvas 3D du parc). */
export function App() {
  const game = useGame();
  const [activeSpecies, setActiveSpecies] = useState<FishSpecies | null>(null);
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
        flash("Pas assez d'appâts ou aucune espèce disponible.");
        return;
      }
      setActiveSpecies(species);
    },
    [game, flash],
  );

  return (
    <div className="overlay">
      <HUD />
      <ParkManagementPanel onStartExpedition={startExpedition} />
      <BuildingInspector />
      <BuildBar />
      <FloatingTexts />
      {activeSpecies && (
        <FishingMinigame species={activeSpecies} onClose={() => setActiveSpecies(null)} />
      )}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
