import { create } from 'zustand';
import type { BuildingType } from '../data/buildings';

/** Outil actif du mode construction. `null` = mode sélection/inspection. */
export type Tool = BuildingType | 'remove' | 'plot' | null;

interface UiState {
  tool: Tool;
  selectedBuildingId: string | null;
  setTool: (t: Tool) => void;
  select: (id: string | null) => void;
}

/** État UI éphémère (NON sauvegardé) — séparé du store de jeu. */
export const useUiStore = create<UiState>((set) => ({
  tool: null,
  selectedBuildingId: null,
  setTool: (t) => set({ tool: t, selectedBuildingId: null }),
  select: (id) => set({ selectedBuildingId: id }),
}));
