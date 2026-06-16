import { GridManager, Tile } from '../world/Grid';
import { DX, DY, FlowField } from '../world/Pathfinding';
import { BUILDINGS, FOOD_TYPES } from '../data/buildings';
import { buildingAppeal } from '../core/ParkEconomy';
import type { PlacedBuilding } from '../core/GameState';

enum S {
  Wander = 0,
  Observe = 1,
  ToFood = 2,
  Eat = 3,
  Leave = 4,
}

const SPEED = 2.4; // unités monde / s
const HUNGER_RATE = 0.05; // /s
const HUNGER_THRESHOLD = 0.7;
const OBSERVE_TIME = 3;
const EAT_TIME = 2.5;
const MAX_LIFE = 80; // s avant de partir
const OBSERVE_CHANCE = 0.55;

export interface AgentCallbacks {
  onDonate: (appeal: number) => void;
  onEat: (price: number) => void;
  onLeave: (satisfaction: number) => void;
}

/**
 * Foule de visiteurs — Structure-of-Arrays (centaines d'agents sans GC).
 * Déplacement par flow fields (O(1)/agent), machine d'états avec besoins.
 * Aucune dépendance React/Three : pure simulation, lue par l'AgentRenderer.
 */
export class AgentSystem {
  readonly cap: number;
  readonly active: Uint8Array;
  readonly px: Float32Array;
  readonly pz: Float32Array;
  readonly hx: Float32Array; // heading
  readonly hz: Float32Array;
  private readonly cx: Int32Array;
  private readonly cy: Int32Array;
  private readonly nx: Int32Array;
  private readonly ny: Int32Array;
  private readonly adv: Uint8Array;
  private readonly st: Uint8Array;
  private readonly hunger: Float32Array;
  private readonly timer: Float32Array;
  private readonly life: Float32Array;
  private readonly happy: Float32Array;

  private readonly attractions: FlowField;
  private readonly food: FlowField;
  private readonly exit: FlowField;
  private spawnCells: number[] = [];

  constructor(
    private readonly grid: GridManager,
    private readonly getBuildings: () => PlacedBuilding[],
    private readonly cb: AgentCallbacks,
    cap = 300,
  ) {
    this.cap = cap;
    this.active = new Uint8Array(cap);
    this.px = new Float32Array(cap);
    this.pz = new Float32Array(cap);
    this.hx = new Float32Array(cap);
    this.hz = new Float32Array(cap);
    this.cx = new Int32Array(cap);
    this.cy = new Int32Array(cap);
    this.nx = new Int32Array(cap);
    this.ny = new Int32Array(cap);
    this.adv = new Uint8Array(cap);
    this.st = new Uint8Array(cap);
    this.hunger = new Float32Array(cap);
    this.timer = new Float32Array(cap);
    this.life = new Float32Array(cap);
    this.happy = new Float32Array(cap);
    const { w, h } = grid;
    this.attractions = new FlowField(w, h);
    this.food = new FlowField(w, h);
    this.exit = new FlowField(w, h);
  }

  /** Recalcule les flow fields + le point d'apparition (après tout édit de grille). */
  recompute(): void {
    const buildings = this.getBuildings();
    const tankGoals: number[] = [];
    const foodGoals: number[] = [];
    const exitGoals: number[] = [];
    this.spawnCells = [];

    for (const b of buildings) {
      const def = BUILDINGS[b.type];
      const adj = this.pathNeighbors(b.gx, b.gy, def.w, def.h);
      if (b.tank) tankGoals.push(...adj);
      else if (FOOD_TYPES.includes(b.type)) foodGoals.push(...adj);
      if (b.type === 'entrance') {
        exitGoals.push(...adj);
        this.spawnCells.push(...adj);
      }
    }

    this.attractions.compute(this.grid, tankGoals);
    this.food.compute(this.grid, foodGoals);
    this.exit.compute(this.grid, exitGoals);
  }

  /** Cases `Path` adjacentes à une emprise. */
  private pathNeighbors(gx: number, gy: number, w: number, h: number): number[] {
    const out: number[] = [];
    const g = this.grid;
    for (let dy = -1; dy <= h; dy++)
      for (let dx = -1; dx <= w; dx++) {
        const onBorder = dx === -1 || dy === -1 || dx === w || dy === h;
        if (!onBorder) continue;
        const x = gx + dx;
        const y = gy + dy;
        if (g.isPath(x, y)) out.push(g.idx(x, y));
      }
    return out;
  }

  get spawnReady(): boolean {
    return this.spawnCells.length > 0;
  }

  spawn(): void {
    if (this.spawnCells.length === 0) return;
    let i = -1;
    for (let k = 0; k < this.cap; k++)
      if (this.active[k] === 0) {
        i = k;
        break;
      }
    if (i < 0) return; // parc plein

    const cell = this.spawnCells[(Math.random() * this.spawnCells.length) | 0];
    const cx = cell % this.grid.w;
    const cy = (cell / this.grid.w) | 0;
    const w = this.grid.gridToWorld(cx, cy);
    this.active[i] = 1;
    this.cx[i] = cx;
    this.cy[i] = cy;
    this.adv[i] = 0;
    this.st[i] = S.Wander;
    this.hunger[i] = Math.random() * 0.3;
    this.timer[i] = 0;
    this.life[i] = 0;
    this.happy[i] = 0;
    this.px[i] = w.x + (Math.random() - 0.5) * 0.4;
    this.pz[i] = w.z + (Math.random() - 0.5) * 0.4;
  }

  private fieldFor(state: number): FlowField {
    if (state === S.ToFood) return this.food;
    if (state === S.Leave) return this.exit;
    return this.attractions;
  }

  private adjacent(cx: number, cy: number, want: 'tank' | 'food'): { idx: number; b: PlacedBuilding } | null {
    const g = this.grid;
    const buildings = this.getBuildings();
    for (let k = 0; k < 4; k++) {
      const x = cx + DX[k];
      const y = cy + DY[k];
      if (!g.inBounds(x, y)) continue;
      const i = g.idx(x, y);
      if (g.tile[i] !== Tile.Building) continue;
      const bIdx = g.occupant[i];
      const b = buildings[bIdx];
      if (!b) continue;
      if (want === 'tank' && b.tank) return { idx: bIdx, b };
      if (want === 'food' && FOOD_TYPES.includes(b.type)) return { idx: bIdx, b };
    }
    return null;
  }

  private randomPathNeighbor(cx: number, cy: number): number {
    const opts: number[] = [];
    for (let k = 0; k < 4; k++) if (this.grid.isPath(cx + DX[k], cy + DY[k])) opts.push(k);
    return opts.length ? opts[(Math.random() * opts.length) | 0] : -1;
  }

  /** Avance la simulation. `dt` en secondes. */
  update(dt: number): void {
    const W = this.grid.w;
    for (let i = 0; i < this.cap; i++) {
      if (this.active[i] === 0) continue;
      this.hunger[i] += dt * HUNGER_RATE;
      this.life[i] += dt;

      // États stationnaires.
      if (this.st[i] === S.Observe || this.st[i] === S.Eat) {
        this.timer[i] -= dt;
        if (this.timer[i] <= 0) this.st[i] = S.Wander;
        continue;
      }

      if (this.adv[i] === 0) {
        // À un centre de case : logique d'arrivée puis choix du pas suivant.
        if (this.arrival(i)) continue; // despawn / passage en stationnaire
        const ci = this.cy[i] * W + this.cx[i];
        let d = this.fieldFor(this.st[i]).step(ci);
        if (d < 0 && this.st[i] === S.Wander) d = this.randomPathNeighbor(this.cx[i], this.cy[i]);
        if (d < 0) {
          // Bloqué : on s'en va (insatisfait s'il cherchait à manger).
          if (this.st[i] === S.Leave) {
            this.despawn(i);
            continue;
          }
          if (this.st[i] === S.ToFood) this.happy[i] -= 1;
          this.st[i] = S.Leave;
          continue;
        }
        this.nx[i] = this.cx[i] + DX[d];
        this.ny[i] = this.cy[i] + DY[d];
        this.adv[i] = 1;
      }

      // Déplacement vers le centre de la case cible.
      const target = this.grid.gridToWorld(this.nx[i], this.ny[i]);
      let dxp = target.x - this.px[i];
      let dzp = target.z - this.pz[i];
      const dist = Math.hypot(dxp, dzp) || 1;
      const stepLen = SPEED * dt;
      if (dist <= stepLen) {
        this.px[i] = target.x;
        this.pz[i] = target.z;
        this.cx[i] = this.nx[i];
        this.cy[i] = this.ny[i];
        this.adv[i] = 0;
      } else {
        dxp /= dist;
        dzp /= dist;
        this.px[i] += dxp * stepLen;
        this.pz[i] += dzp * stepLen;
        this.hx[i] = dxp;
        this.hz[i] = dzp;
      }
    }
  }

  /** Logique exécutée à l'arrivée sur un centre de case. Retourne true si l'agent ne doit plus bouger ce tick. */
  private arrival(i: number): boolean {
    const cx = this.cx[i];
    const cy = this.cy[i];

    if (this.st[i] === S.Leave) {
      const cell = cy * this.grid.w + cx;
      if (this.spawnCells.includes(cell)) {
        this.despawn(i);
        return true;
      }
      return false;
    }

    if (this.st[i] === S.ToFood) {
      const f = this.adjacent(cx, cy, 'food');
      if (f) {
        this.st[i] = S.Eat;
        this.timer[i] = EAT_TIME;
        this.hunger[i] = 0;
        this.happy[i] += 1;
        this.cb.onEat(f.b.salePrice ?? 12);
        return true;
      }
      return false;
    }

    // Wander
    if (this.life[i] > MAX_LIFE) {
      this.st[i] = S.Leave;
      return false;
    }
    if (this.hunger[i] > HUNGER_THRESHOLD) {
      this.st[i] = S.ToFood;
      return false;
    }
    const t = this.adjacent(cx, cy, 'tank');
    if (t && Math.random() < OBSERVE_CHANCE) {
      this.st[i] = S.Observe;
      this.timer[i] = OBSERVE_TIME;
      this.happy[i] += 1;
      this.cb.onDonate(buildingAppeal(t.b));
      return true;
    }
    return false;
  }

  private despawn(i: number): void {
    this.active[i] = 0;
    const satisfaction = Math.max(0, Math.min(1, 0.5 + this.happy[i] * 0.15 - this.hunger[i] * 0.3));
    this.cb.onLeave(satisfaction);
  }

  get count(): number {
    let c = 0;
    for (let i = 0; i < this.cap; i++) c += this.active[i];
    return c;
  }
}
