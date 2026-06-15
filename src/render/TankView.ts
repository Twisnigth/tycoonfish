import * as THREE from 'three';
import type { TankState } from '../core/GameState';
import { getFish } from '../data/fish';
import { getFishGeometry } from './MeshRegistry';
import { createWaterMaterial } from './WaterMaterial';
import { decorModelUrl, fishModelUrl, loadInstanceParts, loadObject } from './AssetLoader';

/** Facteur d'échelle global des poissons GLB (normalisés en unité). */
const FISH_RENDER_SCALE = 0.7;

/** Nombre MAX d'individus rendus par bac (la quantité économique est découplée). */
const RENDER_CAP = 40;
const WALL_MARGIN = 0.35;

interface Agent {
  archetype: string;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  scale: number;
  color: THREE.Color;
  speciesId: string;
}

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _fwd = new THREE.Vector3(0, 0, 1);
const _scale = new THREE.Vector3();

/**
 * Représentation 3D d'un bac. Détient le verre, l'eau (shader), le sol, les
 * bulles et un banc de poissons rendu en InstancedMesh (un par archétype).
 * Le mouvement est un boids-lite : errance + évitement des parois.
 */
export class TankView {
  readonly group = new THREE.Group();
  private readonly water: THREE.ShaderMaterial;
  private inner = new THREE.Vector3(2, 1.6, 2);

  private agents: Agent[] = [];
  private meshes = new Map<string, THREE.InstancedMesh>();
  private bubbles!: THREE.Points;
  private bubbleVel: Float32Array;

  /** Signature de population pour détecter les changements et reconstruire. */
  private popKey = '';
  /** Animation de transition (scale bounce) au franchissement de palier. */
  private bounce = 0;
  /** Volume utilisé pour construire la géométrie statique courante. */
  private builtVolume = 0;
  /** Éléments statiques (verre/eau/sol/bulles) — disposables au rebuild. */
  private statics: THREE.Object3D[] = [];

  constructor(private tank: TankState) {
    this.water = createWaterMaterial(0x3fa9c9);
    this.bubbleVel = new Float32Array(0);
    this.build();
    this.syncSchool();
    void this.addDecor();
  }

  /** Place quelques décors GLB au sol du bac (selon le biome). */
  private async addDecor(): Promise<void> {
    const s = this.size();
    const floorY = -s.y / 2 + 0.09;
    const picks = this.tank.biome === 'coldwater' ? ['kelp', 'rock'] : ['coral', 'rock'];
    const spots = [
      new THREE.Vector3(-s.x * 0.28, floorY, s.z * 0.2),
      new THREE.Vector3(s.x * 0.3, floorY, -s.z * 0.18),
    ];
    for (let i = 0; i < picks.length; i++) {
      const obj = await loadObject(decorModelUrl(picks[i]), Math.min(s.y * 0.5, 1.3));
      if (!obj || this.tank.volume !== this.builtVolume) continue; // bac reconstruit entre-temps
      obj.position.copy(spots[i]);
      obj.rotation.y = Math.random() * Math.PI * 2;
      obj.renderOrder = 1;
      this.statics.push(obj);
      this.group.add(obj);
    }
  }

  private size(): THREE.Vector3 {
    const side = Math.cbrt(this.tank.volume) * 1.05;
    return new THREE.Vector3(side, side * 0.82, side);
  }

  private build(): void {
    // Purge des éléments statiques précédents (cas d'un agrandissement).
    for (const o of this.statics) {
      this.group.remove(o);
      if (o instanceof THREE.Mesh || o instanceof THREE.LineSegments || o instanceof THREE.Points) {
        o.geometry.dispose();
      }
    }
    this.statics = [];

    const s = this.size();
    this.builtVolume = this.tank.volume;
    this.inner.set(s.x - WALL_MARGIN, s.y - WALL_MARGIN, s.z - WALL_MARGIN);

    // Sol (sable) low-poly.
    const floor = new THREE.Mesh(
      new THREE.BoxGeometry(s.x, 0.18, s.z),
      new THREE.MeshStandardMaterial({ color: 0xe8d9a8, flatShading: true }),
    );
    floor.position.y = -s.y / 2;
    floor.receiveShadow = true;
    this.group.add(floor);
    this.statics.push(floor);

    // Volume d'eau (shader).
    const waterMesh = new THREE.Mesh(new THREE.BoxGeometry(s.x, s.y, s.z), this.water);
    waterMesh.renderOrder = 2;
    this.group.add(waterMesh);
    this.statics.push(waterMesh);

    // Cadre de verre (arêtes claires, esprit Monument Valley).
    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(s.x, s.y, s.z)),
      new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6 }),
    );
    this.group.add(edges);
    this.statics.push(edges);

    // Bulles procédurales.
    const n = 28;
    const positions = new Float32Array(n * 3);
    this.bubbleVel = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      positions[i * 3] = (Math.random() - 0.5) * this.inner.x;
      positions[i * 3 + 1] = (Math.random() - 0.5) * this.inner.y;
      positions[i * 3 + 2] = (Math.random() - 0.5) * this.inner.z;
      this.bubbleVel[i] = 0.15 + Math.random() * 0.25;
    }
    const bgeo = new THREE.BufferGeometry();
    bgeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.bubbles = new THREE.Points(
      bgeo,
      new THREE.PointsMaterial({ color: 0xffffff, size: 0.07, transparent: true, opacity: 0.5 }),
    );
    this.bubbles.renderOrder = 3;
    this.group.add(this.bubbles);
    this.statics.push(this.bubbles);
  }

  /** Recalcule la signature de population du bac. */
  private computePopKey(): string {
    return Object.entries(this.tank.fish)
      .filter(([, n]) => n > 0)
      .map(([id, n]) => `${id}:${n}`)
      .sort()
      .join('|');
  }

  /** (Re)construit le banc rendu à partir de la population économique (capée). */
  syncSchool(): void {
    const key = this.computePopKey();
    if (key === this.popKey) return;
    this.popKey = key;

    // Population économique totale.
    const entries = Object.entries(this.tank.fish).filter(([, n]) => n > 0);
    const total = entries.reduce((a, [, n]) => a + n, 0);

    // Combien d'individus VISUELS par espèce (proportionnel, plafonné).
    this.agents = [];
    for (const [id, count] of entries) {
      const sp = getFish(id);
      if (!sp) continue;
      const visual = total > 0 ? Math.max(1, Math.round((count / total) * RENDER_CAP)) : 0;
      for (let i = 0; i < visual; i++) {
        this.agents.push({
          archetype: sp.modelRef,
          speciesId: id,
          scale: sp.scale * FISH_RENDER_SCALE * (0.85 + Math.random() * 0.3),
          color: new THREE.Color(sp.tint),
          pos: new THREE.Vector3(
            (Math.random() - 0.5) * this.inner.x,
            (Math.random() - 0.5) * this.inner.y,
            (Math.random() - 0.5) * this.inner.z,
          ),
          vel: new THREE.Vector3(
            (Math.random() - 0.5),
            (Math.random() - 0.5) * 0.3,
            (Math.random() - 0.5),
          ).normalize().multiplyScalar(0.6),
        });
      }
    }

    this.rebuildMeshes();
  }

  private rebuildMeshes(): void {
    // Géométries/matériaux sont mis en cache (MeshRegistry / AssetLoader) et
    // partagés entre bacs → on ne dispose que les buffers d'instance du mesh.
    for (const mesh of this.meshes.values()) {
      this.group.remove(mesh);
      mesh.dispose();
    }
    this.meshes.clear();

    // Un InstancedMesh PAR ESPÈCE (chaque espèce a son propre modèle GLB).
    const bySpecies = new Map<string, Agent[]>();
    for (const a of this.agents) {
      let arr = bySpecies.get(a.speciesId);
      if (!arr) bySpecies.set(a.speciesId, (arr = []));
      arr.push(a);
    }

    for (const [speciesId, group] of bySpecies) {
      // 1) Fallback procédural immédiat (cône low-poly teinté) le temps du chargement.
      const mat = new THREE.MeshStandardMaterial({ color: group[0].color, flatShading: true });
      const mesh: THREE.InstancedMesh = new THREE.InstancedMesh(
        getFishGeometry(group[0].archetype),
        mat,
        group.length,
      );
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.castShadow = true;
      mesh.userData.agents = group;
      this.meshes.set(speciesId, mesh);
      this.group.add(mesh);

      // 2) Remplacement asynchrone par le GLB texturé (géométrie + matériau).
      loadInstanceParts(fishModelUrl(speciesId)).then((parts) => {
        if (!parts || this.meshes.get(speciesId) !== mesh) return; // banc reconstruit entre-temps
        mesh.geometry = parts.geometry;
        mesh.material = parts.material;
      });
    }
  }

  /** Déclenche l'animation de transition (scale bounce) lors d'un palier. */
  triggerBounce(): void {
    this.bounce = 1;
  }

  /** Mise à jour visuelle par frame (`dt` en secondes). */
  update(dt: number, time: number): void {
    this.water.uniforms.uTime.value = time;

    // Boids-lite : errance + retour vers le centre près des parois.
    const half = this.inner.clone().multiplyScalar(0.5);
    for (const mesh of this.meshes.values()) {
      const group = mesh.userData.agents as Agent[];
      for (let i = 0; i < group.length; i++) {
        const a = group[i];
        // Steering aléatoire doux.
        a.vel.x += (Math.random() - 0.5) * dt * 1.2;
        a.vel.y += (Math.random() - 0.5) * dt * 0.4;
        a.vel.z += (Math.random() - 0.5) * dt * 1.2;
        // Évitement des parois.
        if (Math.abs(a.pos.x) > half.x) a.vel.x -= Math.sign(a.pos.x) * dt * 3;
        if (Math.abs(a.pos.y) > half.y) a.vel.y -= Math.sign(a.pos.y) * dt * 3;
        if (Math.abs(a.pos.z) > half.z) a.vel.z -= Math.sign(a.pos.z) * dt * 3;
        // Vitesse bornée.
        const sp = a.vel.length();
        const max = 0.9;
        if (sp > max) a.vel.multiplyScalar(max / sp);
        a.pos.addScaledVector(a.vel, dt);

        // Orientation vers la direction de nage.
        if (a.vel.lengthSq() > 1e-4) {
          _q.setFromUnitVectors(_fwd, a.vel.clone().normalize());
        }
        _scale.setScalar(a.scale);
        _m.compose(a.pos, _q, _scale);
        mesh.setMatrixAt(i, _m);
      }
      mesh.instanceMatrix.needsUpdate = true;
    }

    // Bulles montantes.
    const pos = this.bubbles.geometry.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      let y = pos.getY(i) + this.bubbleVel[i] * dt;
      if (y > half.y) y = -half.y;
      pos.setY(i, y);
    }
    pos.needsUpdate = true;

    // Animation de transition de palier (ressort amorti).
    if (this.bounce > 0) {
      this.bounce = Math.max(0, this.bounce - dt * 2);
      const s = 1 + Math.sin(this.bounce * Math.PI) * 0.12;
      this.group.scale.setScalar(s);
    } else {
      this.group.scale.setScalar(1);
    }
  }

  /** Resynchronise la vue avec l'état : agrandissement et/ou population. */
  refreshIfChanged(): void {
    if (this.tank.volume !== this.builtVolume) {
      // Le bac a grandi : on reconstruit la géométrie statique + le banc.
      this.build();
      this.popKey = ''; // force la reconstruction du banc
      this.syncSchool();
      void this.addDecor();
      this.triggerBounce();
      return;
    }
    this.syncSchool();
  }

  dispose(): void {
    for (const mesh of this.meshes.values()) mesh.dispose();
    this.water.dispose();
    this.bubbles.geometry.dispose();
    (this.bubbles.material as THREE.Material).dispose();
  }
}
