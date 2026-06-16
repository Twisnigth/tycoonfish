import * as THREE from 'three';
import type { TankState } from '../core/GameState';
import { getFish } from '../data/fish';
import { getFishGeometry } from './MeshRegistry';
import { createWaterMaterial } from './WaterMaterial';
import { decorModelUrl, fishModelUrl, loadFishHero, loadInstanceParts, loadObject } from './AssetLoader';
import { biomeWaterColor } from '../data/biomes';
import { tankDecorModel } from '../data/tankDecor';
import { GRID } from '../world/Grid';

/** Facteur d'échelle global des poissons GLB (normalisés en unité). */
const FISH_RENDER_SCALE = 0.7;

const WALL_MARGIN = 0.35;

interface Agent {
  archetype: string;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  scale: number;
  color: THREE.Color;
  speciesId: string;
  phase: number; // déphasage pour l'animation de nage
}

/** Grosse créature rendue comme objet individuel (GLB animé), hors InstancedMesh. */
interface Hero {
  fishId: string;
  speciesId: string;
  root: THREE.Object3D | null;
  mixer: THREE.AnimationMixer | null;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  phase: number;
}

/** Une créature est « vedette » (rendu individuel animé) à partir de cette classe de taille. */
const HERO_SIZE_CLASS = 3;

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _swish = new THREE.Quaternion();
const _up = new THREE.Vector3(0, 1, 0);
const _roll = new THREE.Vector3(0, 0, 1);
const _fwd = new THREE.Vector3(0, 0, 1);
const _scale = new THREE.Vector3();
const _posTmp = new THREE.Vector3();

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
  /** Décors 3D placés par le joueur à l'intérieur du bac. */
  private decorObjs: THREE.Object3D[] = [];
  private decorKey = '';
  /** Grosses créatures rendues individuellement (GLB animé). */
  private heroes: Hero[] = [];
  private heroKey = '';

  constructor(
    private tank: TankState,
    private footW = 2,
    private footH = 2,
  ) {
    this.water = createWaterMaterial(biomeWaterColor(tank.biome));
    this.bubbleVel = new Float32Array(0);
    this.build();
    this.syncSchool();
    this.syncHeroes();
    void this.addDecor();
    void this.syncPlayerDecor();
  }

  private isHero(species: string): boolean {
    return (getFish(species)?.sizeClass ?? 1) >= HERO_SIZE_CLASS;
  }

  /** (Re)construit les décors intérieurs placés par le joueur (tank.decor). */
  private async syncPlayerDecor(): Promise<void> {
    const key = this.tank.decor.join('|');
    if (key === this.decorKey) return;
    this.decorKey = key;

    for (const o of this.decorObjs) this.group.remove(o);
    this.decorObjs = [];

    const s = this.size();
    const floorY = -s.y / 2 + 0.1;
    const builtAt = this.builtVolume;
    const list = [...this.tank.decor];
    for (let i = 0; i < list.length; i++) {
      const angle = (i / Math.max(1, list.length)) * Math.PI * 2;
      const r = Math.min(s.x, s.z) * 0.3;
      const obj = await loadObject(decorModelUrl(tankDecorModel(list[i])), Math.min(s.y * 0.45, 1.1));
      // Bac reconstruit / décor changé entre-temps → on abandonne ce chargement.
      if (!obj || this.builtVolume !== builtAt || this.decorKey !== key) continue;
      obj.position.set(Math.cos(angle) * r, floorY, Math.sin(angle) * r);
      obj.rotation.y = Math.random() * Math.PI * 2;
      obj.renderOrder = 1;
      this.decorObjs.push(obj);
      this.group.add(obj);
    }
  }

  /** Place quelques décors GLB au sol du bac (selon le biome). */
  private async addDecor(): Promise<void> {
    const s = this.size();
    const floorY = -s.y / 2 + 0.09;
    const byBiome: Record<string, string[]> = {
      coldwater: ['kelp', 'rock'], deepsea: ['rock', 'kelp'], abyssal: ['rock', 'rock'],
      reef: ['coral', 'coral'], mythic: ['coral', 'rock'], tropical: ['coral', 'rock'],
    };
    const picks = byBiome[this.tank.biome] ?? ['coral', 'rock'];
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

  /** Taille du bac calée sur son EMPRISE réelle (un 4×4 mythique est vraiment grand). */
  private size(): THREE.Vector3 {
    const w = this.footW * GRID.cell * 0.94;
    const d = this.footH * GRID.cell * 0.94;
    const h = Math.max(2.4, Math.min(w, d) * 0.85);
    return new THREE.Vector3(w, h, d);
  }

  /** Hauteur à laquelle poser le groupe pour que le fond touche le sol. */
  get groundY(): number {
    return this.size().y / 2;
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

  /** Signature de population (petits poissons uniquement) : change à tout ajout/retrait. */
  private computePopKey(): string {
    return this.tank.fish
      .filter((f) => !this.isHero(f.species))
      .map((f) => f.species)
      .sort()
      .join('|');
  }

  /** (Re)construit le banc rendu — STRICTEMENT 1:1 (un poisson = une instance). Petits poissons seulement. */
  syncSchool(): void {
    const key = this.computePopKey();
    if (key === this.popKey) return;
    this.popKey = key;

    this.agents = [];
    for (const fish of this.tank.fish) {
      if (this.isHero(fish.species)) continue; // les grosses créatures = rendu individuel
      const sp = getFish(fish.species);
      if (!sp) continue;
      this.agents.push({
        archetype: sp.modelRef,
        speciesId: fish.species,
        phase: Math.random() * Math.PI * 2,
        scale: sp.scale * FISH_RENDER_SCALE * fish.genes.size * (0.85 + Math.random() * 0.3),
        color: new THREE.Color(sp.tint),
        pos: new THREE.Vector3(
          (Math.random() - 0.5) * this.inner.x,
          (Math.random() - 0.5) * this.inner.y,
          (Math.random() - 0.5) * this.inner.z,
        ),
        vel: new THREE.Vector3(Math.random() - 0.5, (Math.random() - 0.5) * 0.3, Math.random() - 0.5)
          .normalize()
          .multiplyScalar(0.6),
      });
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

  /** (Re)construit les grosses créatures : un objet GLB individuel (animé) chacune. */
  private syncHeroes(): void {
    const heroFish = this.tank.fish.filter((f) => this.isHero(f.species));
    const key = heroFish.map((f) => f.id).sort().join('|');
    if (key === this.heroKey) return;
    this.heroKey = key;

    for (const h of this.heroes) {
      if (h.root) this.group.remove(h.root);
      h.mixer?.stopAllAction();
    }
    this.heroes = [];

    const s = this.size();
    const innerMin = Math.min(s.x, s.z) - WALL_MARGIN * 2;
    for (const fish of heroFish) {
      const sp = getFish(fish.species);
      if (!sp) continue;
      const targetSize = Math.min(sp.scale * fish.genes.size * 1.7, innerMin * 0.78);
      const hero: Hero = {
        fishId: fish.id,
        speciesId: fish.species,
        root: null,
        mixer: null,
        phase: Math.random() * Math.PI * 2,
        pos: new THREE.Vector3(
          (Math.random() - 0.5) * this.inner.x * 0.5,
          (Math.random() - 0.5) * this.inner.y * 0.4,
          (Math.random() - 0.5) * this.inner.z * 0.5,
        ),
        vel: new THREE.Vector3(Math.random() - 0.5, 0, Math.random() - 0.5).normalize().multiplyScalar(0.32),
      };
      this.heroes.push(hero);
      const builtAt = this.builtVolume;
      void loadFishHero(fishModelUrl(fish.species), targetSize).then((fh) => {
        if (this.heroKey !== key || this.builtVolume !== builtAt) return; // bac/population changé
        if (fh) {
          hero.root = fh.root;
          hero.mixer = fh.mixer;
        } else {
          // Pas de GLB → mesh procédural unique teinté, dimensionné comme la vedette.
          const mat = new THREE.MeshStandardMaterial({ color: new THREE.Color(sp.tint), flatShading: true });
          const mesh = new THREE.Mesh(getFishGeometry(sp.modelRef), mat);
          mesh.scale.setScalar(targetSize);
          mesh.castShadow = true;
          hero.root = mesh;
        }
        hero.root.position.copy(hero.pos);
        this.group.add(hero.root);
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
        // Animation de nage : frétillement (lacet) + roulis + respiration + ondulation.
        const t2 = time + a.phase;
        _swish.setFromAxisAngle(_up, Math.sin(t2 * 6) * 0.22);
        _q.multiply(_swish);
        _swish.setFromAxisAngle(_roll, Math.sin(t2 * 4) * 0.12);
        _q.multiply(_swish);
        const breathe = a.scale * (1 + Math.sin(t2 * 3) * 0.05);
        _scale.set(breathe, breathe, breathe);
        _posTmp.copy(a.pos);
        _posTmp.y += Math.sin(t2 * 2) * 0.06 * a.scale;
        _m.compose(_posTmp, _q, _scale);
        mesh.setMatrixAt(i, _m);
      }
      mesh.instanceMatrix.needsUpdate = true;
    }

    // Grosses créatures (objets individuels) : nage lente + animation.
    for (const h of this.heroes) {
      if (!h.root) continue;
      h.vel.x += (Math.random() - 0.5) * dt * 0.5;
      h.vel.y += (Math.random() - 0.5) * dt * 0.15;
      h.vel.z += (Math.random() - 0.5) * dt * 0.5;
      if (Math.abs(h.pos.x) > half.x) h.vel.x -= Math.sign(h.pos.x) * dt * 2;
      if (Math.abs(h.pos.y) > half.y * 0.6) h.vel.y -= Math.sign(h.pos.y) * dt * 2;
      if (Math.abs(h.pos.z) > half.z) h.vel.z -= Math.sign(h.pos.z) * dt * 2;
      const hs = h.vel.length();
      if (hs > 0.55) h.vel.multiplyScalar(0.55 / hs);
      h.pos.addScaledVector(h.vel, dt);
      h.root.position.copy(h.pos);
      if (h.vel.lengthSq() > 1e-4) {
        h.root.quaternion.setFromUnitVectors(_fwd, _posTmp.copy(h.vel).normalize());
      }
      if (h.mixer) {
        h.mixer.update(dt); // animation squelettique du GLB (léviathan & co)
      } else {
        // Pas de clip : ondulation procédurale pour donner vie (kraken).
        const t2 = time + h.phase;
        _swish.setFromAxisAngle(_up, Math.sin(t2 * 2.5) * 0.16);
        h.root.quaternion.multiply(_swish);
        h.root.position.y += Math.sin(t2 * 1.5) * 0.12;
      }
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
      this.heroKey = ''; // force la reconstruction des vedettes
      this.decorKey = ''; // force la reconstruction des décors
      this.syncSchool();
      this.syncHeroes();
      void this.addDecor();
      void this.syncPlayerDecor();
      this.triggerBounce();
      return;
    }
    this.syncSchool();
    this.syncHeroes();
    void this.syncPlayerDecor();
  }

  dispose(): void {
    for (const mesh of this.meshes.values()) mesh.dispose();
    for (const h of this.heroes) { if (h.root) this.group.remove(h.root); h.mixer?.stopAllAction(); }
    this.water.dispose();
    this.bubbles.geometry.dispose();
    (this.bubbles.material as THREE.Material).dispose();
  }
}
