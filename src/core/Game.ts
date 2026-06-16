import { Emitter } from './Emitter';
import { Decimal, D } from './numbers';
import { bumpStore, replaceState, useGameStore } from '../store/gameStore';
import {
  createTank,
  nextId,
  type Employee,
  type GameState,
  type PlacedBuilding,
  type StaffRole,
  type TankState,
} from './GameState';
import { breedFish, createFish, type Fish } from './Fish';
import { GridManager, Tile } from '../world/Grid';
import { AgentSystem } from '../systems/AgentSystem';
import { StaffSystem } from '../systems/StaffSystem';
import {
  addIncome,
  economyTick,
  estimateNetPerSec,
  maxConcurrent,
  POPULARITY_RAMP,
  spawnRatePerSec,
  targetDraw,
} from './ParkEconomy';
import { ecosystemTick, STAFF_HIRE_COST } from './Ecosystem';
import { computeWelfare, type WelfareReport } from './Welfare';
import {
  BUILDINGS,
  DONATION_PER_APPEAL,
  FOOD_TYPES,
  isPathType,
  type BuildingType,
} from '../data/buildings';
import { defaultProducts, PRODUCTS } from '../data/products';
import { ALL_FISH, getFish } from '../data/fish';
import { EQUIPMENT } from '../data/equipment';
import { TANK_DECOR } from '../data/tankDecor';
import {
  BAIT_COST, BAIT_PRICE, BIOME_MIN_LEVEL, BREED_BOOST_CHANCE, BREED_DURATION_MS, costAt, EQUIPMENT_RESEARCH,
  OFFLINE_CAP_HOURS, OFFLINE_EFFICIENCY, RARITY_RESEARCH, RESEARCH, RESEARCH_BY_ID,
} from '../data/balance';
import { Rarity, type BiomeId, type FishSpecies } from '../data/types';
import { QUESTS } from '../data/quests';

export type NotifyKind = 'bad' | 'warn' | 'good';

export interface GameEvents {
  worldChanged: void;
  tankUpdated: { buildingId: string };
  fishCaught: { speciesId: string };
  staffChanged: void;
  questChanged: void;
  notify: { text: string; kind: NotifyKind };
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
  readonly staff: StaffSystem;
  private spawnAcc = 0;
  /** Derniers commentaires de visiteurs (style RCT), du plus récent au plus ancien. */
  readonly thoughts: string[] = [];
  /** Bilan de progression hors-ligne au chargement (consommé une fois par l'UI). */
  offlineReport: { ms: number; gain: number } | null = null;
  /** Déchets laissés par les visiteurs (transitoire, non sauvegardé). */
  readonly litter: { id: string; x: number; z: number }[] = [];
  private litterSeq = 0;

  constructor(initial?: GameState) {
    if (initial) replaceState(initial);
    this.agents = new AgentSystem(this.grid, () => this.state.buildings, {
      onDonate: (appeal) => addIncome(this.state, D(DONATION_PER_APPEAL).mul(appeal), 'donations'),
      onEat: (shop) => {
        let price = shop.salePrice ?? 12;
        const prods = shop.products;
        if (prods && prods.length) {
          const id = prods[(Math.random() * prods.length) | 0];
          price = PRODUCTS[id]?.price ?? price;
        }
        addIncome(this.state, D(price), 'shops');
      },
      onLeave: () => {
        this.state.stats.guestsServed += 1;
      },
      onThought: (text) => {
        this.thoughts.unshift(text);
        if (this.thoughts.length > 14) this.thoughts.pop();
      },
      onLitter: (x, z) => this.dropLitter(x, z),
    });
    this.staff = new StaffSystem(
      this.grid,
      () => this.state.buildings,
      () => this.state.staff.employees,
      () => this.litter,
      (id) => this.removeLitter(id),
    );
    this.rebuildWorld();
  }

  // ---- Déchets ------------------------------------------------------------

  private dropLitter(x: number, z: number): void {
    this.litter.push({ id: `lit-${this.litterSeq++}`, x, z });
    if (this.litter.length > 60) this.litter.shift(); // plafond
  }

  /** Retire un déchet (ramassage par clic du joueur ou par un agent d'entretien). */
  removeLitter(id: string): void {
    const i = this.litter.findIndex((l) => l.id === id);
    if (i >= 0) this.litter.splice(i, 1);
  }

  /** Ramasse le déchet le plus proche d'un point monde (clic), dans un rayon. */
  pickUpLitterNear(x: number, z: number, radius = 1.6): boolean {
    let best = -1;
    let bestD = radius * radius;
    for (let i = 0; i < this.litter.length; i++) {
      const dx = this.litter[i].x - x;
      const dz = this.litter[i].z - z;
      const d = dx * dx + dz * dz;
      if (d < bestD) { bestD = d; best = i; }
    }
    if (best < 0) return false;
    this.litter.splice(best, 1);
    return true;
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
    this.staff.recompute();
    this.staff.sync();
  }

  /** Réécrit l'occupation de la grille depuis `buildings` (préserve `owned`). */
  private restampGrid(): void {
    this.grid.tile.fill(Tile.Empty);
    this.grid.occupant.fill(-1);
    this.state.buildings.forEach((b, idx) => {
      const def = BUILDINGS[b.type];
      if (isPathType(b.type)) {
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
    if (this.buildLockLevel(type) > 0) return false; // biome pas encore débloqué
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
    if (def.defaultSalePrice !== undefined) b.salePrice = def.defaultSalePrice;
    if (FOOD_TYPES.includes(type)) b.products = defaultProducts(type);
    const idx = this.state.buildings.push(b) - 1;
    if (isPathType(type)) {
      const i = this.grid.idx(gx, gy);
      this.grid.tile[i] = Tile.Path;
      this.grid.occupant[i] = idx;
    } else {
      this.grid.place(gx, gy, def.w, def.h, idx, Tile.Building);
    }
    this.agents.recompute();
    this.staff.recompute();
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
    this.staff.recompute();
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

  /** Règle le prix de vente d'une boutique (snacks/merch). */
  setSalePrice(buildingId: string, price: number): void {
    const b = this.state.buildings.find((x) => x.id === buildingId);
    if (!b) return;
    b.salePrice = Math.max(0, Math.round(price));
    bumpStore();
  }

  /** Active/désactive un produit dans une boutique. */
  toggleProduct(buildingId: string, productId: string): void {
    const b = this.state.buildings.find((x) => x.id === buildingId);
    if (!b) return;
    const set = new Set(b.products ?? []);
    if (set.has(productId)) set.delete(productId);
    else set.add(productId);
    b.products = [...set];
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
    return ALL_FISH.filter((f) => f.rarity === rarity && this.state.unlockedBiomes.includes(f.requirements.biome));
  }

  /** Au moins un Quai d'Expédition est-il construit ? (requis pour pêcher) */
  get hasExpedition(): boolean {
    return this.state.buildings.some((b) => b.type === 'expedition');
  }

  beginExpedition(rarity: Rarity): FishSpecies | null {
    if (!this.hasExpedition) return null; // il faut un Quai d'Expédition
    if (!this.rarityUnlocked(rarity)) return null; // débloqué par la recherche
    const cost = BAIT_COST[rarity];
    if (this.state.bait < cost) return null;
    const pool = this.catchableSpecies(rarity);
    if (pool.length === 0) return null;
    this.state.bait -= cost;
    bumpStore();
    return pool[(Math.random() * pool.length) | 0];
  }

  /** Capture réussie → une ENTITÉ poisson va dans l'inventaire (à affecter à un bac). */
  resolveCatch(species: FishSpecies): void {
    this.state.caughtInventory.push(createFish(species.id, { origin: 'caught' }));
    this.state.stats.fishCaught += 1;
    this.events.emit('fishCaught', { speciesId: species.id });
    bumpStore();
  }

  /** Renvoie un poisson d'un bac vers l'inventaire. */
  removeFishFromTank(buildingId: string, fishId: string): boolean {
    const b = this.state.buildings.find((x) => x.id === buildingId);
    if (!b?.tank) return false;
    const i = b.tank.fish.findIndex((f) => f.id === fishId);
    if (i < 0) return false;
    const [f] = b.tank.fish.splice(i, 1);
    this.state.caughtInventory.push(f);
    this.events.emit('tankUpdated', { buildingId });
    bumpStore();
    return true;
  }

  /** Déplace un poisson (entité) de l'inventaire vers un bac compatible. */
  assignFish(buildingId: string, speciesId: string): boolean {
    const invIdx = this.state.caughtInventory.findIndex((f) => f.species === speciesId);
    if (invIdx < 0) return false;
    const b = this.state.buildings.find((x) => x.id === buildingId);
    const sp = getFish(speciesId);
    if (!b || !b.tank || !sp) return false;
    const r = sp.requirements;
    // Biome et volume sont des contraintes dures ; la température est un levier
    // de bien-être (gérable), pas un blocage au placement.
    if (b.tank.biome !== r.biome) return false;
    if (b.tank.volume < r.minVolume) return false;

    const [fish] = this.state.caughtInventory.splice(invIdx, 1);
    b.tank.fish.push(fish);
    this.events.emit('tankUpdated', { buildingId });
    bumpStore();
    return true;
  }

  /** Ouvre ou ferme le parc (gating de l'arrivée des visiteurs). */
  setParkOpen(open: boolean): void {
    this.state.park.isOpen = open;
    bumpStore();
  }

  // ---- Boucles -----------------------------------------------------------

  private notifyCooldown: Record<string, number> = {};

  /** Émet une notification (toast) immédiate. */
  notify(text: string, kind: NotifyKind = 'warn'): void {
    this.events.emit('notify', { text, kind });
  }

  /** Notification anti-spam (au plus une par `everyMs` pour une clé donnée). */
  private notifyThrottled(key: string, text: string, kind: NotifyKind, everyMs = 20000): void {
    const t = this.state.stats.playtimeMs;
    if ((this.notifyCooldown[key] ?? -1e9) + everyMs > t) return;
    this.notifyCooldown[key] = t;
    this.notify(text, kind);
  }

  /** Tick logique 1 Hz : économie + écosystème (survie) + alertes + jour + push UI. */
  tick(): void {
    economyTick(this.state, 1);
    this.researchTick(1);
    this.incubateEggs();
    const eco = ecosystemTick(this.state, 1);
    for (const id of eco.changed) this.events.emit('tankUpdated', { buildingId: id });
    if (eco.deaths > 0) this.notify(`💀 ${eco.deaths} poisson(s) sont morts`, 'bad');
    if (eco.births > 0) this.notify(`🐣 ${eco.births} naissance(s) naturelle(s) !`, 'good');

    if (this.state.money.lt(100)) this.notifyThrottled('money', '⚠ Trésorerie basse !', 'warn');
    const dirty = this.state.buildings.some(
      (b) => b.tank && b.tank.fish.length > 0 && (b.tank.water.quality < 0.25 || b.tank.water.foodStock <= 0),
    );
    if (dirty) this.notifyThrottled('dirty', "🧽 Un bac manque d'entretien (eau/nourriture).", 'warn');
    const unhappy = this.state.buildings.some(
      (b) => b.tank && b.tank.fish.length > 0 && this.tankWelfare(b.tank).score < 0.35,
    );
    if (unhappy) this.notifyThrottled('welfare', "🌡️ Un habitat a un bien-être critique — vérifie l'onglet Aquariums.", 'warn');

    this.checkQuests();
    bumpStore();
  }

  /**
   * Progression hors-ligne : à la reprise, estime le résultat net gagné pendant
   * l'absence (plafonné, à efficacité réduite ; jamais de perte d'argent ni de
   * morts hors-ligne). Renseigne `offlineReport` pour l'UI.
   */
  applyOffline(): void {
    const elapsed = Date.now() - this.state.lastSaved;
    if (elapsed < 60_000) return; // moins d'une minute : rien à faire
    const ms = Math.min(elapsed, OFFLINE_CAP_HOURS * 3_600_000);
    const gain = Math.max(0, estimateNetPerSec(this.state) * (ms / 1000) * OFFLINE_EFFICIENCY);
    if (gain > 0) {
      this.state.money = this.state.money.add(gain);
      this.state.park.incomeToday = this.state.park.incomeToday.add(gain);
    }
    this.offlineReport = { ms, gain: Math.round(gain) };
    bumpStore();
  }

  // ---- Personnel (employés) ----------------------------------------------

  /** Embauche un employé (soigneur ou agent d'entretien). */
  hireEmployee(role: StaffRole): boolean {
    const cost = D(STAFF_HIRE_COST[role] ?? 500);
    if (this.state.money.lt(cost)) return false;
    this.state.money = this.state.money.sub(cost);
    this.state.staff.employees.push({ id: nextId('emp'), role, tankId: null });
    this.staff.sync();
    this.events.emit('staffChanged', undefined);
    bumpStore();
    return true;
  }

  /** Renvoie un employé. */
  fireEmployee(empId: string): void {
    const i = this.state.staff.employees.findIndex((e) => e.id === empId);
    if (i < 0) return;
    this.state.staff.employees.splice(i, 1);
    this.staff.sync();
    this.events.emit('staffChanged', undefined);
    bumpStore();
  }

  /** Affecte (ou libère) un soigneur à un bac précis. */
  assignKeeper(empId: string, tankId: string | null): void {
    const e = this.state.staff.employees.find((x) => x.id === empId);
    if (!e || e.role !== 'keeper') return;
    e.tankId = tankId;
    this.staff.sync();
    bumpStore();
  }

  employeesByRole(role: StaffRole): Employee[] {
    return this.state.staff.employees.filter((e) => e.role === role);
  }

  /** Action manuelle : nourrir / nettoyer un bac immédiatement. */
  feedTank(buildingId: string): void {
    const b = this.state.buildings.find((x) => x.id === buildingId);
    if (b?.tank) { b.tank.water.foodStock = 1; bumpStore(); }
  }
  cleanTank(buildingId: string): void {
    const b = this.state.buildings.find((x) => x.id === buildingId);
    if (b?.tank) { b.tank.water.quality = 1; bumpStore(); }
  }

  // ---- Bien-être / habitat (M7) ------------------------------------------

  /** Un Laboratoire (R&D filtration) est-il construit ? Boost global de bien-être. */
  get hasLab(): boolean {
    return this.state.buildings.some((b) => b.type === 'research');
  }

  /** Rapport de bien-être d'un bac (avec le bonus Laboratoire éventuel). */
  tankWelfare(tank: TankState): WelfareReport {
    return computeWelfare(tank, this.hasLab ? 1 : 0);
  }

  /** Règle la température d'un bac (levier de bien-être). */
  setTankTemp(buildingId: string, temp: number): void {
    const b = this.state.buildings.find((x) => x.id === buildingId);
    if (b?.tank) { b.tank.waterTemp = Math.max(0, Math.min(32, Math.round(temp))); bumpStore(); }
  }

  /** Règle le pH d'un bac (levier de bien-être, échelle 5..9). */
  setTankPh(buildingId: string, ph: number): void {
    const b = this.state.buildings.find((x) => x.id === buildingId);
    if (b?.tank) { b.tank.ph = Math.max(5, Math.min(9, Math.round(ph * 10) / 10)); bumpStore(); }
  }

  /** Règle la salinité d'un bac (ppt, 0..40). */
  setTankSalinity(buildingId: string, salinity: number): void {
    const b = this.state.buildings.find((x) => x.id === buildingId);
    if (b?.tank) { b.tank.salinity = Math.max(0, Math.min(40, Math.round(salinity))); bumpStore(); }
  }

  readonly enrichCost = 120;

  /** Enrichit / décore l'intérieur d'un bac (coût en argent → +bien-être). */
  enrichTank(buildingId: string): boolean {
    const b = this.state.buildings.find((x) => x.id === buildingId);
    if (!b?.tank) return false;
    if (this.state.money.lt(this.enrichCost)) return false;
    this.state.money = this.state.money.sub(this.enrichCost);
    b.tank.enrichment = Math.min(1, b.tank.enrichment + 0.35);
    this.events.emit('tankUpdated', { buildingId });
    bumpStore();
    return true;
  }

  /** Installe un équipement dans un bac (coût unique ; entretien/jour ensuite). */
  installEquipment(buildingId: string, equipId: string): boolean {
    const b = this.state.buildings.find((x) => x.id === buildingId);
    const def = EQUIPMENT[equipId];
    if (!b?.tank || !def) return false;
    if (!this.equipmentUnlocked(equipId)) return false; // niveau de parc insuffisant
    if (b.tank.equipment.includes(equipId)) return false;
    if (this.state.money.lt(def.cost)) return false;
    this.state.money = this.state.money.sub(def.cost);
    b.tank.equipment.push(equipId);
    this.notify(`${def.icon} ${def.name} installé`, 'good');
    this.events.emit('tankUpdated', { buildingId });
    bumpStore();
    return true;
  }

  /** Retire un équipement d'un bac (pas de remboursement). */
  removeEquipment(buildingId: string, equipId: string): void {
    const b = this.state.buildings.find((x) => x.id === buildingId);
    if (!b?.tank) return;
    b.tank.equipment = b.tank.equipment.filter((e) => e !== equipId);
    this.events.emit('tankUpdated', { buildingId });
    bumpStore();
  }

  readonly maxTankDecor = 6;

  /** Place un décor 3D à l'intérieur d'un bac (coût → +enrichissement visible). */
  addTankDecor(buildingId: string, decorId: string): boolean {
    const b = this.state.buildings.find((x) => x.id === buildingId);
    const def = TANK_DECOR[decorId];
    if (!b?.tank || !def) return false;
    if (b.tank.decor.length >= this.maxTankDecor) return false;
    if (this.state.money.lt(def.cost)) return false;
    this.state.money = this.state.money.sub(def.cost);
    b.tank.decor.push(decorId);
    b.tank.enrichment = Math.min(1, b.tank.enrichment + def.enrich);
    this.events.emit('tankUpdated', { buildingId });
    bumpStore();
    return true;
  }

  /** Retire le dernier décor posé d'un bac (pas de remboursement). */
  removeTankDecor(buildingId: string): void {
    const b = this.state.buildings.find((x) => x.id === buildingId);
    if (!b?.tank || b.tank.decor.length === 0) return;
    b.tank.decor.pop();
    this.events.emit('tankUpdated', { buildingId });
    bumpStore();
  }

  /** Simulation foule (appelée à la fréquence du rendu). */
  simulateAgents(dt: number): void {
    const p = this.state.park;
    // Rampe douce de popularité (montée progressive à l'ouverture, descente fermé).
    const target = p.isOpen ? targetDraw(this.state) : 0;
    p.popularity += (target - p.popularity) * POPULARITY_RAMP * dt;

    if (p.isOpen) {
      const cap = maxConcurrent(this.state);
      this.spawnAcc += spawnRatePerSec(this.state) * dt;
      while (this.spawnAcc >= 1) {
        this.spawnAcc -= 1;
        if (this.agents.spawnReady && this.agents.count < cap) {
          const before = this.agents.count;
          this.agents.spawn();
          if (this.agents.count > before) addIncome(this.state, D(p.ticketPrice), 'tickets'); // billet
        }
      }
    } else {
      this.spawnAcc = 0;
    }

    // Les déchets dégradent l'ambiance (satisfaction des visiteurs) — effet doux.
    this.agents.setAmbientPenalty(Math.min(0.12, this.litter.length * 0.004));
    this.agents.update(dt);
    this.staff.update(dt);
    // Synchros exactes pour l'UI.
    p.guestsInPark = this.agents.count;
    p.avgSatisfaction = this.agents.meanSatisfaction();
  }

  // ---- Progression (Niveau de Parc — gating) -----------------------------

  /** Niveau de Parc dérivé de l'exploitation (visiteurs servis + bâtiments + attrait). */
  parkLevel(): number {
    const s = this.state;
    const xp = s.stats.guestsServed + s.buildings.length * 3 + Math.round(s.park.appeal);
    return Math.floor(1 + Math.log2(1 + xp / 20));
  }

  /** Une rareté est accessible si la recherche correspondante est débloquée. */
  rarityUnlocked(rarity: Rarity): boolean {
    if (this.state.mode === 'sandbox') return true;
    const req = RARITY_RESEARCH[rarity];
    if (!req) return true; // Commune : toujours disponible
    return this.state.unlockedResearch.includes(req);
  }

  // ---- Recherche (payer + temps + prérequis ; débloque raretés & équipements) --

  /** Nombre de Laboratoires construits (accélère la recherche). */
  get labCount(): number {
    return this.state.buildings.filter((b) => b.type === 'research').length;
  }

  researchUnlocks() {
    return RESEARCH;
  }

  researchUnlocked(id: string): boolean {
    return this.state.unlockedResearch.includes(id);
  }

  /** Disponible au lancement : labo présent, pas déjà faite, prérequis ok, aucune en cours. */
  researchAvailable(id: string): boolean {
    const u = RESEARCH_BY_ID[id];
    if (!u || this.researchUnlocked(id) || this.state.activeResearch) return false;
    if (this.labCount === 0) return false;
    return !u.requires || this.researchUnlocked(u.requires);
  }

  /** Progression (0..1) de la recherche en cours. */
  researchProgress(): number {
    const a = this.state.activeResearch;
    if (!a) return 0;
    const u = RESEARCH_BY_ID[a.id];
    return u ? 1 - a.remainingMs / u.durationMs : 0;
  }

  /** Lance une recherche : paie le coût, démarre le décompte (temps de jeu). */
  startResearch(id: string): boolean {
    const u = RESEARCH_BY_ID[id];
    if (!u || !this.researchAvailable(id)) return false;
    if (this.state.money.lt(u.cost)) return false;
    this.state.money = this.state.money.sub(u.cost);
    this.state.activeResearch = { id, remainingMs: u.durationMs };
    this.notify(`🔬 Recherche lancée : ${u.label}`, 'good');
    bumpStore();
    return true;
  }

  /** Fait avancer la recherche en cours (temps de jeu, accéléré par les labos). */
  private researchTick(dt: number): void {
    const a = this.state.activeResearch;
    if (!a) return;
    a.remainingMs -= dt * 1000 * Math.max(1, this.labCount);
    if (a.remainingMs <= 0) {
      this.state.unlockedResearch.push(a.id);
      this.state.activeResearch = null;
      this.notify(`✅ Recherche terminée : ${RESEARCH_BY_ID[a.id]?.label ?? a.id}`, 'good');
    }
  }

  // ---- Progression : déblocage des biomes & équipements (mode Histoire) ----

  biomeMinLevel(biome: BiomeId): number {
    return BIOME_MIN_LEVEL[biome] ?? 1;
  }

  /** Biome accessible ? Sandbox → toujours ; Histoire → selon le Niveau de Parc. */
  biomeUnlocked(biome: BiomeId): boolean {
    if (this.state.mode === 'sandbox') return true;
    return this.parkLevel() >= this.biomeMinLevel(biome);
  }

  /** Équipement débloqué par la recherche (sandbox = tout). */
  equipmentUnlocked(equipId: string): boolean {
    if (this.state.mode === 'sandbox') return true;
    const r = EQUIPMENT_RESEARCH[equipId];
    return !r || this.state.unlockedResearch.includes(r);
  }

  /** Niveau requis pour construire un bâtiment (biome verrouillé), 0 si libre. */
  buildLockLevel(type: BuildingType): number {
    const def = BUILDINGS[type];
    if (def.render.kind === 'tank' && !this.biomeUnlocked(def.render.biome)) {
      return this.biomeMinLevel(def.render.biome);
    }
    return 0;
  }

  // ---- Campagne (mode Histoire) ------------------------------------------

  /** La quête active, ou `null` si campagne terminée / mode bac à sable. */
  get currentQuest() {
    if (this.state.mode !== 'story') return null;
    return QUESTS[this.state.questIndex] ?? null;
  }

  /** Valide la/les quête(s) accomplie(s), verse les récompenses, avance la chaîne. */
  private checkQuests(): void {
    if (this.state.mode !== 'story') return;
    let advanced = false;
    // Plusieurs quêtes peuvent se valider d'un coup (progression rapide).
    while (this.state.questIndex < QUESTS.length) {
      const q = QUESTS[this.state.questIndex];
      if (!q.check(this)) break;
      const r = q.reward;
      if (r.money) this.state.money = this.state.money.add(r.money);
      if (r.bait) this.state.bait += r.bait;
      this.state.questIndex += 1;
      advanced = true;
      const parts: string[] = [];
      if (r.money) parts.push(`+${r.money} $`);
      if (r.bait) parts.push(`+${r.bait} appâts`);
      this.notify(`✅ Quête : ${q.title}${parts.length ? ` (${parts.join(', ')})` : ''}`, 'good');
    }
    if (advanced) {
      this.events.emit('questChanged', undefined);
      if (this.state.questIndex >= QUESTS.length) {
        this.notify('🏆 Campagne terminée — votre parc est une légende !', 'good');
      }
    }
  }

  // ---- Génétique / Reproduction (Nursery) --------------------------------

  /** A-t-on au moins une Nursery construite ? */
  get hasNursery(): boolean {
    return this.state.buildings.some((b) => b.type === 'nursery');
  }

  /** Tous les poissons fertiles disponibles (inventaire + bacs) par espèce. */
  private fertilePool(): Map<string, Fish[]> {
    const m = new Map<string, Fish[]>();
    const add = (f: Fish) => {
      if (!f.fertile) return;
      const arr = m.get(f.species);
      if (arr) arr.push(f);
      else m.set(f.species, [f]);
    };
    for (const f of this.state.caughtInventory) add(f);
    for (const b of this.state.buildings) if (b.tank) for (const f of b.tank.fish) add(f);
    return m;
  }

  /** Espèces reproductibles (≥2 fertiles, inventaire OU bacs confondus). */
  breedableSpecies(): string[] {
    return [...this.fertilePool().entries()].filter(([, a]) => a.length >= 2).map(([s]) => s);
  }

  /** Croise 2 poissons fertiles d'une espèce (Nursery requise) → un ŒUF en incubation. */
  breed(speciesId: string): { inbred: boolean } | null {
    if (!this.hasNursery) return null;
    const pool = this.fertilePool().get(speciesId);
    if (!pool || pool.length < 2) return null;
    const sp = getFish(speciesId);
    const { child, inbred } = breedFish(pool[0], pool[1]);
    // Chance (selon la rareté) que le petit hérite de gènes améliorés.
    const boosted = Math.random() < (sp ? BREED_BOOST_CHANCE[sp.rarity] : 0.2);
    if (boosted) {
      const g = child.genes;
      g.size = Math.min(1.9, g.size * 1.18);
      g.longevity = Math.min(1.7, g.longevity * 1.15);
      g.immunity = Math.min(1.6, g.immunity * 1.15);
    }
    const total = sp ? BREED_DURATION_MS[sp.rarity] : 60_000;
    this.state.eggs.push({ id: nextId('egg'), species: speciesId, remainingMs: total, totalMs: total, child, boosted });
    this.notify('🥚 Œuf en incubation à la Nursery…', 'good');
    bumpStore();
    return { inbred };
  }

  /** Fait avancer l'incubation des œufs (appelé au tick) ; éclôt à 0. */
  private incubateEggs(): void {
    for (let i = this.state.eggs.length - 1; i >= 0; i--) {
      const egg = this.state.eggs[i];
      egg.remainingMs -= 1000;
      if (egg.remainingMs <= 0) {
        this.state.caughtInventory.push(egg.child);
        this.state.eggs.splice(i, 1);
        this.events.emit('fishCaught', { speciesId: egg.species });
        this.notify(
          `🐣 Éclosion : ${getFish(egg.species)?.name ?? egg.species}${egg.boosted ? ' — gènes supérieurs !' : ''}`,
          'good',
        );
      }
    }
  }

  /** Valeur de vente d'un poisson de l'inventaire (revenu de base × rareté). */
  private fishSaleValue(f: Fish): number {
    const sp = getFish(f.species);
    if (!sp) return 10;
    const base = { common: 15, rare: 60, epic: 300, legendary: 1200, mythic: 6000 } as Record<string, number>;
    return Math.round((base[sp.rarity] ?? 15) * f.genes.size * f.vitals.health);
  }

  /** Vend un poisson de l'inventaire contre de l'argent (surplus de stock). */
  sellFish(speciesId: string): number {
    const inv = this.state.caughtInventory;
    const i = inv.findIndex((f) => f.species === speciesId);
    if (i < 0) return 0;
    const value = this.fishSaleValue(inv[i]);
    inv.splice(i, 1);
    this.state.money = this.state.money.add(value);
    this.notify(`💰 Poisson vendu : +${value} $`, 'good');
    bumpStore();
    return value;
  }

  // ---- Connexion au réseau (alerte « bâtiment non relié ») ----------------

  /** Le bâtiment est-il relié au réseau de chemins partant de l'entrée ? */
  isBuildingConnected(buildingId: string): boolean {
    const b = this.state.buildings.find((x) => x.id === buildingId);
    if (!b || b.type === 'entrance' || isPathType(b.type)) return true;
    return this.agents.buildingReachable(b);
  }
}
