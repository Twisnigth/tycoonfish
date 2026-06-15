import { useGame, useGameVersion } from './GameContext';
import { RESEARCH, getResearch } from '../data/research';
import { formatNumber } from '../core/numbers';

const COL_W = 150;
const ROW_H = 110;
const PAD = 60;

/** Arbre de recherche : nœuds positionnés + connecteurs, achat en Points. */
export function ResearchPanel({ onClose }: { onClose: () => void }) {
  const game = useGame();
  useGameVersion();
  const state = game.state;

  const xs = RESEARCH.map((r) => r.position.x);
  const ys = RESEARCH.map((r) => r.position.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys);
  const width = (maxX - minX) * COL_W + PAD * 2;
  const height = maxY * ROW_H + PAD * 2;

  const pos = (x: number, y: number) => ({
    left: (x - minX) * COL_W + PAD,
    top: y * ROW_H + PAD,
  });

  const status = (id: string): 'owned' | 'available' | 'locked' => {
    if (state.unlockedResearch.includes(id)) return 'owned';
    const node = getResearch(id)!;
    const reqMet = node.requires.every((r) => state.unlockedResearch.includes(r));
    return reqMet ? 'available' : 'locked';
  };

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="research">
        <div className="research-head">
          <h2>Arbre de Recherche</h2>
          <span className="research-points">🔬 {formatNumber(state.research)}</span>
          <button className="btn-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="research-canvas" style={{ width, height }}>
          <svg className="research-edges" width={width} height={height}>
            {RESEARCH.flatMap((node) =>
              node.requires.map((reqId) => {
                const parent = getResearch(reqId);
                if (!parent) return null;
                const a = pos(parent.position.x, parent.position.y);
                const b = pos(node.position.x, node.position.y);
                const owned = state.unlockedResearch.includes(reqId);
                return (
                  <line
                    key={`${reqId}-${node.id}`}
                    x1={a.left + 60}
                    y1={a.top + 30}
                    x2={b.left + 60}
                    y2={b.top + 30}
                    className={owned ? 'edge owned' : 'edge'}
                  />
                );
              }),
            )}
          </svg>

          {RESEARCH.map((node) => {
            const st = status(node.id);
            const affordable = state.research.gte(node.cost);
            const p = pos(node.position.x, node.position.y);
            return (
              <div
                key={node.id}
                className={`research-node ${st}`}
                style={{ left: p.left, top: p.top }}
              >
                <strong>{node.name}</strong>
                <small>{node.description}</small>
                {st === 'available' && (
                  <button
                    className="btn btn-sm"
                    disabled={!affordable}
                    onClick={() => game.buyResearch(node.id)}
                  >
                    🔬 {formatNumber(node.cost)}
                  </button>
                )}
                {st === 'owned' && <span className="node-owned">✓ Acquis</span>}
                {st === 'locked' && <span className="node-locked">🔒 Verrouillé</span>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
