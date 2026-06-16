import { useGame, useGameVersion } from './GameContext';
import { formatMoney } from '../core/numbers';
import { RARITY_LABEL, RARITY_ORDER, type Rarity } from '../data/types';
import { BAIT_COST } from '../data/balance';

/** Panneau de gestion : prix du billet, finances, et expéditions de pêche. */
export function ParkManagementPanel({ onStartExpedition }: { onStartExpedition: (r: Rarity) => void }) {
  const game = useGame();
  useGameVersion();
  const p = game.state.park;
  const invCount = Object.values(game.state.caughtInventory).reduce((a, n) => a + n, 0);

  return (
    <section className="panel park">
      <h2 className="panel-title">Gestion du parc</h2>

      <div className="park-stats">
        <div><span>Attrait</span><strong>{Math.round(p.appeal)}</strong></div>
        <div><span>Satisfaction</span><strong>{Math.round(p.avgSatisfaction * 100)}%</strong></div>
        <div><span>Recettes / jour</span><strong className="good">{formatMoney(p.incomeToday)}</strong></div>
        <div><span>Dépenses / jour</span><strong className="bad">{formatMoney(p.expensesToday)}</strong></div>
      </div>

      <div className="ticket">
        <span>Prix du billet</span>
        <div className="ticket-ctrl">
          <button onClick={() => game.setTicketPrice(p.ticketPrice - 1)}>−</button>
          <strong>{p.ticketPrice}$</strong>
          <button onClick={() => game.setTicketPrice(p.ticketPrice + 1)}>+</button>
        </div>
      </div>

      <div className="shop-group">
        <h3>Pêche — expéditions</h3>
        <p className="shop-hint">
          Appâts : {game.state.bait} · <button className="btn btn-sm" onClick={() => game.buyBait(10)}>+10 ({formatMoney(80)})</button>
        </p>
        <p className="shop-hint">Inventaire à affecter : {invCount} poisson(s). Clique un bac pour les placer.</p>
        <div className="exp-grid">
          {RARITY_ORDER.map((r) => {
            const cost = BAIT_COST[r];
            const catchable = game.catchableSpecies(r).length > 0;
            const disabled = !catchable || game.state.bait < cost;
            return (
              <button key={r} className="exp-btn" disabled={disabled} onClick={() => onStartExpedition(r)}>
                <span className="exp-rarity">{RARITY_LABEL[r]}</span>
                <span className="exp-cost">🪱 {cost}</span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
