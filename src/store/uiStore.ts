import { create } from 'zustand';
import type { BuildingType } from '../data/buildings';

/** Outil actif du mode construction. `null` = mode sélection/inspection. */
export type Tool = BuildingType | 'remove' | 'plot' | null;

/** Demande de démolition en attente de confirmation. */
export interface PendingDemolish {
  gx: number;
  gy: number;
  name: string;
}

interface UiState {
  tool: Tool;
  selectedBuildingId: string | null;
  /** Vitesse de jeu : 0 = pause, 1/2/3 = ×1/×2/×3. */
  speed: number;
  /** Masquer le panneau d'objectifs. */
  hideObjectives: boolean;
  /** Bâtiment dont la démolition attend confirmation. */
  pendingDemolish: PendingDemolish | null;
  setTool: (t: Tool) => void;
  select: (id: string | null) => void;
  setSpeed: (n: number) => void;
  setHideObjectives: (b: boolean) => void;
  requestDemolish: (d: PendingDemolish | null) => void;
}

/** État UI éphémère (NON sauvegardé) — séparé du store de jeu. */
export const useUiStore = create<UiState>((set) => ({
  tool: null,
  selectedBuildingId: null,
  speed: 1,
  hideObjectives: false,
  pendingDemolish: null,
  setTool: (t) => set({ tool: t, selectedBuildingId: null }),
  select: (id) => set({ selectedBuildingId: id }),
  setSpeed: (speed) => set({ speed }),
  setHideObjectives: (hideObjectives) => set({ hideObjectives }),
  requestDemolish: (pendingDemolish) => set({ pendingDemolish }),
}));
