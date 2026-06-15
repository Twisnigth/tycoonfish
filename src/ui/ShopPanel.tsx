import { useGame, useGameVersion } from './GameContext';
import { formatMoney } from '../core/numbers';
import { UPGRADES } from '../data/upgrades';
import {
  BAIT_COST,
  BAIT_PRICE,
} from '../data/balance';
import { RARITY_LABEL, RARITY_ORDER, RARITY_COLOR, type Rarity } from '../data/types';
import { D } from '../core/numbers';

/** Boutique : améliorations, appâts, expéditions de pêche, agrandissements. */
export function ShopPanel({ onStartExpedition }: { onStartExpedition: (r: Rarity) => void }) {
  const game = useGame();
  useGameVersion(); // re-render sur tout changement (affordabilité, niveaux…)
  const state = game.state;

  return (
    <section className="panel shop">
      <h2 className="panel-title">Boutique</h2>

      {/* --- Expéditions de pêche --- */}
      <div className="shop-group">
        <h3>Expéditions de pêche</h3>
        <p className="shop-hint">Dépense des appâts pour lancer un mini-jeu de capture.</p>
        <div className="exp-grid">
          {RARITY_ORDER.map((r) => {
            const cost = BAIT_COST[r];
            const catchable = game.catchableSpecies(r).length > 0;
            const affordable = state.bait >= cost;
            const disabled = !catchable || !affordable;
            return (
              <button
                key={r}
                className="exp-btn"
                disabled={disabled}
                style={{ borderColor: hex(RARITY_COLOR[r]) }}
                title={
                  !catchable
                    ? 'Aucune espèce capturable (biome/bac requis)'
                    : !affordable
                      ? "Pas assez d'appâts"
                      : ''
                }
                onClick={() => onStartExpedition(r)}
              >
                <span className="exp-rarity" style={{ color: hex(RARITY_COLOR[r]) }}>
                  {RARITY_LABEL[r]}
                </span>
                <span className="exp-cost">🪱 {cost}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* --- Appâts --- */}
      <div className="shop-group">
        <h3>Appâts</h3>
        <div className="row">
          {[10, 50].map((n) => {
            const cost = D(BAIT_PRICE).mul(n);
            return (
              <button
                key={n}
                className="btn"
                disabled={state.money.lt(cost)}
                onClick={() => game.buyBait(n)}
              >
                +{n} 🪱<small>{formatMoney(cost)}</small>
              </button>
            );
          })}
        </div>
      </div>

      {/* --- Améliorations --- */}
      <div className="shop-group">
        <h3>Améliorations</h3>
        {UPGRADES.filter((u) => game.isUpgradeUnlocked(u.id)).map((u) => {
          const level = state.upgrades[u.id] ?? 0;
          const cost = game.upgradeCost(u.id)!;
          const affordable = state.money.gte(cost);
          return (
            <div className="shop-item" key={u.id}>
              <div className="shop-item-info">
                <strong>
                  {u.name} <span className="lvl">Niv. {level}</span>
                </strong>
                <small>{u.description}</small>
              </div>
              <button className="btn" disabled={!affordable} onClick={() => game.buyUpgrade(u.id)}>
                {formatMoney(cost)}
              </button>
            </div>
          );
        })}
      </div>

      {/* --- Bacs --- */}
      <div className="shop-group">
        <h3>Bacs</h3>
        {state.tanks.map((t) => {
          const cost = game.expandCost(t.id)!;
          const affordable = state.money.gte(cost);
          return (
            <div className="shop-item" key={t.id}>
              <div className="shop-item-info">
                <strong>
                  {t.name} <span className="lvl">Vol. {t.volume}</span>
                </strong>
                <small>{t.waterTemp}°C · {t.biome}</small>
              </div>
              <button className="btn" disabled={!affordable} onClick={() => game.expandTank(t.id)}>
                Agrandir<br />
                <small>{formatMoney(cost)}</small>
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function hex(color: number): string {
  return '#' + color.toString(16).padStart(6, '0');
}
