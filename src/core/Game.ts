import { Store } from './Store';
import { Emitter } from './Emitter';
import { Decimal, D } from './numbers';
import {
  createInitialState,
  createTank,
  volumeForLevel,
  type GameState,
  type TankState,
} from './GameState';
import * as Economy from './EconomyEngine';
import { checkProgression } from './ProgressionFSM';
import {
  BAIT_COST,
  BAIT_PRICE,
  TANK_UPGRADE_COST,
  costAt,
  type ProgressionTier,
} from '../data/balance';
import { getUpgrade } from '../data/upgrades';
import { getResearch } from '../data/research';
import { ALL_FISH } from '../data/fish';
import type { BiomeId, FishSpecies, Rarity } from '../data/types';
import type { CatchQuality } from '../systems/FishingSystem';

export interface GameEvents {
  tierUp: ProgressionTier;
  fishCaught: { species: FishSpecies; tankId: string; quality: CatchQuality };
  income: { amount: Decimal; tankId?: string };
  purchase: { kind: 'upgrade' | 'research' | 'tank' | 'bait' | 'expand'; id: string };
  [key: string]: unknown;
}

/**
 * Contrôleur central. Détient la source de vérité (Store<GameState>) et expose
 * toutes les mutations de gameplay. La VUE 3D et l'UI React passent par lui ;
 * la logique pure (Economy, Progression) reste dans des modules séparés.
 */
export class Game {
  readonly store: Store<GameState>;
  readonly events = new Emitter<GameEvents>();

  constructor(initial?: GameState) {
    this.store = new Store(initial ?? createInitialState());
  }

  get state(): GameState {
    return this.store.getState();
  }

  // ---- Boucle économique -------------------------------------------------

  /** Avance l'économie de `ticks` ticks puis vérifie la progression. */
  tick(ticks = 1): void {
    const before = this.state.money;
    Economy.tick(this.state, ticks);
    const gained = this.state.money.sub(before);
    if (gained.gt(0)) this.events.emit('income', { amount: gained });

    for (const t of checkProgression(this.state)) {
      this.events.emit('tierUp', t);
    }
    this.store.bump();
  }

  revenuePerTick(): Decimal {
    return Economy.revenuePerTick(this.state);
  }
  researchPerTick(): Decimal {
    return Economy.researchPerTick(this.state);
  }

  // ---- Achats ------------------------------------------------------------

  private afford(cost: Decimal, pool: 'money' | 'research' = 'money'): boolean {
    return this.state[pool].gte(cost);
  }

  upgradeCost(id: string): Decimal | null {
    const u = getUpgrade(id);
    if (!u) return null;
    const level = this.state.upgrades[id] ?? 0;
    return costAt(u.cost, level);
  }

  isUpgradeUnlocked(id: string): boolean {
    const u = getUpgrade(id);
    if (!u) return false;
    return !u.requiresResearch || this.state.unlockedResearch.includes(u.requiresResearch);
  }

  buyUpgrade(id: string): boolean {
    const u = getUpgrade(id);
    if (!u || !this.isUpgradeUnlocked(id)) return false;
    const level = this.state.upgrades[id] ?? 0;
    if (u.maxLevel > 0 && level >= u.maxLevel) return false;
    const cost = costAt(u.cost, level);
    if (!this.afford(cost)) return false;

    this.state.money = this.state.money.sub(cost);
    this.state.upgrades[id] = level + 1;
    this.events.emit('purchase', { kind: 'upgrade', id });
    this.store.bump();
    return true;
  }

  canBuyResearch(id: string): boolean {
    const r = getResearch(id);
    if (!r) return false;
    if (this.state.unlockedResearch.includes(id)) return false;
    if (!r.requires.every((req) => this.state.unlockedResearch.includes(req))) return false;
    return this.afford(D(r.cost), 'research');
  }

  buyResearch(id: string): boolean {
    const r = getResearch(id);
    if (!r || !this.canBuyResearch(id)) return false;

    this.state.research = this.state.research.sub(D(r.cost));
    this.state.unlockedResearch.push(id);
    for (const e of r.effects) {
      if (e.type === 'unlockBiome' && !this.state.unlockedBiomes.includes(e.biome)) {
        this.state.unlockedBiomes.push(e.biome);
      }
    }
    this.events.emit('purchase', { kind: 'research', id });
    this.store.bump();
    return true;
  }

  // ---- Bacs --------------------------------------------------------------

  expandCost(tankId: string): Decimal | null {
    const tank = this.state.tanks.find((t) => t.id === tankId);
    if (!tank) return null;
    return costAt(TANK_UPGRADE_COST, tank.level);
  }

  expandTank(tankId: string): boolean {
    const tank = this.state.tanks.find((t) => t.id === tankId);
    if (!tank) return false;
    const cost = costAt(TANK_UPGRADE_COST, tank.level);
    if (!this.afford(cost)) return false;

    this.state.money = this.state.money.sub(cost);
    tank.level += 1;
    tank.volume = volumeForLevel(tank.level);
    this.events.emit('purchase', { kind: 'expand', id: tankId });
    this.store.bump();
    return true;
  }

  /** Crée un nouveau bac pour un biome débloqué (coût croissant avec le nombre de bacs). */
  buildTank(biome: BiomeId, name: string): TankState | null {
    if (!this.state.unlockedBiomes.includes(biome)) return null;
    const cost = costAt({ base: 1_000, growth: 2 }, this.state.tanks.length - 1);
    if (!this.afford(cost)) return null;

    this.state.money = this.state.money.sub(cost);
    const tank = createTank(`tank-${this.state.tanks.length}`, name, biome);
    this.state.tanks.push(tank);
    this.events.emit('purchase', { kind: 'tank', id: tank.id });
    this.store.bump();
    return tank;
  }

  // ---- Appâts & Pêche ----------------------------------------------------

  buyBait(amount: number): boolean {
    const cost = D(BAIT_PRICE).mul(amount);
    if (!this.afford(cost)) return false;
    this.state.money = this.state.money.sub(cost);
    this.state.bait += amount;
    this.events.emit('purchase', { kind: 'bait', id: String(amount) });
    this.store.bump();
    return true;
  }

  /** Premier bac compatible avec les exigences d'une espèce (biome/temp/volume). */
  compatibleTank(species: FishSpecies): TankState | undefined {
    const req = species.requirements;
    return this.state.tanks.find(
      (t) =>
        t.biome === req.biome &&
        t.waterTemp >= req.minTemp &&
        t.waterTemp <= req.maxTemp &&
        t.volume >= req.minVolume,
    );
  }

  /** Espèces d'une rareté actuellement capturables (biome débloqué + bac compatible). */
  catchableSpecies(rarity: Rarity): FishSpecies[] {
    return ALL_FISH.filter(
      (f) =>
        f.rarity === rarity &&
        this.state.unlockedBiomes.includes(f.requirements.biome) &&
        this.compatibleTank(f) !== undefined,
    );
  }

  /**
   * Démarre une expédition : consomme les appâts et tire une espèce cible.
   * Retourne l'espèce à pêcher (à passer à une FishingSession) ou null si
   * impossible (pas assez d'appâts / aucune espèce capturable).
   */
  beginExpedition(rarity: Rarity): FishSpecies | null {
    const cost = BAIT_COST[rarity];
    if (this.state.bait < cost) return null;
    const pool = this.catchableSpecies(rarity);
    if (pool.length === 0) return null;

    this.state.bait -= cost;
    const species = pool[Math.floor(Math.random() * pool.length)];
    this.store.bump();
    return species;
  }

  /** Résout une capture réussie : ajoute le poisson + bonus de qualité immédiat. */
  resolveCatch(species: FishSpecies, quality: CatchQuality, qualityBonus: number): void {
    const tank = this.compatibleTank(species);
    if (!tank) return;

    tank.fish[species.id] = (tank.fish[species.id] ?? 0) + 1;
    this.state.stats.fishCaught += 1;

    // Récompense de skill : ~1 min de revenu de l'espèce, modulée par la qualité.
    const bonus = D(species.baseRevenuePerTick).mul(60).mul(qualityBonus);
    this.state.money = this.state.money.add(bonus);
    this.state.totalEarned = this.state.totalEarned.add(bonus);

    this.events.emit('fishCaught', { species, tankId: tank.id, quality });
    this.events.emit('income', { amount: bonus, tankId: tank.id });
    this.store.bump();
  }
}
