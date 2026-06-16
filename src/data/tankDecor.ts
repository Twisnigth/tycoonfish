/**
 * Décor intérieur de bac (M8) — objets 3D placés DANS l'aquarium. Rend visuel le
 * scalaire d'enrichissement : chaque décor posé embellit le bac et augmente
 * l'enrichissement (donc le bien-être). Réutilise les modèles `decor_*.glb`.
 */
export interface TankDecorDef {
  id: string;
  name: string;
  icon: string;
  model: string; // suffixe de decor_<model>.glb
  cost: number;
  enrich: number; // gain d'enrichissement (0..1)
}

export const TANK_DECOR: Record<string, TankDecorDef> = {
  coral: { id: 'coral', name: 'Corail', icon: '🪸', model: 'coral', cost: 90, enrich: 0.16 },
  kelp: { id: 'kelp', name: 'Algues', icon: '🌿', model: 'kelp', cost: 60, enrich: 0.12 },
  rock: { id: 'rock', name: 'Rocher', icon: '🪨', model: 'rock', cost: 50, enrich: 0.1 },
  chest: { id: 'chest', name: 'Coffre', icon: '🧰', model: 'treasure_chest', cost: 130, enrich: 0.2 },
};

export const TANK_DECOR_LIST: TankDecorDef[] = Object.values(TANK_DECOR);

export const tankDecorModel = (id: string): string => TANK_DECOR[id]?.model ?? 'rock';
