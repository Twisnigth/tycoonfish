import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Fabrique et met en cache les géométries low-poly réutilisables. Une géométrie
 * par archétype → réutilisée par les InstancedMesh (1 draw call). Chaque poisson
 * = corps facetté (octaèdre) + nageoires (caudale, dorsale, pectorales) en fines
 * « plaques » visibles sous tous les angles. Style flat-shading épuré, et bien
 * plus reconnaissable que l'ancien cône — sert de modèle aux espèces sans GLB.
 */
const cache = new Map<string, THREE.BufferGeometry>();

interface FishParams {
  bodyW: number;
  bodyH: number;
  bodyL: number;
  tailH: number;
  tailL: number;
  dorsalH?: number;
  wingW?: number; // nageoires pectorales / ailes (raies, exotiques)
  wingL?: number;
}

/** Corps + nageoires fusionnés en une géométrie low-poly (nez vers +Z). */
function buildFish(p: FishParams): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];

  // Corps : octaèdre étiré → diamant facetté (flat-shading = facettes nettes).
  const body = new THREE.OctahedronGeometry(0.5, 0);
  body.scale(p.bodyW, p.bodyH, p.bodyL);
  parts.push(body);

  // Nageoire caudale : fine plaque verticale à l'arrière.
  const tail = new THREE.BoxGeometry(0.05, p.tailH, p.tailL);
  tail.translate(0, 0, -p.bodyL * 0.5 - p.tailL * 0.42);
  parts.push(tail);

  // Nageoire dorsale : fine plaque verticale sur le dessus.
  if (p.dorsalH) {
    const dorsal = new THREE.BoxGeometry(0.05, p.dorsalH, p.bodyL * 0.5);
    dorsal.translate(0, p.bodyH * 0.45, 0);
    parts.push(dorsal);
  }

  // Nageoires pectorales / ailes : fines plaques horizontales sur les côtés.
  if (p.wingW && p.wingL) {
    const off = p.bodyW * 0.4 + p.wingW * 0.5;
    const left = new THREE.BoxGeometry(p.wingW, 0.05, p.wingL);
    left.translate(-off, 0, 0);
    const right = new THREE.BoxGeometry(p.wingW, 0.05, p.wingL);
    right.translate(off, 0, 0);
    parts.push(left, right);
  }

  // Uniformiser l'indexation (Octahedron est non-indexé, Box indexé) sinon
  // mergeGeometries renvoie null.
  const merged = mergeGeometries(parts.map((g) => g.toNonIndexed()), false);
  if (!merged) throw new Error('mergeGeometries a échoué');
  merged.computeVertexNormals();
  return merged;
}

function create(ref: string): THREE.BufferGeometry {
  switch (ref) {
    case 'fish.round': // corps haut et plat (chirurgiens, scalaires, discus)
      return buildFish({ bodyW: 0.4, bodyH: 0.72, bodyL: 0.82, tailH: 0.42, tailL: 0.3, dorsalH: 0.34 });
    case 'fish.long': // corps allongé fuselé (arowana, koï, esturgeon)
      return buildFish({ bodyW: 0.3, bodyH: 0.36, bodyL: 1.7, tailH: 0.46, tailL: 0.32, dorsalH: 0.18 });
    case 'fish.exotic': // nageoires marquées (rascasse, mandarin, anges)
      return buildFish({ bodyW: 0.42, bodyH: 0.52, bodyL: 0.95, tailH: 0.5, tailL: 0.34, dorsalH: 0.42, wingW: 0.34, wingL: 0.5 });
    case 'fish.eel': // corps très long et fin (anguilles, serpents)
      return buildFish({ bodyW: 0.18, bodyH: 0.22, bodyL: 2.4, tailH: 0.26, tailL: 0.26, dorsalH: 0.12 });
    case 'fish.ray': // corps aplati + grandes ailes + queue fouet (raies)
      return buildFish({ bodyW: 0.5, bodyH: 0.16, bodyL: 0.9, tailH: 0.08, tailL: 0.7, wingW: 0.75, wingL: 0.7 });
    case 'fish.basic':
    default: // poisson standard
      return buildFish({ bodyW: 0.42, bodyH: 0.46, bodyL: 1.05, tailH: 0.46, tailL: 0.34, dorsalH: 0.24 });
  }
}

export function getFishGeometry(ref: string): THREE.BufferGeometry {
  let geo = cache.get(ref);
  if (!geo) {
    geo = create(ref);
    cache.set(ref, geo);
  }
  return geo;
}

export function disposeRegistry(): void {
  for (const g of cache.values()) g.dispose();
  cache.clear();
}
