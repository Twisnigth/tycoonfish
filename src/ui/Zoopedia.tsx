import { useMemo, useState } from 'react';
import { ALL_FISH } from '../data/fish';
import { ALL_BIOMES, biomeName } from '../data/biomes';
import { RARITY_COLOR, RARITY_LABEL, type BiomeId, type FishSpecies } from '../data/types';

/**
 * Zoopédie — encyclopédie des espèces. Pour chaque poisson : rareté, biome et
 * besoins de bien-être (température idéale, espace, taille de banc, agressivité).
 * Aide le joueur à savoir comment aménager chaque bac.
 */
export function Zoopedia() {
  const [biome, setBiome] = useState<BiomeId | 'all'>('all');
  const list = useMemo(
    () => (biome === 'all' ? ALL_FISH : ALL_FISH.filter((f) => f.requirements.biome === biome)),
    [biome],
  );

  return (
    <div className="tab-zoo">
      <p className="muted">{ALL_FISH.length} espèces répertoriées · besoins d'habitat pour bien les soigner.</p>
      <div className="zoo-filters">
        <button className={biome === 'all' ? 'active' : ''} onClick={() => setBiome('all')}>Tous</button>
        {ALL_BIOMES.map((b) => (
          <button key={b} className={biome === b ? 'active' : ''} onClick={() => setBiome(b)}>
            {biomeName(b)}
          </button>
        ))}
      </div>
      <ul className="zoo-list">
        {list.map((f) => (
          <ZooCard key={f.id} f={f} />
        ))}
      </ul>
    </div>
  );
}

function ZooCard({ f }: { f: FishSpecies }) {
  const tags: string[] = [];
  if (f.predator) tags.push('🦈 Prédateur');
  else if (f.aggressive) tags.push('⚔️ Agressif');
  if (f.socialMin >= 4) tags.push('👥 Banc');
  return (
    <li className="zoo-card">
      <span className="zoo-dot" style={{ background: `#${f.tint.toString(16).padStart(6, '0')}` }} />
      <div className="zoo-main">
        <div className="zoo-name">
          <strong>{f.name}</strong>
          <em style={{ color: `#${RARITY_COLOR[f.rarity].toString(16).padStart(6, '0')}` }}>
            {RARITY_LABEL[f.rarity]}
          </em>
        </div>
        <div className="zoo-needs">
          <span title="Biome">🌍 {biomeName(f.requirements.biome)}</span>
          <span title="Température idéale">🌡️ {f.idealTemp}°C</span>
          <span title="Espace par individu">📏 {f.spacePerFish} vol.</span>
          <span title="Banc minimum">👥 ×{f.socialMin}</span>
          {f.requirements.minVolume > 1 && <span title="Volume minimum du bac">🪟 ≥{f.requirements.minVolume}</span>}
        </div>
        {tags.length > 0 && <div className="zoo-tags">{tags.join(' · ')}</div>}
      </div>
    </li>
  );
}
