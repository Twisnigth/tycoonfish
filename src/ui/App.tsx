import { useCallback, useRef, useState } from 'react';
import { useGame } from './GameContext';
import { HUD } from './HUD';
import { BuildBar } from './BuildBar';
import { Tablet } from './Tablet';
import { FishingMinigame } from './FishingMinigame';
import { FloatingTexts } from './FloatingTexts';
import { SpeedControls } from './SpeedControls';
import { NotificationLayer } from './NotificationLayer';
import { ObjectivesPanel } from './ObjectivesPanel';
import { QuestPanel } from './QuestPanel';
import { useUiStore } from '../store/uiStore';
import type { FishSpecies, Rarity } from '../data/types';

/** Formate une durée (ms) en « Xh Ymin » / « Ymin ». */
function formatDuration(ms: number): string {
  const min = Math.round(ms / 60000);
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h} h ${m} min` : `${m} min`;
}

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
        flash('Expédition indisponible.');
        return;
      }
      setActiveSpecies(species);
    },
    [game, flash],
  );

  const story = game.state.mode === 'story';
  const [offline, setOffline] = useState(() => game.offlineReport);
  const pendingDemolish = useUiStore((s) => s.pendingDemolish);
  const requestDemolish = useUiStore((s) => s.requestDemolish);
  const rotateCam = (dir: -1 | 1) => (window as unknown as { scene?: { rotateCamera(d: -1 | 1): void } }).scene?.rotateCamera(dir);

  return (
    <div className="overlay">
      <HUD />
      <SpeedControls />
      <div className="cam-controls">
        <button title="Pivoter à gauche (←)" onClick={() => rotateCam(-1)}>⟲</button>
        <button title="Pivoter à droite (→)" onClick={() => rotateCam(1)}>⟳</button>
      </div>
      {story ? <QuestPanel /> : <ObjectivesPanel />}
      <Tablet onStartExpedition={startExpedition} />
      {pendingDemolish && (
        <div className="modal-backdrop" onClick={() => requestDemolish(null)}>
          <div className="offline-modal" onClick={(e) => e.stopPropagation()}>
            <h2>🗑️ Démolir ?</h2>
            <p>Supprimer « {pendingDemolish.name} » ? Cette action est définitive.</p>
            <div className="confirm-row">
              <button className="btn" onClick={() => requestDemolish(null)}>Annuler</button>
              <button
                className="btn btn-danger"
                onClick={() => {
                  game.removeBuildingAt(pendingDemolish.gx, pendingDemolish.gy);
                  requestDemolish(null);
                }}
              >
                Démolir
              </button>
            </div>
          </div>
        </div>
      )}
      {offline && offline.gain > 0 && (
        <div className="modal-backdrop" onClick={() => setOffline(null)}>
          <div className="offline-modal" onClick={(e) => e.stopPropagation()}>
            <h2>👋 Bon retour !</h2>
            <p>Pendant votre absence ({formatDuration(offline.ms)}), votre parc a continué de tourner.</p>
            <div className="offline-gain">+{offline.gain.toLocaleString('fr-FR')} $</div>
            <button className="btn" onClick={() => setOffline(null)}>Continuer</button>
          </div>
        </div>
      )}
      <BuildBar />
      <FloatingTexts />
      <NotificationLayer />
      {activeSpecies && (
        <FishingMinigame species={activeSpecies} onClose={() => setActiveSpecies(null)} />
      )}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
