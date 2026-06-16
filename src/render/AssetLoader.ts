import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';

/**
 * Chargeur/normaliseur d'assets GLB (générés via Higgsfield → image_to_3d).
 *  - Poissons / décors : on extrait UNE géométrie + matériau normalisés
 *    (centrés, mis à l'échelle unité, longueur orientée sur +Z) prêts pour
 *    l'InstancedMesh.
 *  - Personnages riggés : on charge la scène complète avec ses animations
 *    (squelette + AnimationMixer).
 * Tout est mis en cache et chargé paresseusement (lazy) — seul ce qui est à
 * l'écran est téléchargé, donc le poids total des GLB ne pénalise pas le boot.
 */

const BASE = import.meta.env.BASE_URL;
const loader = new GLTFLoader();

export const fishModelUrl = (speciesId: string): string => `${BASE}assets/models/fish_${speciesId}.glb`;
export const decorModelUrl = (id: string): string => `${BASE}assets/models/decor_${id}.glb`;
export const buildingModelUrl = (id: string): string => `${BASE}assets/models/building_${id}.glb`;
export const characterUrl = (id: string): string => `${BASE}assets/models/${id}.glb`;

export interface InstanceParts {
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
}

const partsCache = new Map<string, Promise<InstanceParts | null>>();
const objectCache = new Map<string, Promise<THREE.Object3D | null>>();

/**
 * Extrait géométrie + matériau d'un GLB, normalisés pour l'instanciation.
 * `forwardZ` (défaut true) oriente l'axe le plus long sur +Z (sens de nage des
 * poissons) ; à mettre à false pour les sujets verticaux (humanoïdes).
 */
export function loadInstanceParts(url: string, forwardZ = true): Promise<InstanceParts | null> {
  const key = `${url}|${forwardZ}`;
  let p = partsCache.get(key);
  if (!p) {
    p = loader
      .loadAsync(url)
      .then((gltf) => extractParts(gltf, forwardZ))
      .catch((e) => {
        console.warn('[AssetLoader] échec GLB', url, e);
        return null;
      });
    partsCache.set(key, p);
  }
  return p;
}

function extractParts(gltf: GLTF, forwardZ: boolean): InstanceParts | null {
  gltf.scene.updateMatrixWorld(true);
  const meshes: THREE.Mesh[] = [];
  gltf.scene.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh && m.geometry) meshes.push(m);
  });
  if (meshes.length === 0) return null;

  // Mesh le plus dense = corps principal.
  meshes.sort(
    (a, b) =>
      (b.geometry.attributes.position?.count ?? 0) - (a.geometry.attributes.position?.count ?? 0),
  );
  const src = meshes[0];
  const geo = src.geometry.clone();
  geo.applyMatrix4(src.matrixWorld); // fige la transform locale du GLB

  // Centre + oriente la longueur sur +Z + met à l'échelle unité.
  geo.computeBoundingBox();
  const bb = geo.boundingBox!;
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  bb.getSize(size);
  bb.getCenter(center);
  geo.translate(-center.x, -center.y, -center.z);
  if (forwardZ && size.x > size.z) geo.rotateY(Math.PI / 2); // axe long -> Z (sens de nage)
  const maxDim = Math.max(size.x, size.y, size.z) || 1;
  geo.scale(1 / maxDim, 1 / maxDim, 1 / maxDim);

  const mat = (Array.isArray(src.material) ? src.material[0] : src.material).clone();
  (mat as THREE.MeshStandardMaterial).side = THREE.FrontSide;
  return { geometry: geo, material: mat };
}

/**
 * Charge un GLB comme objet unique normalisé (décor) : centré au sol,
 * mis à l'échelle pour que sa plus grande dimension ≈ `targetSize`.
 */
export function loadObject(url: string, targetSize = 1.4): Promise<THREE.Object3D | null> {
  let p = objectCache.get(url);
  if (!p) {
    p = loader
      .loadAsync(url)
      .then((gltf) => normalizeObject(gltf.scene, targetSize))
      .catch((e) => {
        console.warn('[AssetLoader] échec décor', url, e);
        return null;
      });
    objectCache.set(url, p);
  }
  // On clone à chaque usage pour pouvoir placer plusieurs exemplaires.
  return p.then((o) => (o ? o.clone(true) : null));
}

function normalizeObject(scene: THREE.Object3D, targetSize: number): THREE.Object3D {
  scene.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(scene);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);
  const maxDim = Math.max(size.x, size.y, size.z) || 1;
  const s = targetSize / maxDim;

  const wrapper = new THREE.Group();
  scene.position.set(-center.x, -box.min.y, -center.z); // pose la base au sol (y=0)
  scene.scale.setScalar(1);
  wrapper.add(scene);
  wrapper.scale.setScalar(s);
  wrapper.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) {
      (o as THREE.Mesh).castShadow = true;
    }
  });
  return wrapper;
}

export interface FishHero {
  root: THREE.Object3D;
  mixer: THREE.AnimationMixer | null;
}

/**
 * Charge une GROSSE créature comme objet 3D individuel (scène complète) : centrée,
 * axe long orienté sur +Z, mise à l'échelle pour que sa plus grande dimension ≈
 * `targetSize`, et son AnimationMixer si le GLB contient une animation (léviathan
 * & co). Contrairement à l'InstancedMesh, ça conserve TOUS les meshes + le rig.
 * Chargé frais à chaque appel (les vedettes sont peu nombreuses) pour un mixer
 * indépendant par instance.
 */
export function loadFishHero(url: string, targetSize: number): Promise<FishHero | null> {
  return loader
    .loadAsync(url)
    .then((gltf) => {
      const model = gltf.scene;
      model.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(model);
      const size = new THREE.Vector3();
      const center = new THREE.Vector3();
      box.getSize(size);
      box.getCenter(center);
      const maxDim = Math.max(size.x, size.y, size.z) || 1;

      const inner = new THREE.Group();
      model.position.set(-center.x, -center.y, -center.z); // centre
      inner.add(model);
      if (size.x > size.z) inner.rotation.y = Math.PI / 2; // axe long -> Z (sens de nage)

      const wrapper = new THREE.Group();
      wrapper.add(inner);
      wrapper.scale.setScalar(targetSize / maxDim);
      wrapper.traverse((o) => {
        if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).castShadow = true;
      });

      let mixer: THREE.AnimationMixer | null = null;
      if (gltf.animations.length > 0) {
        mixer = new THREE.AnimationMixer(model);
        mixer.clipAction(gltf.animations[0]).reset().play();
      }
      return { root: wrapper, mixer } satisfies FishHero;
    })
    .catch(() => null);
}

export interface AnimatedModel {
  root: THREE.Object3D;
  mixer: THREE.AnimationMixer;
  play: (name?: string) => void;
}

/** Charge un personnage riggé : scène + AnimationMixer + lecture d'un clip. */
export function loadAnimated(url: string, targetHeight = 1.7): Promise<AnimatedModel | null> {
  return loader
    .loadAsync(url)
    .then((gltf) => {
      const root = gltf.scene;
      root.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(root);
      const size = new THREE.Vector3();
      box.getSize(size);
      const s = targetHeight / (size.y || 1);

      const wrapper = new THREE.Group();
      root.position.set(0, -box.min.y, 0);
      wrapper.add(root);
      wrapper.scale.setScalar(s);
      wrapper.traverse((o) => {
        if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).castShadow = true;
      });

      const mixer = new THREE.AnimationMixer(root);
      const play = (name?: string) => {
        const clip = name
          ? THREE.AnimationClip.findByName(gltf.animations, name)
          : gltf.animations[0];
        if (clip) mixer.clipAction(clip).reset().play();
      };
      play();
      return { root: wrapper, mixer, play } satisfies AnimatedModel;
    })
    .catch((e) => {
      console.warn('[AssetLoader] échec personnage', url, e);
      return null;
    });
}
