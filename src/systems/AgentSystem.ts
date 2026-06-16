import { GridManager, Tile } from '../world/Grid';
import { DX, DY, FlowField } from '../world/Pathfinding';
import { BUILDINGS, FOOD_TYPES } from '../data/buildings';
import { buildingAppeal } from '../core/ParkEconomy';
import { getFish } from '../data/fish';
import { Rarity } from '../data/types';
import type { PlacedBuilding } from '../core/GameState';

enum S {
  Wander = 0,
  Observe = 1,
  ToFood = 2,
  Eat = 3,
  Leave = 4,
  ToToilet = 5,
  Toilet = 6,
}

const SPEED = 2.2;
const HUNGER_RATE = 0.03;
const HUNGER_THRESHOLD = 0.7;
const THIRST_RATE = 0.035;
const THIRST_THRESHOLD = 0.7;
const BLADDER_RATE = 0.028;
const BLADDER_THRESHOLD = 0.75;
const OBSERVE_TIME = 3;
const EAT_TIME = 2.5;
const TOILET_TIME = 2;
const OBSERVE_CHANCE = 0.55;
const SEP_RADIUS = 0.75; // rayon de séparation (steering)
const SEP_FORCE = 1.1;
const THOUGHT_CHANCE = 0.3; // proba d'émettre une pensée sur un événement

export interface AgentCallbacks {
  onDonate: (appeal: number) => void;
  onEat: (shop: PlacedBuilding) => void;
  onLeave: () => void;
  onThought: (text: string) => void;
  onLitter: (x: number, z: number) => void;
}

/**
 * Foule de visiteurs — SoA, machine d'états + besoins, déplacement par flow
 * fields, séparation (steering) anti-clipping, satisfaction & pensées
 * individuelles. Aucune dépendance React/Three.
 */
export class AgentSystem {
  readonly cap: number;
  readonly active: Uint8Array;
  readonly px: Float32Array;
  readonly pz: Float32Array;
  readonly hx: Float32Array;
  readonly hz: Float32Array;
  readonly moving: Uint8Array; // 1 si en mouvement (pour l'animation de marche)
  private readonly cx: Int32Array;
  private readonly cy: Int32Array;
  private readonly nx: Int32Array;
  private readonly ny: Int32Array;
  private readonly adv: Uint8Array;
  private readonly lastDir: Int8Array; // dernière direction prise (errance sans demi-tour)
  private readonly st: Uint8Array;
  private readonly hunger: Float32Array;
  private readonly thirst: Float32Array;
  private readonly bladder: Float32Array;
  private readonly timer: Float32Array;
  private readonly life: Float32Array;
  private readonly maxDuration: Float32Array;
  private readonly venuesSeen: Int32Array;
  private readonly venuesGoal: Int32Array;
  private readonly satisfaction: Float32Array;

  private readonly attractions: FlowField;
  private readonly food: FlowField;
  private readonly restroom: FlowField;
  private readonly exit: FlowField;
  private spawnCells: number[] = [];
  /** Malus de satisfaction ambiant (déchets) appliqué à chaque visiteur. */
  private ambientPenalty = 0;

  constructor(
    private readonly grid: GridManager,
    private readonly getBuildings: () => PlacedBuilding[],
    private readonly cb: AgentCallbacks,
    cap = 300,
  ) {
    this.cap = cap;
    const f32 = () => new Float32Array(cap);
    const i32 = () => new Int32Array(cap);
    const u8 = () => new Uint8Array(cap);
    this.active = u8();
    this.px = f32(); this.pz = f32(); this.hx = f32(); this.hz = f32();
    this.moving = u8();
    this.cx = i32(); this.cy = i32(); this.nx = i32(); this.ny = i32();
    this.adv = u8(); this.st = u8();
    this.lastDir = new Int8Array(cap).fill(-1);
    this.hunger = f32(); this.thirst = f32(); this.bladder = f32();
    this.timer = f32(); this.life = f32();
    this.maxDuration = f32(); this.venuesSeen = i32(); this.venuesGoal = i32();
    this.satisfaction = f32();
    const { w, h } = grid;
    this.attractions = new FlowField(w, h);
    this.food = new FlowField(w, h);
    this.restroom = new FlowField(w, h);
    this.exit = new FlowField(w, h);
  }

  recompute(): void {
    const buildings = this.getBuildings();
    const tankGoals: number[] = [];
    const foodGoals: number[] = [];
    const restroomGoals: number[] = [];
    const exitGoals: number[] = [];
    this.spawnCells = [];
    for (const b of buildings) {
      const def = BUILDINGS[b.type];
      const adj = this.pathNeighbors(b.gx, b.gy, def.w, def.h);
      if (b.tank) tankGoals.push(...adj);
      else if (FOOD_TYPES.includes(b.type)) foodGoals.push(...adj);
      else if (b.type === 'restroom') restroomGoals.push(...adj);
      if (b.type === 'entrance') {
        exitGoals.push(...adj);
        this.spawnCells.push(...adj);
      }
    }
    this.attractions.compute(this.grid, tankGoals);
    this.food.compute(this.grid, foodGoals);
    this.restroom.compute(this.grid, restroomGoals);
    this.exit.compute(this.grid, exitGoals);
  }

  /** Cases `Path` ORTHOGONALEMENT adjacentes à l'emprise (pas les diagonales). */
  private pathNeighbors(gx: number, gy: number, w: number, h: number): number[] {
    const out: number[] = [];
    const g = this.grid;
    for (let dy = 0; dy < h; dy++) {
      if (g.isPath(gx - 1, gy + dy)) out.push(g.idx(gx - 1, gy + dy));
      if (g.isPath(gx + w, gy + dy)) out.push(g.idx(gx + w, gy + dy));
    }
    for (let dx = 0; dx < w; dx++) {
      if (g.isPath(gx + dx, gy - 1)) out.push(g.idx(gx + dx, gy - 1));
      if (g.isPath(gx + dx, gy + h)) out.push(g.idx(gx + dx, gy + h));
    }
    return out;
  }

  get spawnReady(): boolean {
    return this.spawnCells.length > 0;
  }

  /** Définit le malus de satisfaction dû aux déchets (proportionnel à leur nombre). */
  setAmbientPenalty(p: number): void {
    this.ambientPenalty = p;
  }

  /** Le bâtiment a-t-il une case de chemin adjacente reliée à l'entrée ? */
  buildingReachable(b: PlacedBuilding): boolean {
    const def = BUILDINGS[b.type];
    const neigh = this.pathNeighbors(b.gx, b.gy, def.w, def.h);
    return neigh.some((c) => this.exit.reachable(c));
  }

  spawn(): void {
    if (this.spawnCells.length === 0) return;
    let i = -1;
    for (let k = 0; k < this.cap; k++) if (this.active[k] === 0) { i = k; break; }
    if (i < 0) return;

    const cell = this.spawnCells[(Math.random() * this.spawnCells.length) | 0];
    const cx = cell % this.grid.w;
    const cy = (cell / this.grid.w) | 0;
    const w = this.grid.gridToWorld(cx, cy);
    this.active[i] = 1;
    this.cx[i] = cx; this.cy[i] = cy; this.adv[i] = 0; this.st[i] = S.Wander;
    this.hunger[i] = Math.random() * 0.25;
    this.thirst[i] = Math.random() * 0.25;
    this.bladder[i] = Math.random() * 0.2;
    this.timer[i] = 0; this.life[i] = 0;
    this.lastDir[i] = -1;
    this.maxDuration[i] = 80 + Math.random() * 80; // 80–160 s (le temps d'explorer)
    this.venuesSeen[i] = 0;
    this.venuesGoal[i] = 4 + ((Math.random() * 6) | 0); // 4–9 bacs
    this.satisfaction[i] = 0.5;
    this.px[i] = w.x + (Math.random() - 0.5) * 0.4;
    this.pz[i] = w.z + (Math.random() - 0.5) * 0.4;
  }

  private fieldFor(state: number): FlowField {
    if (state === S.ToFood) return this.food;
    if (state === S.ToToilet) return this.restroom;
    if (state === S.Leave) return this.exit;
    return this.attractions;
  }

  private adjacent(cx: number, cy: number, want: 'tank' | 'food' | 'toilet'): { idx: number; b: PlacedBuilding } | null {
    const g = this.grid;
    const buildings = this.getBuildings();
    for (let k = 0; k < 4; k++) {
      const x = cx + DX[k];
      const y = cy + DY[k];
      if (!g.inBounds(x, y) || g.tile[g.idx(x, y)] !== Tile.Building) continue;
      const b = buildings[g.occupant[g.idx(x, y)]];
      if (!b) continue;
      if (want === 'tank' && b.tank) return { idx: g.occupant[g.idx(x, y)], b };
      if (want === 'food' && FOOD_TYPES.includes(b.type)) return { idx: g.occupant[g.idx(x, y)], b };
      if (want === 'toilet' && b.type === 'restroom') return { idx: g.occupant[g.idx(x, y)], b };
    }
    return null;
  }

  /** Pas d'errance exploratoire : avance sans demi-tour si possible (répartit la foule). */
  private wanderStep(i: number): number {
    const cx = this.cx[i];
    const cy = this.cy[i];
    const opts: number[] = [];
    for (let k = 0; k < 4; k++) if (this.grid.isPath(cx + DX[k], cy + DY[k])) opts.push(k);
    if (opts.length === 0) return -1;
    const back = this.lastDir[i] >= 0 ? this.lastDir[i] ^ 1 : -1;
    const fwd = opts.filter((k) => k !== back);
    const pool = fwd.length > 0 ? fwd : opts; // demi-tour autorisé seulement en cul-de-sac
    return pool[(Math.random() * pool.length) | 0];
  }

  private think(text: string): void {
    if (Math.random() < THOUGHT_CHANCE) this.cb.onThought(text);
  }

  private adjust(i: number, delta: number): void {
    this.satisfaction[i] = Math.max(0, Math.min(1, this.satisfaction[i] + delta));
  }

  update(dt: number): void {
    const W = this.grid.w;
    for (let i = 0; i < this.cap; i++) {
      if (this.active[i] === 0) continue;
      this.hunger[i] += dt * HUNGER_RATE;
      this.thirst[i] += dt * THIRST_RATE;
      this.bladder[i] += dt * BLADDER_RATE;
      this.life[i] += dt;
      this.moving[i] = 0;
      if (this.ambientPenalty > 0) this.adjust(i, -this.ambientPenalty * dt); // déchets → mécontentement

      if (this.st[i] === S.Observe || this.st[i] === S.Eat || this.st[i] === S.Toilet) {
        this.timer[i] -= dt;
        if (this.timer[i] <= 0) {
          // En finissant de manger, un visiteur peut jeter un déchet.
          if (this.st[i] === S.Eat && Math.random() < 0.5) this.cb.onLitter(this.px[i], this.pz[i]);
          this.st[i] = S.Wander;
        }
        continue;
      }

      if (this.adv[i] === 0) {
        if (this.arrival(i)) continue;
        const ci = this.cy[i] * W + this.cx[i];
        // Wander = errance exploratoire (répartit la foule dans tout le parc) ;
        // les autres états suivent leur flow-field dédié.
        let d = this.st[i] === S.Wander ? this.wanderStep(i) : this.fieldFor(this.st[i]).step(ci);
        if (d < 0) {
          if (this.st[i] === S.Leave) { this.despawn(i); continue; }
          if (this.st[i] === S.ToFood) {
            this.adjust(i, -0.2);
            this.think('Il n’y a aucun stand de nourriture ?!');
          }
          if (this.st[i] === S.ToToilet) {
            // Aucune toilette accessible : frustration, mais on ne quitte pas pour autant.
            this.adjust(i, -0.18);
            this.think('Où sont les toilettes ?!');
            this.bladder[i] = 0.3;
            this.st[i] = S.Wander;
            continue;
          }
          this.st[i] = S.Leave;
          continue;
        }
        this.nx[i] = this.cx[i] + DX[d];
        this.ny[i] = this.cy[i] + DY[d];
        this.lastDir[i] = d;
        this.adv[i] = 1;
      }

      const target = this.grid.gridToWorld(this.nx[i], this.ny[i]);
      let dxp = target.x - this.px[i];
      let dzp = target.z - this.pz[i];
      const dist = Math.hypot(dxp, dzp) || 1;
      const stepLen = SPEED * dt;
      if (dist <= stepLen) {
        this.px[i] = target.x; this.pz[i] = target.z;
        this.cx[i] = this.nx[i]; this.cy[i] = this.ny[i];
        this.adv[i] = 0;
      } else {
        dxp /= dist; dzp /= dist;
        this.px[i] += dxp * stepLen;
        this.pz[i] += dzp * stepLen;
        this.hx[i] = dxp; this.hz[i] = dzp;
        this.moving[i] = 1;
      }
    }

    this.separate(dt);
  }

  /** Logique à l'arrivée sur un centre de case. Retourne true si l'agent ne bouge plus ce tick. */
  private arrival(i: number): boolean {
    const cx = this.cx[i];
    const cy = this.cy[i];

    if (this.st[i] === S.Leave) {
      if (this.spawnCells.includes(cy * this.grid.w + cx)) { this.despawn(i); return true; }
      return false;
    }

    if (this.st[i] === S.ToFood) {
      const f = this.adjacent(cx, cy, 'food');
      if (f) {
        // Au stand : on mange ET on boit (étanche la faim et la soif).
        this.st[i] = S.Eat; this.timer[i] = EAT_TIME; this.hunger[i] = 0; this.thirst[i] = 0;
        this.adjust(i, 0.08);
        this.cb.onEat(f.b);
        return true;
      }
      return false;
    }

    if (this.st[i] === S.ToToilet) {
      const t = this.adjacent(cx, cy, 'toilet');
      if (t) {
        this.st[i] = S.Toilet; this.timer[i] = TOILET_TIME; this.bladder[i] = 0;
        this.adjust(i, 0.05);
        return true;
      }
      return false;
    }

    // Wander : partir si assez vu / trop longtemps ; sinon gérer les besoins, puis observer.
    if (this.venuesSeen[i] >= this.venuesGoal[i] || this.life[i] > this.maxDuration[i]) {
      if (this.satisfaction[i] > 0.6) this.think('Quelle belle visite !');
      this.st[i] = S.Leave;
      return false;
    }
    // Besoins : on part vers l'installation SANS « annoncer » (pas de fausse plainte
    // s'il y a bien des stands/toilettes — la plainte n'arrive que si rien n'est accessible).
    if (this.bladder[i] > BLADDER_THRESHOLD) {
      this.st[i] = S.ToToilet;
      return false;
    }
    if (this.hunger[i] > HUNGER_THRESHOLD || this.thirst[i] > THIRST_THRESHOLD) {
      this.st[i] = S.ToFood;
      return false;
    }
    const t = this.adjacent(cx, cy, 'tank');
    if (t && Math.random() < OBSERVE_CHANCE) {
      this.st[i] = S.Observe;
      this.timer[i] = OBSERVE_TIME;
      this.venuesSeen[i] += 1;
      const impressive = this.observeReaction(t.b);
      this.cb.onDonate(buildingAppeal(t.b));
      this.adjust(i, impressive ? 0.18 : 0.06);
      return true;
    }
    return false;
  }

  /** Réaction à l'observation d'un bac : pensée + true si "impressionnant". */
  private observeReaction(b: PlacedBuilding): boolean {
    if (!b.tank || b.tank.fish.length === 0) {
      this.think('Ce bac est vide…');
      return false;
    }
    // Cherche le poisson le plus rare du bac.
    let best = b.tank.fish[0];
    let bestRank = -1;
    for (const f of b.tank.fish) {
      const rank = rarityRank(getFish(f.species)?.rarity);
      if (rank > bestRank) { bestRank = rank; best = f; }
    }
    const sp = getFish(best.species);
    const impressive = bestRank >= rarityRank(Rarity.Epic);
    if (impressive && sp) this.think(`Le ${sp.name} est incroyable !`);
    return impressive;
  }

  /** Séparation (steering) : repousse les voisins proches → évite le clipping. */
  private separate(dt: number): void {
    const W = this.grid.w;
    const buckets = new Map<number, number[]>();
    for (let i = 0; i < this.cap; i++) {
      if (this.active[i] === 0) continue;
      const c = this.cy[i] * W + this.cx[i];
      const arr = buckets.get(c);
      if (arr) arr.push(i);
      else buckets.set(c, [i]);
    }

    const r2 = SEP_RADIUS * SEP_RADIUS;
    for (let i = 0; i < this.cap; i++) {
      if (this.active[i] === 0) continue;
      let sx = 0; let sz = 0; let neighbours = 0;
      const c = this.cy[i] * W + this.cx[i];
      for (const oc of [c, c - 1, c + 1, c - W, c + W]) {
        const list = buckets.get(oc);
        if (!list) continue;
        for (const j of list) {
          if (j === i) continue;
          const dx = this.px[i] - this.px[j];
          const dz = this.pz[i] - this.pz[j];
          const d2 = dx * dx + dz * dz;
          if (d2 < r2 && d2 > 1e-4) {
            const d = Math.sqrt(d2);
            const w = (SEP_RADIUS - d) / SEP_RADIUS;
            sx += (dx / d) * w; sz += (dz / d) * w;
            neighbours++;
          }
        }
      }
      if (neighbours > 0) {
        this.px[i] += sx * SEP_FORCE * dt;
        this.pz[i] += sz * SEP_FORCE * dt;
      }
      // Foule oppressante → insatisfaction + pensée occasionnelle.
      if (neighbours >= 4) {
        this.adjust(i, -0.04 * dt);
        if (Math.random() < 0.004) this.cb.onThought('Il y a trop de monde ici !');
      }
    }
  }

  private despawn(i: number): void {
    this.active[i] = 0;
    this.cb.onLeave();
  }

  meanSatisfaction(): number {
    let sum = 0;
    let n = 0;
    for (let i = 0; i < this.cap; i++) if (this.active[i]) { sum += this.satisfaction[i]; n++; }
    return n === 0 ? 1 : sum / n;
  }

  get count(): number {
    let c = 0;
    for (let i = 0; i < this.cap; i++) c += this.active[i];
    return c;
  }
}

function rarityRank(r: Rarity | undefined): number {
  switch (r) {
    case Rarity.Mythic: return 4;
    case Rarity.Legendary: return 3;
    case Rarity.Epic: return 2;
    case Rarity.Rare: return 1;
    case Rarity.Common: return 0;
    default: return -1;
  }
}
