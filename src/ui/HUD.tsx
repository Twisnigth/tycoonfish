import { useGameSelector } from './GameContext';
import { formatMoney } from '../core/numbers';

/** Bandeau supérieur : ressources et état du parc. */
export function HUD() {
  const money = useGameSelector((g) => formatMoney(g.state.money));
  const appeal = useGameSelector((g) => Math.round(g.state.park.appeal));
  const guests = useGameSelector((g) => g.state.park.guestsInPark);
  const sat = useGameSelector((g) => Math.round(g.state.park.avgSatisfaction * 100));
  const day = useGameSelector((g) => g.state.park.day);
  const bait = useGameSelector((g) => g.state.bait);

  return (
    <header className="hud">
      <div className="hud-resources">
        <Res icon="💰" value={money} label="Argent" />
        <Res icon="✨" value={String(appeal)} label="Attrait" />
        <Res icon="🧑‍🤝‍🧑" value={String(guests)} label="Visiteurs" />
        <Res icon="😊" value={`${sat}%`} label="Satisfaction" />
        <Res icon="🪱" value={String(bait)} label="Appâts" />
      </div>
      <div className="hud-day">Jour {day}</div>
    </header>
  );
}

function Res({ icon, value, label }: { icon: string; value: string; label: string }) {
  return (
    <div className="resource">
      <span className="resource-icon">{icon}</span>
      <div className="resource-body">
        <span className="resource-value">{value}</span>
        <span className="resource-label">{label}</span>
      </div>
    </div>
  );
}
