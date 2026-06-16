/**
 * GridManager — modèle de données spatial du parc (logique PURE, zéro Three.js).
 *
 * La grille est allouée à une CAPACITÉ MAX fixe (typed arrays plates → les flow
 * fields du pathfinding garderont une taille constante, pas de réallocation).
 * Seules les cases « possédées » (`owned`) sont constructibles ; on agrandit en
 * achetant des parcelles (blocs `PLOT×PLOT`) à coût exponentiel.
 *
 * Conventions : index = y*W + x. Le parc est centré sur l'origine monde.
 */

export const GRID = {
  cap: 48, // capacité max (48×48)
  cell: 2, // unités monde par case
  plot: 6, // taille d'une parcelle achetable
  startOwned: 12, // côté de la zone possédée au départ (12×12 centré)
} as const;

export enum Tile {
  Empty = 0,
  Path = 1,
  Building = 2,
  Blocked = 3,
}

export interface GridSnapshot {
  cap: number;
  tile: string; // base64
  occupant: string; // base64
  owned: string; // base64
}

export class GridManager {
  readonly w: number = GRID.cap;
  readonly h: number = GRID.cap;
  readonly tile: Uint8Array;
  readonly occupant: Int32Array; // index bâtiment, -1 = libre
  readonly owned: Uint8Array; // 1 = parcelle possédée

  constructor() {
    const n = this.w * this.h;
    this.tile = new Uint8Array(n);
    this.occupant = new Int32Array(n).fill(-1);
    this.owned = new Uint8Array(n);
    this.ownStartRegion();
  }

  idx(x: number, y: number): number {
    return y * this.w + x;
  }

  inBounds(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.w && y < this.h;
  }

  isOwned(x: number, y: number): boolean {
    return this.inBounds(x, y) && this.owned[this.idx(x, y)] === 1;
  }

  isFree(x: number, y: number): boolean {
    if (!this.isOwned(x, y)) return false;
    const i = this.idx(x, y);
    return this.tile[i] === Tile.Empty && this.occupant[i] === -1;
  }

  /** Toutes les cases d'une emprise w×h sont possédées et libres ? */
  canPlace(x: number, y: number, bw: number, bh: number): boolean {
    for (let dy = 0; dy < bh; dy++)
      for (let dx = 0; dx < bw; dx++) if (!this.isFree(x + dx, y + dy)) return false;
    return true;
  }

  /** Marque l'emprise comme occupée par `buildingIndex`. */
  place(x: number, y: number, bw: number, bh: number, buildingIndex: number, tile = Tile.Building): void {
    for (let dy = 0; dy < bh; dy++)
      for (let dx = 0; dx < bw; dx++) {
        const i = this.idx(x + dx, y + dy);
        this.tile[i] = tile;
        this.occupant[i] = buildingIndex;
      }
  }

  /** Libère une emprise. */
  clear(x: number, y: number, bw: number, bh: number): void {
    for (let dy = 0; dy < bh; dy++)
      for (let dx = 0; dx < bw; dx++) {
        const i = this.idx(x + dx, y + dy);
        this.tile[i] = Tile.Empty;
        this.occupant[i] = -1;
      }
  }

  setPath(x: number, y: number, buildingIndex = -1): void {
    if (!this.isFree(x, y)) return;
    const i = this.idx(x, y);
    this.tile[i] = Tile.Path;
    this.occupant[i] = buildingIndex;
  }

  isPath(x: number, y: number): boolean {
    return this.inBounds(x, y) && this.tile[this.idx(x, y)] === Tile.Path;
  }

  /** Achète/possède la parcelle (bloc PLOT×PLOT) contenant (x,y). */
  ownPlotAt(x: number, y: number): void {
    const px = Math.floor(x / GRID.plot) * GRID.plot;
    const py = Math.floor(y / GRID.plot) * GRID.plot;
    for (let dy = 0; dy < GRID.plot; dy++)
      for (let dx = 0; dx < GRID.plot; dx++) {
        if (this.inBounds(px + dx, py + dy)) this.owned[this.idx(px + dx, py + dy)] = 1;
      }
  }

  /** Index packé (origine) de la parcelle contenant (x,y). */
  plotOriginIndex(x: number, y: number): number {
    const px = Math.floor(x / GRID.plot) * GRID.plot;
    const py = Math.floor(y / GRID.plot) * GRID.plot;
    return py * this.w + px;
  }

  /** Possède la parcelle dont l'origine est l'index packé donné. */
  ownPlotByIndex(packed: number): void {
    this.ownPlotAt(packed % this.w, Math.floor(packed / this.w));
  }

  private ownStartRegion(): void {
    const s = GRID.startOwned;
    const start = Math.floor((this.w - s) / 2);
    for (let y = start; y < start + s; y++)
      for (let x = start; x < start + s; x++) this.owned[this.idx(x, y)] = 1;
  }

  /** Centre monde d'une case. */
  gridToWorld(x: number, y: number): { x: number; z: number } {
    return {
      x: (x - this.w / 2 + 0.5) * GRID.cell,
      z: (y - this.h / 2 + 0.5) * GRID.cell,
    };
  }

  /** Case contenant un point monde. */
  worldToGrid(wx: number, wz: number): { x: number; y: number } {
    return {
      x: Math.round(wx / GRID.cell + this.w / 2 - 0.5),
      y: Math.round(wz / GRID.cell + this.h / 2 - 0.5),
    };
  }

  // ---- Sérialisation (typed arrays → base64) ----------------------------

  serialize(): GridSnapshot {
    return {
      cap: this.w,
      tile: bytesToB64(this.tile),
      occupant: bytesToB64(new Uint8Array(this.occupant.buffer)),
      owned: bytesToB64(this.owned),
    };
  }

  load(snap: GridSnapshot): void {
    if (snap.cap !== this.w) return; // capacité incompatible → on ignore
    this.tile.set(b64ToBytes(snap.tile));
    this.occupant.set(new Int32Array(b64ToBytes(snap.occupant).buffer));
    this.owned.set(b64ToBytes(snap.owned));
  }
}

function bytesToB64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
