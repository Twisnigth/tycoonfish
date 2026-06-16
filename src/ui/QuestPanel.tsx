import { useGame, useGameVersion } from './GameContext';
import { useUiStore } from '../store/uiStore';
import { QUESTS } from '../data/quests';

/**
 * Panneau de campagne (mode Histoire) : quête active, progression et récompense.
 * Remplace la checklist d'objectifs du mode bac à sable.
 */
export function QuestPanel() {
  const game = useGame();
  useGameVersion();
  const hidden = useUiStore((s) => s.hideObjectives);
  const setHide = useUiStore((s) => s.setHideObjectives);

  const s = game.state;
  if (s.mode !== 'story' || hidden) return null;

  const total = QUESTS.length;
  const done = Math.min(s.questIndex, total);
  const quest = game.currentQuest;

  const reward = (r: { money?: number; bait?: number; conservation?: number }) => {
    const parts: string[] = [];
    if (r.money) parts.push(`+${r.money} $`);
    if (r.bait) parts.push(`+${r.bait} appâts`);
    if (r.conservation) parts.push(`+${r.conservation} 🌊`);
    return parts.join(' · ');
  };

  return (
    <div className="quests">
      <header>
        <strong>📖 Campagne</strong>
        <span className="quest-count">{done}/{total}</span>
        <button className="btn-close" onClick={() => setHide(true)}>✕</button>
      </header>
      <div className="quest-bar">
        <span style={{ width: `${(done / total) * 100}%` }} />
      </div>
      {quest ? (
        <div className="quest-active">
          <div className="quest-title">🎯 {quest.title}</div>
          <p className="quest-desc">{quest.desc}</p>
          <div className="quest-reward">Récompense : {reward(quest.reward)}</div>
        </div>
      ) : (
        <div className="quest-active quest-done">
          <div className="quest-title">🏆 Campagne terminée !</div>
          <p className="quest-desc">Votre parc est une légende. Continuez à le faire grandir.</p>
        </div>
      )}
    </div>
  );
}
