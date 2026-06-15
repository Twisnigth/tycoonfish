import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Fabrique et met en cache les géométries low-poly réutilisables. Une
 * géométrie par archétype de poisson → réutilisée par les InstancedMesh
 * (1 draw call pour des milliers d'individus). Style flat-shading épuré.
 */
const cache = new Map<string, THREE.BufferGeometry>();

/** Corps + nageoire caudale fusionnés en une seule géométrie low-poly. */
function buildFish(opts: {
  radialSegs: number;
  bodyRadius: number;
  bodyLength: number;
  tailSize: number;
  squash?: number; // aplatit verticalement (raies)
}): THREE.BufferGeometry {
  const { radialSegs, bodyRadius, bodyLength, tailSize, squash = 1 } = opts;

  // Corps : cône peu segmenté orienté vers +Z (sens de nage).
  const body = new THREE.ConeGeometry(bodyRadius, bodyLength, radialSegs);
  body.rotateX(Math.PI / 2);
  body.translate(0, 0, bodyLength * 0.15);

  // Queue : petit cône inversé à l'arrière.
  const tail = new THREE.ConeGeometry(tailSize, tailSize * 1.6, 3);
  tail.rotateX(-Math.PI / 2);
  tail.translate(0, 0, -bodyLength * 0.5);

  const merged = mergeGeometries([body, tail], false);
  if (squash !== 1) merged.scale(1, squash, 1);
  merged.computeVertexNormals();
  return merged;
}

function create(ref: string): THREE.BufferGeometry {
  switch (ref) {
    case 'fish.round':
      return buildFish({ radialSegs: 6, bodyRadius: 0.42, bodyLength: 0.8, tailSize: 0.22 });
    case 'fish.long':
      return buildFish({ radialSegs: 5, bodyRadius: 0.22, bodyLength: 1.5, tailSize: 0.2 });
    case 'fish.exotic':
      return buildFish({ radialSegs: 8, bodyRadius: 0.34, bodyLength: 1.0, tailSize: 0.3 });
    case 'fish.eel':
      return buildFish({ radialSegs: 4, bodyRadius: 0.16, bodyLength: 2.2, tailSize: 0.14 });
    case 'fish.ray':
      return buildFish({ radialSegs: 6, bodyRadius: 0.5, bodyLength: 0.7, tailSize: 0.12, squash: 0.35 });
    case 'fish.basic':
    default:
      return buildFish({ radialSegs: 5, bodyRadius: 0.3, bodyLength: 1.0, tailSize: 0.24 });
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
