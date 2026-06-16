import { useGame, useGameVersion } from './GameContext';
import { useUiStore } from '../store/uiStore';
import { getFish } from '../data/fish';

const fishName = (id: string): string => getFish(id)?.name ?? id;

/** Détails d'un bac sélectionné : sa population + affectation des poissons pêchés. */
export function BuildingInspector() {
  const game = useGame();
  useGameVersion();
  const id = useUiStore((s) => s.selectedBuildingId);
  const select = useUiStore((s) => s.select);
  if (!id) return null;

  const b = game.state.buildings.find((x) => x.id === id);
  if (!b || !b.tank) return null;

  const fish = Object.entries(b.tank.fish).filter(([, n]) => n > 0);
  const inv = Object.entries(game.state.caughtInventory).filter(([, n]) => n > 0);

  // Compatibilité d'une espèce avec ce bac.
  const compatible = (sid: string): boolean => {
    const sp = getFish(sid);
    if (!sp || !b.tank) return false;
    const r = sp.requirements;
    return (
      b.tank.biome === r.biome &&
      b.tank.waterTemp >= r.minTemp &&
      b.tank.waterTemp <= r.maxTemp &&
      b.tank.volume >= r.minVolume
    );
  };

  return (
    <div className="inspector">
      <header>
        <strong>{b.tank.name} — {b.tank.biome}</strong>
        <button className="btn-close" onClick={() => select(null)}>✕</button>
      </header>

      <h4>Dans le bac ({b.tank.waterTemp}°C · vol. {b.tank.volume})</h4>
      {fish.length === 0 ? (
        <p className="muted">Bac vide.</p>
      ) : (
        <ul className="insp-list">
          {fish.map(([sid, n]) => (
            <li key={sid}>{fishName(sid)} ×{n}</li>
          ))}
        </ul>
      )}

      <h4>Inventaire de pêche</h4>
      {inv.length === 0 ? (
        <p className="muted">Aucun poisson pêché. Lance une expédition !</p>
      ) : (
        <ul className="insp-list">
          {inv.map(([sid, n]) => {
            const ok = compatible(sid);
            return (
              <li key={sid} className="insp-assign">
                <span>{fishName(sid)} ×{n}</span>
                <button
                  className="btn btn-sm"
                  disabled={!ok}
                  title={ok ? 'Placer dans ce bac' : 'Incompatible (biome/température)'}
                  onClick={() => game.assignFish(id, sid)}
                >
                  Placer →
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
