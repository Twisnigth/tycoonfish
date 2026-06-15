import { useGame, useGameSelector } from './GameContext';
import { formatMoney, formatNumber } from '../core/numbers';
import { currentTier, nextTier, progressToNextTier } from '../core/ProgressionFSM';

/** Bandeau supérieur : ressources, revenu/s et palier d'évolution courant. */
export function HUD() {
  const game = useGame();

  const money = useGameSelector((g) => formatMoney(g.state.money));
  const research = useGameSelector((g) => formatNumber(g.state.research));
  const bait = useGameSelector((g) => g.state.bait);
  const revenue = useGameSelector((g) => formatMoney(g.revenuePerTick()));
  const researchRate = useGameSelector((g) => formatNumber(g.researchPerTick()));

  const tierName = useGameSelector((g) => currentTier(g.state).name);
  const nextName = useGameSelector((g) => nextTier(g.state)?.name ?? null);
  const tierPct = useGameSelector((g) => Math.round(progressToNextTier(g.state) * 100));

  return (
    <header className="hud">
      <div className="hud-resources">
        <Resource icon="💰" label="Argent" value={money} sub={`${revenue}/s`} />
        <Resource icon="🔬" label="Recherche" value={research} sub={`${researchRate}/s`} />
        <Resource icon="🪱" label="Appâts" value={String(bait)} />
      </div>

      <div className="hud-tier">
        <div className="hud-tier-name">
          <span className="hud-tier-badge">{game.state.progressionTier}</span>
          {tierName}
        </div>
        {nextName && (
          <div className="hud-tier-progress" title={`${tierPct}% vers ${nextName}`}>
            <div className="hud-tier-bar" style={{ width: `${tierPct}%` }} />
            <span className="hud-tier-next">→ {nextName}</span>
          </div>
        )}
      </div>
    </header>
  );
}

function Resource({
  icon,
  label,
  value,
  sub,
}: {
  icon: string;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="resource">
      <span className="resource-icon">{icon}</span>
      <div className="resource-body">
        <span className="resource-value">{value}</span>
        <span className="resource-label">
          {label}
          {sub && <em className="resource-sub"> · {sub}</em>}
        </span>
      </div>
    </div>
  );
}
