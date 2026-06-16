import { useState } from 'react';
import { useUiStore } from '../store/uiStore';
import { useGame, useGameVersion } from './GameContext';
import { BUILDING_LIST, type BuildCategory } from '../data/buildings';
import { formatMoney } from '../core/numbers';

const CATS: [BuildCategory, string][] = [
  ['paths', 'Chemins'],
  ['tanks', 'Bacs'],
  ['infra', 'Infrastructures'],
  ['decor', 'Décor'],
];

/** Barre de construction en bas d'écran : outils + onglets + objets. */
export function BuildBar() {
  const game = useGame();
  useGameVersion();
  const tool = useUiStore((s) => s.tool);
  const setTool = useUiStore((s) => s.setTool);
  const [cat, setCat] = useState<BuildCategory>('paths');

  const items = BUILDING_LIST.filter((b) => b.category === cat && game.isUnlocked(b.type));

  return (
    <div className="buildbar">
      <div className="bb-tools">
        <button className={tool === null ? 'active' : ''} onClick={() => setTool(null)}>
          👆 Sélection
        </button>
        <button className={tool === 'remove' ? 'active' : ''} onClick={() => setTool('remove')}>
          🗑️ Démolir
        </button>
        <button className={tool === 'plot' ? 'active' : ''} onClick={() => setTool('plot')}>
          🗺️ Parcelle <small>{formatMoney(game.plotCost())}</small>
        </button>
      </div>

      <div className="bb-tabs">
        {CATS.map(([id, label]) => (
          <button key={id} className={cat === id ? 'active' : ''} onClick={() => setCat(id)}>
            {label}
          </button>
        ))}
      </div>

      <div className="bb-items">
        {items.map((b) => {
          const lockLevel = game.buildLockLevel(b.type);
          const locked = lockLevel > 0;
          const affordable = game.state.money.gte(b.cost);
          return (
            <button
              key={b.type}
              className={`bb-item ${tool === b.type ? 'active' : ''} ${locked ? 'locked' : ''}`}
              disabled={locked || !affordable}
              title={locked ? `Débloqué au niveau ${lockLevel}` : ''}
              onClick={() => setTool(b.type)}
            >
              <span>{b.name}</span>
              <small>
                {locked ? `🔒 Niv. ${lockLevel}` : `${formatMoney(b.cost)} · ${b.w}×${b.h}`}
              </small>
            </button>
          );
        })}
      </div>
    </div>
  );
}
