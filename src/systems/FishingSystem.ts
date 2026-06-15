import type { FishSpecies, FishingDifficulty } from '../data/types';
import { CATCH_QUALITY_BONUS } from '../data/balance';

export type StrikeResult = 'hit' | 'perfect' | 'miss';
export type FishingPhase = 'active' | 'won' | 'lost';
export type CatchQuality = 'perfect' | 'flawless' | 'normal';

/**
 * Session de pêche — mécanique TIMING / PRÉCISION, 100 % logique (aucun DOM,
 * aucun Three.js → testable au unit-test). La vue (React) appelle `update(dt)`
 * dans son rAF et `strike()` sur l'action du joueur, puis lit l'état pour
 * dessiner la barre, le curseur, la zone et la progression.
 *
 * Le curseur balaie la barre [0..1] en ping-pong. Frapper alors qu'il chevauche
 * la zone cible = réussite ; dans la sous-zone « Parfait » = bonus. Atteindre
 * `requiredHits` réussites gagne ; atteindre `missTolerance` ratés casse la ligne.
 */
export class FishingSession {
  readonly species: FishSpecies;
  readonly difficulty: FishingDifficulty;

  phase: FishingPhase = 'active';
  cursor = 0; // 0..1
  private dir: 1 | -1 = 1;

  zoneStart = 0;
  zoneSize: number;
  perfectStart = 0;
  perfectSize: number;

  hits = 0;
  misses = 0;
  lastResult: StrikeResult | null = null;
  private sawPerfect = false;

  constructor(species: FishSpecies) {
    this.species = species;
    this.difficulty = species.fishingDifficulty;
    this.zoneSize = this.difficulty.zoneSize;
    this.perfectSize = Math.min(this.difficulty.perfectSize, this.zoneSize);
    this.cursor = Math.random();
    this.dir = Math.random() < 0.5 ? 1 : -1;
    this.placeZone();
  }

  get requiredHits(): number {
    return this.difficulty.requiredHits;
  }
  get missTolerance(): number {
    return this.difficulty.missTolerance;
  }
  get finished(): boolean {
    return this.phase !== 'active';
  }
  /** Progression de capture 0..1, pour la jauge de l'UI. */
  get progress(): number {
    return Math.min(1, this.hits / this.requiredHits);
  }

  /** Avance le curseur (ping-pong). `dt` en secondes. */
  update(dt: number): void {
    if (this.finished) return;
    this.cursor += this.dir * this.difficulty.sweepSpeed * dt;
    if (this.cursor >= 1) {
      this.cursor = 1 - (this.cursor - 1);
      this.dir = -1;
    } else if (this.cursor <= 0) {
      this.cursor = -this.cursor;
      this.dir = 1;
    }
  }

  /** Le joueur frappe. Évalue la position, met à jour l'état, gère la fin. */
  strike(): StrikeResult {
    if (this.finished) return this.lastResult ?? 'miss';

    const inZone =
      this.cursor >= this.zoneStart && this.cursor <= this.zoneStart + this.zoneSize;
    const inPerfect =
      this.cursor >= this.perfectStart &&
      this.cursor <= this.perfectStart + this.perfectSize;

    let result: StrikeResult;
    if (inPerfect) {
      result = 'perfect';
      this.hits++;
      this.sawPerfect = true;
    } else if (inZone) {
      result = 'hit';
      this.hits++;
    } else {
      result = 'miss';
      this.misses++;
    }
    this.lastResult = result;

    if (this.hits >= this.requiredHits) {
      this.phase = 'won';
    } else if (this.misses >= this.missTolerance) {
      this.phase = 'lost';
    } else if (this.difficulty.zoneShuffle && result !== 'miss') {
      this.placeZone();
    }
    return result;
  }

  /** Qualité finale de la prise (bonus de revenu/valeur). */
  get quality(): CatchQuality {
    if (this.sawPerfect) return 'perfect';
    if (this.misses === 0) return 'flawless';
    return 'normal';
  }

  get qualityBonus(): number {
    return CATCH_QUALITY_BONUS[this.quality];
  }

  private placeZone(): void {
    this.zoneStart = Math.random() * (1 - this.zoneSize);
    this.perfectStart =
      this.zoneStart + Math.random() * (this.zoneSize - this.perfectSize);
  }
}
