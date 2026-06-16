import * as THREE from 'three';
import { GRID } from '../world/Grid';

/**
 * Décor distant statique habillant le fond hors de la zone de construction :
 * un grand océan + un anneau de montagnes low-poly. Ajouté une seule fois.
 */
export class Environment {
  readonly group = new THREE.Group();

  constructor() {
    const span = GRID.cap * GRID.cell; // 96

    // Océan : grand plan bleu légèrement sous le sol du parc.
    const ocean = new THREE.Mesh(
      new THREE.PlaneGeometry(span * 8, span * 8),
      new THREE.MeshStandardMaterial({ color: 0x3a86b5, flatShading: true }),
    );
    ocean.rotation.x = -Math.PI / 2;
    ocean.position.y = -0.6;
    ocean.receiveShadow = false;
    this.group.add(ocean);

    // Montagnes low-poly en anneau autour de la grille.
    const mat = new THREE.MeshStandardMaterial({ color: 0x7e8a6f, flatShading: true });
    const snow = new THREE.MeshStandardMaterial({ color: 0xeef3f5, flatShading: true });
    const ringR = span * 0.92;
    const count = 30;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      const r = ringR + (Math.random() - 0.5) * span * 0.22;
      const h = span * 0.18 * (0.6 + Math.random() * 0.9);
      const rad = span * 0.07 * (0.7 + Math.random() * 0.7);
      const m = new THREE.Mesh(new THREE.ConeGeometry(rad, h, 5), Math.random() < 0.4 ? snow : mat);
      m.position.set(Math.cos(a) * r, h / 2 - 0.6, Math.sin(a) * r);
      m.rotation.y = Math.random() * Math.PI;
      this.group.add(m);
    }
  }
}
