import * as THREE from 'three';
import type { Game } from '../core/Game';
import { characterUrl, loadAnimated, type AnimatedModel } from './AssetLoader';

/**
 * Rend les soigneurs comme personnages animés qui SUIVENT leurs agents du
 * `StaffSystem` (déplacement vers les bacs en besoin). Un modèle par soigneur
 * embauché ; les positions/orientations viennent de la simulation.
 */
export class KeeperRenderer {
  private models: AnimatedModel[] = [];

  constructor(
    private readonly scene: THREE.Scene,
    private readonly game: Game,
  ) {}

  /** Aligne le nombre de modèles sur l'effectif embauché (soigneurs + agents). */
  async sync(): Promise<void> {
    const want = this.game.state.staff.employees.length;
    while (this.models.length < want) {
      const m = await loadAnimated(characterUrl('keeper'), 1.7);
      if (!m) break;
      this.scene.add(m.root);
      this.models.push(m);
    }
    while (this.models.length > want) {
      const m = this.models.pop();
      if (m) this.scene.remove(m.root);
    }
  }

  update(dt: number): void {
    const s = this.game.staff;
    let j = 0;
    for (let i = 0; i < s.cap && j < this.models.length; i++) {
      if (!s.active[i]) continue;
      const m = this.models[j++];
      m.root.position.set(s.px[i], 0, s.pz[i]);
      if (s.moving[i]) m.root.rotation.y = Math.atan2(s.hx[i], s.hz[i]);
      m.mixer.update(dt);
    }
  }
}
