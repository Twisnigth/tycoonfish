import { Emitter } from './Emitter';
import { Decimal, D } from './numbers';
import { bumpStore, replaceState, useGameStore } from '../store/gameStore';
import {
  createTank,
  nextId,
  type GameState,
  type PlacedBuilding,
} from './GameState';
import { GridManager, Tile } from '../world/Grid';
import { AgentSystem } from '../systems/AgentSystem';
import { addIncome, economyTick, spawnRatePerSec } from './ParkEconomy';
import {
  BUILDINGS,
  DONATION_PER_APPEAL,
  FOOD_PRICE,
  type BuildingType,
} from '../data/buildings';
import { ALL_FISH, getFish } from '../data/fish';
import { BAIT_COST, BAIT_PRICE, costAt } from '../data/balance';
import type { FishSpecies, Rarity } from '../data/types';

export interface GameEvents {
  worldChanged: void;
  tankUpdated: { buildingId: string };
  fishCaught: { speciesId: string };
  [key: string]: unknown;
}

const PLOT_COST = { base: 2000, growth: 1.6 };

/**
 * Contrôleur central v2 (Park Builder). Détient la grille (`GridManager`) et la
 * foule (`AgentSystem`) HORS de Zustand, et écrit le macro-état dans le store.
 */
export class Game {
  readonly events = new Emitter<GameEvents>();
  readonly grid = new GridManager();
  readonly agents: AgentSystem;
  private spawnAcc = 0;

  constructor(initial?: GameState) {
    if (initial) replaceState(initial);
    this.agents = new AgentSystem(this.grid, () => this.state.buildings, {
      onDonate: (appeal) => addIncome(this.state, D(DONATION_PER_APPEAL).mul(appeal)),
      onEat: () => addIncome(this.state, D(FOOD_PRICE)),
      onLeave: (sat) => {
        this.state.stats.guestsServed += 1;
        const p = this.state.park;
        p.guestsInPark = Math.max(0, p.guestsInPark - 1);
        p.avgSatisfaction = p.avgSatisfaction * 0.95 + sat * 0.05;
      },
    });
    this.rebuildWorld();
  }

  get state(): GameState {
    return useGameStore.getState();
  }

  // ---- Monde (grille) ----------------------------------------------------

  /** Reconstruit grille + champs depuis l'état (init / chargement). */
  rebuildWorld(): void {
    for (const packed of this.state.plots) this.grid.ownPlotByIndex(packed);
    this.restampGrid();
    this.agents.recompute();
  }

  /** Réécrit l'occupation de la grille depuis `buildings` (préserve `owned`). */
  private restampGrid(): void {
    this.grid.tile.fill(Tile.Empty);
    this.grid.occupant.fill(-1);
    this.state.buildings.forEach((b, idx) => {
      const def = BUILDINGS[b.type];
      if (b.type === 'path') {
        const i = this.grid.idx(b.gx, b.gy);
        this.grid.tile[i] = Tile.Path;
        this.grid.occupant[i] = idx;
      } else {
        this.grid.place(b.gx, b.gy, def.w, def.h, idx, Tile.Building);
      }
    });
  }

  // ---- Construction ------------------------------------------------------

  isUnlocked(type: BuildingType): boolean {
    const req = BUILDINGS[type].requiresResearch;
    return !req || this.state.unlockedResearch.includes(req);
  }

  canPlace(type: BuildingType, gx: number, gy: number): boolean {
    const def = BUILDINGS[type];
    if (!this.isUnlocked(type)) return false;
    return this.grid.canPlace(gx, gy, def.w, def.h);
  }

  placeBuilding(type: BuildingType, gx: number, gy: number): boolean {
    const def = BUILDINGS[type];
    if (!this.canPlace(type, gx, gy)) return false;
    const cost = D(def.cost);
    if (this.state.money.lt(cost)) return false;

    this.state.money = this.state.money.sub(cost);
    const b: PlacedBuilding = { id: nextId('b'), type, gx, gy, rot: 0 };
    if (def.render.kind === 'tank') {
      const vol = def.w * def.h * 6;
      b.tank = createTank(def.render.biome, vol, def.render.temp);
    }
    const idx = this.state.buildings.push(b) - 1;
    if (type === 'path') {
      const i = this.grid.idx(gx, gy);
      this.grid.tile[i] = Tile.Path;
      this.grid.occupant[i] = idx;
    } else {
      this.grid.place(gx, gy, def.w, def.h, idx, Tile.Building);
    }
    this.agents.recompute();
    this.events.emit('worldChanged', undefined);
    bumpStore();
    return true;
  }

  /** Supprime le bâtiment couvrant la case (sauf l'entrée). */
  removeBuildingAt(gx: number, gy: number): boolean {
    if (!this.grid.inBounds(gx, gy)) return false;
    const idx = this.grid.occupant[this.grid.idx(gx, gy)];
    if (idx < 0) return false;
    const b = this.state.buildings[idx];
    if (!b || b.type === 'entrance') return false;
    this.state.buildings.splice(idx, 1);
    this.restampGrid(); // réindexe les occupants
    this.agents.recompute();
    this.events.emit('worldChanged', undefined);
    bumpStore();
    return true;
  }

  buildingAt(gx: number, gy: number): PlacedBuilding | undefined {
    if (!this.grid.inBounds(gx, gy)) return undefined;
    const idx = this.grid.occupant[this.grid.idx(gx, gy)];
    return idx >= 0 ? this.state.buildings[idx] : undefined;
  }

  // ---- Parcelles ---------------------------------------------------------

  plotCost(): Decimal {
    return costAt(PLOT_COST, this.state.plots.length);
  }

  buyPlotAt(gx: number, gy: number): boolean {
    if (!this.grid.inBounds(gx, gy) || this.grid.isOwned(gx, gy)) return false;
    const cost = this.plotCost();
    if (this.state.money.lt(cost)) return false;
    this.state.money = this.state.money.sub(cost);
    this.grid.ownPlotAt(gx, gy);
    this.state.plots.push(this.grid.plotOriginIndex(gx, gy));
    this.events.emit('worldChanged', undefined);
    bumpStore();
    return true;
  }

  // ---- Parc / pêche ------------------------------------------------------

  setTicketPrice(p: number): void {
    this.state.park.ticketPrice = Math.max(0, Math.round(p));
    bumpStore();
  }

  buyBait(amount: number): boolean {
    const cost = D(BAIT_PRICE).mul(amount);
    if (this.state.money.lt(cost)) return false;
    this.state.money = this.state.money.sub(cost);
    this.state.bait += amount;
    bumpStore();
    return true;
  }

  catchableSpecies(rarity: Rarity): FishSpecies[] {
    return ALL_FISH.filter(
      (f) => f.rarity === rarity && this.state.unlockedBiomes.includes(f.requirements.biome),
    );
  }

  beginExpedition(rarity: Rarity): FishSpecies | null {
    const cost = BAIT_COST[rarity];
    if (this.state.bait < cost) return null;
    const pool = this.catchableSpecies(rarity);
    if (pool.length === 0) return null;
    this.state.bait -= cost;
    bumpStore();
    return pool[(Math.random() * pool.length) | 0];
  }

  /** Capture réussie → le poisson va dans l'inventaire (à affecter à un bac). */
  resolveCatch(species: FishSpecies): void {
    this.state.caughtInventory[species.id] = (this.state.caughtInventory[species.id] ?? 0) + 1;
    this.state.stats.fishCaught += 1;
    this.events.emit('fishCaught', { speciesId: species.id });
    bumpStore();
  }

  /** Affecte un poisson de l'inventaire à un bac compatible. */
  assignFish(buildingId: string, speciesId: string): boolean {
    if ((this.state.caughtInventory[speciesId] ?? 0) <= 0) return false;
    const b = this.state.buildings.find((x) => x.id === buildingId);
    const sp = getFish(speciesId);
    if (!b || !b.tank || !sp) return false;
    const r = sp.requirements;
    if (b.tank.biome !== r.biome) return false;
    if (b.tank.waterTemp < r.minTemp || b.tank.waterTemp > r.maxTemp) return false;
    if (b.tank.volume < r.minVolume) return false;

    this.state.caughtInventory[speciesId] -= 1;
    b.tank.fish[speciesId] = (b.tank.fish[speciesId] ?? 0) + 1;
    this.events.emit('tankUpdated', { buildingId });
    bumpStore();
    return true;
  }

  // ---- Boucles -----------------------------------------------------------

  /** Tick logique 1 Hz : économie + jour + push UI. */
  tick(): void {
    economyTick(this.state, 1);
    bumpStore();
  }

  /** Simulation foule (appelée à la fréquence du rendu). */
  simulateAgents(dt: number): void {
    this.spawnAcc += spawnRatePerSec(this.state) * dt;
    while (this.spawnAcc >= 1) {
      this.spawnAcc -= 1;
      if (this.agents.spawnReady) {
        const before = this.agents.count;
        this.agents.spawn();
        if (this.agents.count > before) {
          addIncome(this.state, D(this.state.park.ticketPrice)); // billet à l'entrée
          this.state.park.guestsInPark += 1;
        }
      }
    }
    this.agents.update(dt);
  }
}
