import * as THREE from 'three';
import type { AgentSystem } from '../systems/AgentSystem';
import { characterUrl, loadInstanceParts } from './AssetLoader';

const VISITOR_HEIGHT = 1.6;
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);
const _hidden = new THREE.Vector3(0, -9999, 0);

/**
 * Rend toute la foule en UN InstancedMesh (visitor.glb instancié, sans skinning
 * — léger pour des centaines d'agents). Matrices écrites depuis les SoA.
 */
export class AgentRenderer {
  private mesh: THREE.InstancedMesh | null = null;

  constructor(
    private readonly scene: THREE.Scene,
    private readonly agents: AgentSystem,
  ) {
    void this.init();
  }

  private async init(): Promise<void> {
    const parts = await loadInstanceParts(characterUrl('visitor'), false);
    if (!parts) return;
    const mesh = new THREE.InstancedMesh(parts.geometry, parts.material, this.agents.cap);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.castShadow = true;
    mesh.frustumCulled = false;
    this.mesh = mesh;
    this.scene.add(mesh);
  }

  update(): void {
    const mesh = this.mesh;
    if (!mesh) return;
    const a = this.agents;
    const s = VISITOR_HEIGHT;
    _s.set(s, s, s);
    for (let i = 0; i < a.cap; i++) {
      if (a.active[i] === 0) {
        _m.compose(_hidden, _q, _s);
      } else {
        _p.set(a.px[i], s * 0.5, a.pz[i]);
        const ang = Math.atan2(a.hx[i], a.hz[i]);
        _q.setFromAxisAngle(_up, ang);
        _m.compose(_p, _q, _s);
      }
      mesh.setMatrixAt(i, _m);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }
}
