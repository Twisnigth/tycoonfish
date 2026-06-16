import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { Game } from '../core/Game';
import { GRID, Tile } from '../world/Grid';
import { BUILDINGS, isPathType, type BuildingType } from '../data/buildings';
import { GridView } from './GridView';
import { Environment } from './Environment';
import { AgentRenderer } from './AgentRenderer';
import { TankView } from './TankView';
import { buildingModelUrl, decorModelUrl, loadObject } from './AssetLoader';
import { useUiStore, type Tool } from '../store/uiStore';
import type { PlacedBuilding } from '../core/GameState';

interface BuildingView {
  obj: THREE.Object3D;
  tank?: TankView;
}

/**
 * Scène 3D du parc : caméra ortho iso, sol+grille, bâtiments (bacs via TankView,
 * autres via GLB), chemins instanciés, foule, et MODE CONSTRUCTION (raycasting,
 * snapping, fantôme de validation). Tourne dans sa propre boucle rAF.
 */
export class SceneManager {
  readonly scene = new THREE.Scene();
  readonly camera: THREE.OrthographicCamera;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly controls: OrbitControls;

  private readonly gridView = new GridView();
  private readonly agentRenderer: AgentRenderer;
  private readonly views = new Map<string, BuildingView>();
  private pathMesh: THREE.InstancedMesh | null = null;

  private readonly ghost: THREE.Mesh;
  private readonly ray = new THREE.Raycaster();
  private readonly groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private readonly pointer = new THREE.Vector2();
  private hoverCell: { x: number; y: number } | null = null;
  private downPos: { x: number; y: number } | null = null;

  private camOffset = new THREE.Vector3();
  private frustum = 30;
  private panLimit = 44;
  private time = 0;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly game: Game,
  ) {
    this.scene.background = new THREE.Color(0xdfeef0);
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    const aspect = w / h || 1;
    this.camera = new THREE.OrthographicCamera(
      (-this.frustum * aspect) / 2, (this.frustum * aspect) / 2,
      this.frustum / 2, -this.frustum / 2, 0.1, 2000,
    );
    this.camera.position.set(40, 38, 40);
    this.camera.lookAt(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(w, h, false);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;

    this.setupLights();
    this.scene.add(new Environment().group);
    this.scene.add(this.gridView.group);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableRotate = false;
    this.controls.screenSpacePanning = true;
    this.controls.minZoom = 0.4;
    this.controls.maxZoom = 3.5;
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.12;
    this.camOffset.copy(this.camera.position).sub(this.controls.target);

    // Fantôme de construction.
    this.ghost = new THREE.Mesh(
      new THREE.BoxGeometry(1, 0.5, 1),
      new THREE.MeshBasicMaterial({ color: 0x4caf82, transparent: true, opacity: 0.45, depthWrite: false }),
    );
    this.ghost.visible = false;
    this.scene.add(this.ghost);

    this.agentRenderer = new AgentRenderer(this.scene, game.agents);

    this.syncWorld();
    this.game.events.on('worldChanged', () => this.syncWorld());
    this.game.events.on('tankUpdated', ({ buildingId }) => this.views.get(buildingId)?.tank?.refreshIfChanged());

    useUiStore.subscribe((s) => this.gridView.setBuildMode(s.tool !== null));

    canvas.addEventListener('pointermove', this.onPointerMove);
    canvas.addEventListener('pointerdown', this.onPointerDown);
    canvas.addEventListener('pointerup', this.onPointerUp);
    window.addEventListener('resize', this.onResize);
  }

  private setupLights(): void {
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.85));
    const dir = new THREE.DirectionalLight(0xfff4e0, 1.1);
    dir.position.set(30, 50, 20);
    dir.castShadow = true;
    dir.shadow.mapSize.set(2048, 2048);
    const c = dir.shadow.camera;
    c.left = -60; c.right = 60; c.top = 60; c.bottom = -60; c.near = 1; c.far = 160;
    this.scene.add(dir);
    const fill = new THREE.DirectionalLight(0xbfe3ff, 0.3);
    fill.position.set(-20, 20, -15);
    this.scene.add(fill);
  }

  // ---- Synchronisation monde ↔ vues -------------------------------------

  private worldCenter(b: PlacedBuilding): THREE.Vector3 {
    const def = BUILDINGS[b.type];
    const a = this.game.grid.gridToWorld(b.gx, b.gy);
    const d = this.game.grid.gridToWorld(b.gx + def.w - 1, b.gy + def.h - 1);
    return new THREE.Vector3((a.x + d.x) / 2, 0, (a.z + d.z) / 2);
  }

  private syncWorld(): void {
    this.gridView.updateOwned(this.game.grid);
    const buildings = this.game.state.buildings;
    const live = new Set<string>();

    for (const b of buildings) {
      if (isPathType(b.type)) continue;
      live.add(b.id);
      if (this.views.has(b.id)) continue;
      this.addBuildingView(b);
    }
    for (const [id, view] of this.views) {
      if (!live.has(id)) {
        this.scene.remove(view.obj);
        view.tank?.dispose();
        this.views.delete(id);
      }
    }
    this.rebuildPaths();
  }

  private addBuildingView(b: PlacedBuilding): void {
    const def = BUILDINGS[b.type];
    const center = this.worldCenter(b);

    if (def.render.kind === 'tank' && b.tank) {
      const tank = new TankView(b.tank);
      tank.group.position.set(center.x, Math.cbrt(b.tank.volume) * 1.05 * 0.82 * 0.5, center.z);
      this.scene.add(tank.group);
      this.views.set(b.id, { obj: tank.group, tank });
      return;
    }

    const placeholder = new THREE.Group();
    placeholder.position.copy(center);
    this.scene.add(placeholder);
    this.views.set(b.id, { obj: placeholder });

    const size = def.modelSize;
    const url =
      def.render.kind === 'decor'
        ? decorModelUrl(def.render.model)
        : def.render.kind === 'building'
          ? buildingModelUrl(def.render.model)
          : buildingModelUrl('entrance');

    void loadObject(url, size).then((obj) => {
      if (!obj || this.views.get(b.id)?.obj !== placeholder) return;
      placeholder.add(obj);
    });
  }

  private rebuildPaths(): void {
    if (this.pathMesh) {
      this.scene.remove(this.pathMesh);
      this.pathMesh.dispose();
      this.pathMesh = null;
    }
    const g = this.game.grid;
    const cells: number[] = [];
    for (let i = 0; i < g.tile.length; i++) if (g.tile[i] === Tile.Path) cells.push(i);
    if (cells.length === 0) return;

    const geo = new THREE.BoxGeometry(GRID.cell * 0.98, 0.1, GRID.cell * 0.98);
    const mat = new THREE.MeshStandardMaterial({ flatShading: true });
    const mesh = new THREE.InstancedMesh(geo, mat, cells.length);
    mesh.receiveShadow = true;
    const m = new THREE.Matrix4();
    const col = new THREE.Color();
    const buildings = this.game.state.buildings;
    cells.forEach((cell, k) => {
      const w = g.gridToWorld(cell % g.w, (cell / g.w) | 0);
      m.makeTranslation(w.x, 0.05, w.z);
      mesh.setMatrixAt(k, m);
      const b = buildings[g.occupant[cell]];
      mesh.setColorAt(k, col.setHex(b ? BUILDINGS[b.type].tint ?? 0xd8c9a0 : 0xd8c9a0));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    this.pathMesh = mesh;
    this.scene.add(mesh);
  }

  // ---- Interaction / build mode -----------------------------------------

  private updatePointer(e: PointerEvent): void {
    const r = this.canvas.getBoundingClientRect();
    this.pointer.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    this.pointer.y = -((e.clientY - r.top) / r.height) * 2 + 1;
  }

  private cellUnderPointer(): { x: number; y: number } | null {
    this.ray.setFromCamera(this.pointer, this.camera);
    const hit = new THREE.Vector3();
    if (!this.ray.ray.intersectPlane(this.groundPlane, hit)) return null;
    const cell = this.game.grid.worldToGrid(hit.x, hit.z);
    return this.game.grid.inBounds(cell.x, cell.y) ? cell : null;
  }

  private onPointerMove = (e: PointerEvent): void => {
    this.updatePointer(e);
    this.hoverCell = this.cellUnderPointer();
  };

  private onPointerDown = (e: PointerEvent): void => {
    this.downPos = { x: e.clientX, y: e.clientY };
  };

  private onPointerUp = (e: PointerEvent): void => {
    if (!this.downPos) return;
    const moved = Math.hypot(e.clientX - this.downPos.x, e.clientY - this.downPos.y);
    this.downPos = null;
    if (moved > 6) return; // c'était un pan, pas un clic
    this.updatePointer(e);
    const cell = this.cellUnderPointer();
    if (!cell) return;
    const tool = useUiStore.getState().tool;
    this.act(tool, cell.x, cell.y);
  };

  private act(tool: Tool, x: number, y: number): void {
    if (tool === null) {
      const b = this.game.buildingAt(x, y);
      const selectable = b && (b.tank || b.salePrice !== undefined);
      useUiStore.getState().select(selectable ? b!.id : null);
      return;
    }
    if (tool === 'remove') {
      this.game.removeBuildingAt(x, y);
      return;
    }
    if (tool === 'plot') {
      this.game.buyPlotAt(x, y);
      return;
    }
    this.game.placeBuilding(tool, x, y);
  }

  private updateGhost(): void {
    const tool = useUiStore.getState().tool;
    if (!this.hoverCell || tool === null || tool === 'remove') {
      this.ghost.visible = false;
      return;
    }
    const { x, y } = this.hoverCell;
    let w = 1;
    let h = 1;
    let ok: boolean;
    if (tool === 'plot') {
      w = GRID.plot; h = GRID.plot;
      const ox = Math.floor(x / GRID.plot) * GRID.plot;
      const oy = Math.floor(y / GRID.plot) * GRID.plot;
      ok = !this.game.grid.isOwned(x, y) && this.game.state.money.gte(this.game.plotCost());
      this.placeGhost(ox, oy, w, h, ok);
      return;
    }
    const def = BUILDINGS[tool as BuildingType];
    w = def.w; h = def.h;
    ok = this.game.canPlace(tool as BuildingType, x, y) && this.game.state.money.gte(def.cost);
    this.placeGhost(x, y, w, h, ok);
  }

  private placeGhost(gx: number, gy: number, w: number, h: number, ok: boolean): void {
    const a = this.game.grid.gridToWorld(gx, gy);
    const d = this.game.grid.gridToWorld(gx + w - 1, gy + h - 1);
    this.ghost.visible = true;
    this.ghost.position.set((a.x + d.x) / 2, 0.3, (a.z + d.z) / 2);
    this.ghost.scale.set(w * GRID.cell * 0.98, 1, h * GRID.cell * 0.98);
    (this.ghost.material as THREE.MeshBasicMaterial).color.setHex(ok ? 0x4caf82 : 0xe0617a);
  }

  // ---- Boucle de rendu ---------------------------------------------------

  render(dt: number): void {
    this.time += dt;
    const t = this.controls.target;
    t.x = THREE.MathUtils.clamp(t.x, -this.panLimit, this.panLimit);
    t.z = THREE.MathUtils.clamp(t.z, -this.panLimit, this.panLimit);
    t.y = 0;
    this.camera.position.copy(t).add(this.camOffset);
    this.controls.update();

    this.game.simulateAgents(dt);
    for (const v of this.views.values()) v.tank?.update(dt, this.time);
    this.agentRenderer.update();
    this.updateGhost();

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
}
