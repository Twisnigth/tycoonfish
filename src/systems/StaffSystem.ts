import { GridManager, Tile } from '../world/Grid';
import { DX, DY, FlowField } from '../world/Pathfinding';
import { BUILDINGS } from '../data/buildings';
import type { Employee, PlacedBuilding, TankState } from '../core/GameState';

/**
 * Personnel actif (SoA) — chaque employé se DÉPLACE sur les chemins via un
 * flow-field selon son RÔLE :
 *  - soigneur : entretient les bacs en besoin (eau/nourriture). Peut être
 *    AFFECTÉ à un bac précis (il ne s'occupe alors que de celui-là) ; sinon il
 *    s'occupe de n'importe quel bac.
 *  - agent d'entretien (janitor) : ramasse les déchets laissés par les visiteurs.
 */

export interface LitterItem {
  id: string;
  x: number;
  z: number;
}

const SPEED = 2.6;
const WORK_TIME = 3; // s d'entretien d'un bac
const REFRESH = 1.5; // s entre deux recalculs de champs
const RESTORE = 0.45; // /s (eau + nourriture)
const NEED = 0.7;
const PICK_DIST2 = 1.4 * 1.4; // distance² monde pour ramasser un déchet

enum St {
  Move = 0,
  Work = 1,
}

export class StaffSystem {
  readonly cap = 24;
  readonly active = new Uint8Array(this.cap);
  readonly px = new Float32Array(this.cap);
  readonly pz = new Float32Array(this.cap);
  readonly hx = new Float32Array(this.cap);
  readonly hz = new Float32Array(this.cap);
  readonly moving = new Uint8Array(this.cap);
  readonly role = new Uint8Array(this.cap); // 0 = soigneur, 1 = agent d'entretien
  private readonly tankId: (string | null)[] = new Array(this.cap).fill(null);
  private readonly cx = new Int32Array(this.cap);
  private readonly cy = new Int32Array(this.cap);
  private readonly nx = new Int32Array(this.cap);
  private readonly ny = new Int32Array(this.cap);
  private readonly adv = new Uint8Array(this.cap);
  private readonly st = new Uint8Array(this.cap);
  private readonly timer = new Float32Array(this.cap);

  private readonly shared: FlowField; // soigneurs libres → tout bac en besoin
  private readonly litterField: FlowField; // agents d'entretien → déchets
  private assigned = new Map<string, FlowField>(); // soigneur affecté → son bac
  private homeCells: number[] = [];
  private refreshT = 0;

  constructor(
    private readonly grid: GridManager,
    private readonly getBuildings: () => PlacedBuilding[],
    private readonly getEmployees: () => Employee[],
    private readonly getLitter: () => LitterItem[],
    private readonly pickLitter: (id: string) => void,
  ) {
    this.shared = new FlowField(grid.w, grid.h);
    this.litterField = new FlowField(grid.w, grid.h);
  }

  recompute(): void {
    this.homeCells = [];
    for (const b of this.getBuildings()) {
      if (b.type === 'entrance') {
        this.homeCells.push(...this.pathNeighbors(b.gx, b.gy, BUILDINGS[b.type].w, BUILDINGS[b.type].h));
      }
    }
    this.refreshFields();
  }

  private refreshFields(): void {
    const buildings = this.getBuildings();
    // Champ partagé : vers tous les bacs en besoin.
    const needyGoals: number[] = [];
    for (const b of buildings) {
      if (b.tank && (b.tank.water.foodStock < NEED || b.tank.water.quality < NEED)) {
        const def = BUILDINGS[b.type];
        needyGoals.push(...this.pathNeighbors(b.gx, b.gy, def.w, def.h));
      }
    }
    this.shared.compute(this.grid, needyGoals);

    // Champs affectés : un par bac ayant au moins un soigneur assigné.
    const wanted = new Set<string>();
    for (let i = 0; i < this.cap; i++) {
      if (this.active[i] && this.role[i] === 0 && this.tankId[i]) wanted.add(this.tankId[i]!);
    }
    for (const id of [...this.assigned.keys()]) if (!wanted.has(id)) this.assigned.delete(id);
    for (const id of wanted) {
      const b = buildings.find((x) => x.tank?.id === id);
      if (!b) { this.assigned.delete(id); continue; }
      let f = this.assigned.get(id);
      if (!f) { f = new FlowField(this.grid.w, this.grid.h); this.assigned.set(id, f); }
      const def = BUILDINGS[b.type];
      f.compute(this.grid, this.pathNeighbors(b.gx, b.gy, def.w, def.h));
    }

    // Champ déchets : vers les cases contenant un déchet.
    const litterGoals: number[] = [];
    for (const l of this.getLitter()) {
      const c = this.grid.worldToGrid(l.x, l.z);
      if (this.grid.isPath(c.x, c.y)) litterGoals.push(this.grid.idx(c.x, c.y));
    }
    this.litterField.compute(this.grid, litterGoals);
  }

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

  /** Aligne les slots actifs sur la liste d'employés (rôle + affectation). */
  sync(): void {
    const emps = this.getEmployees();
    const want = emps.length;
    let count = 0;
    for (let i = 0; i < this.cap; i++) count += this.active[i];
    while (count < want) { if (!this.spawn()) break; count++; }
    for (let i = this.cap - 1; i >= 0 && count > want; i--) {
      if (this.active[i]) { this.active[i] = 0; count--; }
    }
    // Réaffecte rôle + bac dans l'ordre des slots actifs.
    let idx = 0;
    for (let i = 0; i < this.cap; i++) {
      if (!this.active[i]) continue;
      const e = emps[idx++];
      if (!e) continue;
      this.role[i] = e.role === 'janitor' ? 1 : 0;
      this.tankId[i] = e.tankId;
    }
    this.refreshFields();
  }

  private spawn(): boolean {
    const cell = this.homeCells[0] ?? this.firstPathCell();
    if (cell < 0) return false;
    let i = -1;
    for (let k = 0; k < this.cap; k++) if (!this.active[k]) { i = k; break; }
    if (i < 0) return false;
    const cx = cell % this.grid.w;
    const cy = (cell / this.grid.w) | 0;
    const w = this.grid.gridToWorld(cx, cy);
    this.active[i] = 1;
    this.cx[i] = cx; this.cy[i] = cy; this.adv[i] = 0; this.st[i] = St.Move; this.timer[i] = 0;
    this.px[i] = w.x; this.pz[i] = w.z;
    return true;
  }

  private firstPathCell(): number {
    for (let i = 0; i < this.grid.tile.length; i++) if (this.grid.tile[i] === Tile.Path) return i;
    return -1;
  }

  /** Bac voisin en besoin (optionnellement restreint à un bac précis). */
  private adjacentNeedyTank(cx: number, cy: number, restrict: string | null): TankState | null {
    const buildings = this.getBuildings();
    for (let k = 0; k < 4; k++) {
      const x = cx + DX[k];
      const y = cy + DY[k];
      if (!this.grid.inBounds(x, y) || this.grid.tile[this.grid.idx(x, y)] !== Tile.Building) continue;
      const b = buildings[this.grid.occupant[this.grid.idx(x, y)]];
      if (!b?.tank) continue;
      if (restrict && b.tank.id !== restrict) continue;
      if (b.tank.water.foodStock < NEED || b.tank.water.quality < NEED) return b.tank;
    }
    return null;
  }

  /** Déchet sur (ou très proche de) la position courante du slot. */
  private litterAt(i: number): string | null {
    for (const l of this.getLitter()) {
      const dx = l.x - this.px[i];
      const dz = l.z - this.pz[i];
      if (dx * dx + dz * dz < PICK_DIST2) return l.id;
    }
    return null;
  }

  private fieldFor(i: number): FlowField {
    if (this.role[i] === 1) return this.litterField;
    const id = this.tankId[i];
    if (id) return this.assigned.get(id) ?? this.shared;
    return this.shared;
  }

  update(dt: number): void {
    this.refreshT += dt;
    if (this.refreshT >= REFRESH) { this.refreshT = 0; this.refreshFields(); }

    const W = this.grid.w;
    for (let i = 0; i < this.cap; i++) {
      if (!this.active[i]) continue;
      this.moving[i] = 0;

      if (this.st[i] === St.Work) {
        const tank = this.adjacentNeedyTank(this.cx[i], this.cy[i], this.tankId[i]);
        if (tank) {
          tank.water.foodStock = Math.min(1, tank.water.foodStock + RESTORE * dt);
          tank.water.quality = Math.min(1, tank.water.quality + RESTORE * dt);
        }
        this.timer[i] -= dt;
        if (this.timer[i] <= 0 || !tank) this.st[i] = St.Move;
        continue;
      }

      if (this.adv[i] === 0) {
        if (this.role[i] === 1) {
          // Agent d'entretien : ramasse un déchet présent ici.
          const lit = this.litterAt(i);
          if (lit) { this.pickLitter(lit); continue; }
        } else if (this.adjacentNeedyTank(this.cx[i], this.cy[i], this.tankId[i])) {
          this.st[i] = St.Work;
          this.timer[i] = WORK_TIME;
          continue;
        }
        const d = this.fieldFor(i).step(this.cy[i] * W + this.cx[i]);
        if (d < 0) continue;
        this.nx[i] = this.cx[i] + DX[d];
        this.ny[i] = this.cy[i] + DY[d];
        this.adv[i] = 1;
      }

      const target = this.grid.gridToWorld(this.nx[i], this.ny[i]);
      const dxp = target.x - this.px[i];
      const dzp = target.z - this.pz[i];
      const dist = Math.hypot(dxp, dzp) || 1;
      const step = SPEED * dt;
      if (dist <= step) {
        this.px[i] = target.x; this.pz[i] = target.z;
        this.cx[i] = this.nx[i]; this.cy[i] = this.ny[i];
        this.adv[i] = 0;
      } else {
        this.px[i] += (dxp / dist) * step;
        this.pz[i] += (dzp / dist) * step;
        this.hx[i] = dxp / dist;
        this.hz[i] = dzp / dist;
        this.moving[i] = 1;
      }
    }
  }
}
