import { GridManager, Tile } from './Grid';

/** Deltas par code de direction : 0:+x · 1:-x · 2:+y · 3:-y. (k^1 = direction opposée) */
export const DX = [1, -1, 0, 0];
export const DY = [0, 0, 1, -1];

/**
 * Champ de direction (flow field) calculé par BFS multi-source sur les cases
 * `Path`. `dir[cell]` = code de direction à suivre pour se rapprocher du but le
 * plus proche (−1 = inaccessible). Coût uniforme → BFS suffit. Recalculé
 * uniquement quand le réseau de chemins change ; lecture O(1) par agent.
 */
export class FlowField {
  readonly dist: Int32Array;
  readonly dir: Int8Array;
  private readonly queue: Int32Array;

  constructor(
    readonly w: number,
    readonly h: number,
  ) {
    this.dist = new Int32Array(w * h);
    this.dir = new Int8Array(w * h);
    this.queue = new Int32Array(w * h);
  }

  /** Recalcule le champ vers l'ensemble de cases-buts `goals`. */
  compute(grid: GridManager, goals: number[]): void {
    const W = this.w;
    const H = this.h;
    const q = this.queue;
    this.dist.fill(-1);
    this.dir.fill(-1);
    let head = 0;
    let tail = 0;

    for (const g of goals) {
      if (g >= 0 && grid.tile[g] === Tile.Path && this.dist[g] < 0) {
        this.dist[g] = 0;
        q[tail++] = g;
      }
    }

    while (head < tail) {
      const c = q[head++];
      const d = this.dist[c];
      const x = c % W;
      const y = (c / W) | 0;
      for (let k = 0; k < 4; k++) {
        const nx = x + DX[k];
        const ny = y + DY[k];
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const n = ny * W + nx;
        if (grid.tile[n] !== Tile.Path || this.dist[n] >= 0) continue;
        this.dist[n] = d + 1;
        this.dir[n] = k ^ 1; // direction de n VERS c
        q[tail++] = n;
      }
    }
  }

  /** Direction à suivre depuis `cell` (−1 si aucune route). */
  step(cell: number): number {
    return cell >= 0 && cell < this.dir.length ? this.dir[cell] : -1;
  }

  reachable(cell: number): boolean {
    return cell >= 0 && cell < this.dist.length && this.dist[cell] >= 0;
  }
}
