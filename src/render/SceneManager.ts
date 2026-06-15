import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { Game } from '../core/Game';
import { TankView } from './TankView';
import { characterUrl, loadAnimated } from './AssetLoader';

/**
 * Gère la scène 3D : renderer, caméra orthographique ISOMÉTRIQUE (fixe, avec
 * léger zoom + pan borné), éclairage doux + ombres nettes, et l'ensemble des
 * TankView. Tourne dans sa propre boucle rAF — jamais piloté par React.
 */
export class SceneManager {
  readonly scene = new THREE.Scene();
  readonly camera: THREE.OrthographicCamera;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly controls: OrbitControls;

  private tankViews = new Map<string, TankView>();
  private mixers: THREE.AnimationMixer[] = [];
  private camOffset = new THREE.Vector3();
  private panLimit = 8;
  private frustum = 14;
  private time = 0;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly game: Game,
  ) {
    this.scene.background = new THREE.Color(0xeaf4f7); // pastel doux

    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    const aspect = w / h || 1;
    this.camera = new THREE.OrthographicCamera(
      (-this.frustum * aspect) / 2,
      (this.frustum * aspect) / 2,
      this.frustum / 2,
      -this.frustum / 2,
      0.1,
      1000,
    );
    this.camera.position.set(20, 18, 20); // angle iso
    this.camera.lookAt(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(w, h, false);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;

    this.setupLights();
    this.setupGround();

    // Contrôles : pas de rotation (caméra iso fixe), zoom + pan uniquement.
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableRotate = false;
    this.controls.screenSpacePanning = true;
    this.controls.minZoom = 0.6;
    this.controls.maxZoom = 2.5;
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.12;
    this.camOffset.copy(this.camera.position).sub(this.controls.target);

    this.syncTanks();
    this.bindEvents();
    void this.loadCharacters();

    window.addEventListener('resize', this.onResize);
  }

  /** Charge le curateur + visiteurs (riggés) et joue leur animation idle. */
  private async loadCharacters(): Promise<void> {
    const placements: Array<{ id: string; pos: [number, number, number]; rotY: number; h: number }> = [
      { id: 'curator', pos: [-2.8, -1.6, 5.5], rotY: Math.PI * 0.92, h: 1.85 },
      { id: 'visitor', pos: [2.6, -1.6, 6.2], rotY: Math.PI * 1.08, h: 1.7 },
      { id: 'visitor', pos: [5.2, -1.6, 4.2], rotY: Math.PI * 1.2, h: 1.62 },
    ];
    for (const p of placements) {
      const m = await loadAnimated(characterUrl(p.id), p.h);
      if (!m) continue;
      m.root.position.set(...p.pos);
      m.root.rotation.y = p.rotY;
      this.scene.add(m.root);
      this.mixers.push(m.mixer);
    }
  }

  private setupLights(): void {
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.85)); // éclairage global doux

    const dir = new THREE.DirectionalLight(0xfff4e0, 1.1);
    dir.position.set(12, 20, 8);
    dir.castShadow = true;
    dir.shadow.mapSize.set(1024, 1024);
    const c = dir.shadow.camera;
    c.left = -20; c.right = 20; c.top = 20; c.bottom = -20; c.near = 0.5; c.far = 80;
    this.scene.add(dir);

    // Lumière d'appoint froide pour le contraste pastel.
    const fill = new THREE.DirectionalLight(0xbfe3ff, 0.3);
    fill.position.set(-10, 6, -8);
    this.scene.add(fill);
  }

  private setupGround(): void {
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(80, 80),
      new THREE.MeshStandardMaterial({ color: 0xdfeaee, flatShading: true }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -1.6;
    ground.receiveShadow = true;
    this.scene.add(ground);
  }

  /** Crée/positionne les TankView manquants pour coller à l'état du jeu. */
  private syncTanks(): void {
    const tanks = this.game.state.tanks;
    tanks.forEach((tank, i) => {
      let view = this.tankViews.get(tank.id);
      if (!view) {
        view = new TankView(tank);
        this.tankViews.set(tank.id, view);
        this.scene.add(view.group);
      }
      // Disposition en grille simple (extensible aux dômes/monorails plus tard).
      const cols = Math.ceil(Math.sqrt(tanks.length));
      const gx = (i % cols) - (cols - 1) / 2;
      const gz = Math.floor(i / cols) - (cols - 1) / 2;
      view.group.position.set(gx * 6, 0, gz * 6);
      this.panLimit = Math.max(8, cols * 4);
    });
  }

  private bindEvents(): void {
    this.game.events.on('tierUp', () => {
      for (const v of this.tankViews.values()) v.triggerBounce();
    });
    this.game.events.on('fishCaught', ({ tankId }) => {
      this.tankViews.get(tankId)?.refreshIfChanged();
    });
    this.game.events.on('purchase', ({ kind, id }) => {
      if (kind === 'tank') this.syncTanks();
      else if (kind === 'expand') this.tankViews.get(id)?.refreshIfChanged();
    });
  }

  /** Boucle de rendu (appelée par GameLoop avec un dt lissé). */
  render(dt: number): void {
    this.time += dt;

    // Pan borné : on clampe la cible puis on replace la caméra à offset constant.
    const t = this.controls.target;
    t.x = THREE.MathUtils.clamp(t.x, -this.panLimit, this.panLimit);
    t.z = THREE.MathUtils.clamp(t.z, -this.panLimit, this.panLimit);
    t.y = 0;
    this.camera.position.copy(t).add(this.camOffset);
    this.controls.update();

    for (const v of this.tankViews.values()) v.update(dt, this.time);
    for (const m of this.mixers) m.update(dt);

    this.renderer.render(this.scene, this.camera);
  }

  private onResize = (): void => {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    const aspect = w / h || 1;
    this.camera.left = (-this.frustum * aspect) / 2;
    this.camera.right = (this.frustum * aspect) / 2;
    this.camera.top = this.frustum / 2;
    this.camera.bottom = -this.frustum / 2;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
  };

  dispose(): void {
    window.removeEventListener('resize', this.onResize);
    this.controls.dispose();
    for (const v of this.tankViews.values()) v.dispose();
    this.renderer.dispose();
  }
}
