/**
 * Équipement de bac (M8) — la profondeur de gestion d'un AQUARIUM (façon
 * Megaquarium) : on installe du matériel dans un bac pour automatiser/améliorer
 * son entretien et son bien-être, en échange d'un coût et d'un entretien/jour.
 * Pas de métiers spécialisés — c'est l'équipement qui « travaille ».
 */
export interface EquipmentDef {
  id: string;
  name: string;
  icon: string;
  desc: string;
  cost: number;
  maintenance: number; // par jour
}

export const EQUIPMENT: Record<string, EquipmentDef> = {
  filter: {
    id: 'filter', name: 'Filtre', icon: '🫧', cost: 250, maintenance: 8,
    desc: "Filtration : l'eau se salit deux fois moins vite et se nettoie lentement toute seule.",
  },
  oxygenator: {
    id: 'oxygenator', name: "Pompe à O₂", icon: '💨', cost: 220, maintenance: 7,
    desc: 'Oxygénation : réduit fortement la pollution liée à la densité de poissons.',
  },
  heater: {
    id: 'heater', name: 'Régulateur thermique', icon: '🌡️', cost: 300, maintenance: 10,
    desc: 'Maintient automatiquement la température à l\'idéal des poissons du bac.',
  },
  lighting: {
    id: 'lighting', name: 'Éclairage récifal', icon: '💡', cost: 200, maintenance: 6,
    desc: 'Met le bac en valeur : enrichissement minimum garanti et +12 % d\'attrait.',
  },
  autofeeder: {
    id: 'autofeeder', name: 'Distributeur auto', icon: '🍤', cost: 280, maintenance: 9,
    desc: 'Nourrit les poissons en continu : le stock de nourriture reste élevé.',
  },
  doser: {
    id: 'doser', name: 'Doseur automatique', icon: '⚗️', cost: 340, maintenance: 11,
    desc: 'Maintient le pH et la salinité à l\'idéal du biome, automatiquement.',
  },
};

export const EQUIPMENT_LIST: EquipmentDef[] = Object.values(EQUIPMENT);

/** Effets agrégés d'un ensemble d'équipements installés dans un bac. */
export interface EquipmentEffects {
  waterDecayMult: number; // multiplie la dégradation de l'eau
  densityMult: number; // multiplie la part de pollution due à la densité
  foodDecayMult: number; // multiplie la consommation de nourriture
  autoClean: number; // /s qualité d'eau restaurée
  autoFeed: number; // /s nourriture restaurée
  autoTemp: boolean; // ajuste la température vers l'idéal
  autoChem: boolean; // ajuste pH + salinité vers l'idéal du biome
  appealMult: number; // multiplicateur d'attrait
  enrichFloor: number; // plancher d'enrichissement (0..1)
}

export function equipmentEffects(ids: string[] | undefined): EquipmentEffects {
  const e: EquipmentEffects = {
    waterDecayMult: 1, densityMult: 1, foodDecayMult: 1,
    autoClean: 0, autoFeed: 0, autoTemp: false, autoChem: false, appealMult: 1, enrichFloor: 0,
  };
  if (!ids) return e;
  for (const id of ids) {
    switch (id) {
      case 'filter': e.waterDecayMult *= 0.5; e.autoClean += 0.02; break;
      case 'oxygenator': e.densityMult *= 0.35; break;
      case 'heater': e.autoTemp = true; break;
      case 'lighting': e.enrichFloor = Math.max(e.enrichFloor, 0.55); e.appealMult *= 1.12; break;
      case 'autofeeder': e.autoFeed += 0.08; break;
      case 'doser': e.autoChem = true; break;
    }
  }
  return e;
}

/** Coût d'entretien quotidien total de l'équipement d'un bac. */
export function equipmentMaintenance(ids: string[] | undefined): number {
  if (!ids) return 0;
  let m = 0;
  for (const id of ids) m += EQUIPMENT[id]?.maintenance ?? 0;
  return m;
}
