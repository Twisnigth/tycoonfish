import { useGame, useGameVersion } from './GameContext';
import { useUiStore } from '../store/uiStore';
import { getFish } from '../data/fish';
import { BUILDINGS } from '../data/buildings';
import type { Fish } from '../core/Fish';

const fishName = (id: string): string => getFish(id)?.name ?? id;

function groupBySpecies(list: Fish[]): [string, number][] {
  const m = new Map<string, number>();
  for (const f of list) m.set(f.species, (m.get(f.species) ?? 0) + 1);
  return [...m.entries()];
}

/** Détails d'un objet sélectionné : bac (population + affectation) ou boutique (prix). */
export function BuildingInspector() {
  const game = useGame();
  useGameVersion();
  const id = useUiStore((s) => s.selectedBuildingId);
  const select = useUiStore((s) => s.select);
  if (!id) return null;

  const b = game.state.buildings.find((x) => x.id === id);
  if (!b) return null;

  // --- Boutique (snacks / souvenirs) ---
  if (b.tank === undefined && b.salePrice !== undefined) {
    const price = b.salePrice;
    return (
      <div className="inspector">
        <header>
          <strong>{BUILDINGS[b.type].name}</strong>
          <button className="btn-close" onClick={() => select(null)}>✕</button>
        </header>
        <h4>Prix de vente</h4>
        <div className="ticket-ctrl">
          <button onClick={() => game.setSalePrice(id, price - 1)}>−</button>
          <strong>{price}$</strong>
          <button onClick={() => game.setSalePrice(id, price + 1)}>+</button>
        </div>
        <p className="muted">Prix élevé = plus de revenu par vente, mais des visiteurs plus exigeants.</p>
      </div>
    );
  }

  if (!b.tank) return null;

  // --- Bac ---
  const tankFish = groupBySpecies(b.tank.fish);
  const inv = groupBySpecies(game.state.caughtInventory);

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

      <h4>Dans le bac ({b.tank.waterTemp}°C · vol. {b.tank.volume} · {b.tank.fish.length} poisson(s))</h4>
      {tankFish.length === 0 ? (
        <p className="muted">Bac vide.</p>
      ) : (
        <ul className="insp-list">
          {tankFish.map(([sid, n]) => (
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
