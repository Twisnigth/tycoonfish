import { useGame, useGameVersion } from './GameContext';
import { useUiStore } from '../store/uiStore';

/** Onboarding : checklist d'objectifs de départ, auto-complétée depuis l'état. */
export function ObjectivesPanel() {
  const game = useGame();
  useGameVersion();
  const hidden = useUiStore((s) => s.hideObjectives);
  const setHide = useUiStore((s) => s.setHideObjectives);

  const s = game.state;
  const tanks = s.buildings.filter((b) => b.tank);
  const steps = [
    { t: "Relier un chemin à l'entrée", done: game.agents.spawnReady },
    { t: 'Ouvrir le parc', done: s.park.isOpen },
    { t: 'Construire un bac', done: tanks.length > 0 },
    { t: 'Pêcher un poisson', done: s.stats.fishCaught > 0 },
    { t: 'Placer un poisson dans un bac', done: tanks.some((b) => (b.tank?.fish.length ?? 0) > 0) },
    { t: 'Construire un stand snack', done: s.buildings.some((b) => b.type === 'food') },
  ];
  const allDone = steps.every((st) => st.done);
  if (hidden || allDone) return null;

  return (
    <div className="objectives">
      <header>
        <strong>🎯 Objectifs</strong>
        <button className="btn-close" onClick={() => setHide(true)}>✕</button>
      </header>
      <ul>
        {steps.map((st, i) => (
          <li key={i} className={st.done ? 'done' : ''}>
            {st.done ? '✅' : '⬜'} {st.t}
          </li>
        ))}
      </ul>
    </div>
  );
}
