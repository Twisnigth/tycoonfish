import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { GRID } from '../world/Grid';

/**
 * Auto-tiling des chemins par bitmasking. Chaque case calcule un masque 4 bits
 * (voisins connectés = chemin OU façade de bâtiment) ; on génère une géométrie
 * « plaque centrale + bras vers chaque côté connecté ». Les bras de deux cases
 * voisines se rejoignent → virages, T, croix et raccords aux bâtiments fluides.
 * 16 géométries possibles, mises en cache.
 */

/** Bits de direction : E=1 · W=2 · S(+y/+z)=4 · N(−y/−z)=8. */
export const PATH_DIRS = [
  { bit: 1, dx: 1, dy: 0, ox: 1, oz: 0 },
  { bit: 2, dx: -1, dy: 0, ox: -1, oz: 0 },
  { bit: 4, dx: 0, dy: 1, ox: 0, oz: 1 },
  { bit: 8, dx: 0, dy: -1, ox: 0, oz: -1 },
] as const;

const cell = GRID.cell;
const T = 0.12; // épaisseur
const C = cell * 0.6; // plaque centrale
const ARM_LEN = (cell - C) / 2 + 0.02; // rejoint le bord de case

const cache = new Map<number, THREE.BufferGeometry>();

/** Géométrie de tuile de chemin pour un masque de connexion donné (0..15). */
export function pathGeometry(mask: number): THREE.BufferGeometry {
  const cached = cache.get(mask);
  if (cached) return cached;

  const parts: THREE.BufferGeometry[] = [new THREE.BoxGeometry(C, T, C)];
  for (const d of PATH_DIRS) {
    if (!(mask & d.bit)) continue;
    const isX = d.dx !== 0;
    const arm = new THREE.BoxGeometry(isX ? ARM_LEN : C, T, isX ? C : ARM_LEN);
    arm.translate(d.ox * (C / 2 + ARM_LEN / 2), 0, d.oz * (C / 2 + ARM_LEN / 2));
    parts.push(arm);
  }
  const geo = mergeGeometries(parts, false);
  geo.computeVertexNormals();
  cache.set(mask, geo);
  return geo;
}
