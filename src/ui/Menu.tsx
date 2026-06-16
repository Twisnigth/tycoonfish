import { useState } from 'react';
import type { GameMode } from '../core/GameState';

interface MenuProps {
  canContinue: boolean;
  onContinue: () => void;
  onNewGame: (mode: GameMode) => void;
}

/**
 * Écran-titre / menu principal. Permet de reprendre la partie sauvegardée, ou de
 * lancer une nouvelle partie en choisissant le mode (Histoire ou Bac à sable).
 */
export function Menu({ canContinue, onContinue, onNewGame }: MenuProps) {
  const [screen, setScreen] = useState<'main' | 'mode'>('main');

  return (
    <div className="menu">
      <div className="menu-bg" />
      <div className="menu-card">
        <h1 className="menu-title">🐠 Aqua Tycoon</h1>
        <p className="menu-sub">Bâtissez le plus grand parc aquatique du monde</p>

        {screen === 'main' ? (
          <div className="menu-actions">
            {canContinue && (
              <button className="menu-btn primary" onClick={onContinue}>
                ▶ Continuer
              </button>
            )}
            <button className="menu-btn" onClick={() => setScreen('mode')}>
              ✦ Nouvelle Partie
            </button>
          </div>
        ) : (
          <div className="menu-modes">
            <button className="mode-card" onClick={() => onNewGame('story')}>
              <span className="mode-icon">📖</span>
              <span className="mode-name">Mode Histoire</span>
              <span className="mode-desc">
                Une campagne guidée : 12 quêtes vous mènent du premier bassin
                jusqu'aux espèces mythiques. Idéal pour apprendre.
              </span>
            </button>
            <button className="mode-card" onClick={() => onNewGame('sandbox')}>
              <span className="mode-icon">🏖️</span>
              <span className="mode-name">Bac à sable</span>
              <span className="mode-desc">
                Budget quasi illimité, tout débloqué dès le départ. Construisez
                librement le parc de vos rêves, sans contrainte.
              </span>
            </button>
            <button className="menu-btn ghost" onClick={() => setScreen('main')}>
              ← Retour
            </button>
          </div>
        )}

        <footer className="menu-foot">v0.5 · Park Builder</footer>
      </div>
    </div>
  );
}
