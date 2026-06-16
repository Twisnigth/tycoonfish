import * as THREE from 'three';
import { GRID, type GridManager } from '../world/Grid';

/**
 * Sol du parc + overlay de grille (visible en mode construction) + surbrillance
 * de la zone possédée (cases constructibles).
 */
export class GridView {
  readonly group = new THREE.Group();
  private readonly gridHelper: THREE.GridHelper;
  private readonly ownedPlane: THREE.Mesh;
  private readonly span = GRID.cap * GRID.cell;

  constructor() {
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(this.span, this.span),
      new THREE.MeshStandardMaterial({ color: 0xbcd9c4, flatShading: true }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.group.add(ground);

    this.gridHelper = new THREE.GridHelper(this.span, GRID.cap, 0x6f9a85, 0x9cc0ac);
    this.gridHelper.position.y = 0.02;
    this.gridHelper.visible = false;
    this.group.add(this.gridHelper);

    this.ownedPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ color: 0x8fe0b6, transparent: true, opacity: 0.18, depthWrite: false }),
    );
    this.ownedPlane.rotation.x = -Math.PI / 2;
    this.ownedPlane.position.y = 0.015;
    this.ownedPlane.visible = false;
    this.group.add(this.ownedPlane);
  }

  setBuildMode(on: boolean): void {
    this.gridHelper.visible = on;
    this.ownedPlane.visible = on;
  }

  /** Ajuste la surbrillance à la bounding-box des cases possédées. */
  updateOwned(grid: GridManager): void {
    let minX = grid.w;
    let minY = grid.h;
    let maxX = -1;
    let maxY = -1;
    for (let y = 0; y < grid.h; y++)
      for (let x = 0; x < grid.w; x++)
        if (grid.owned[grid.idx(x, y)]) {
          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (x > maxX) maxX = x;
          if (y > maxY) maxY = y;
        }
    if (maxX < 0) return;
    const a = grid.gridToWorld(minX, minY);
    const b = grid.gridToWorld(maxX, maxY);
    this.ownedPlane.scale.set((maxX - minX + 1) * GRID.cell, (maxY - minY + 1) * GRID.cell, 1);
    this.ownedPlane.position.x = (a.x + b.x) / 2;
    this.ownedPlane.position.z = (a.z + b.z) / 2;
  }
}
