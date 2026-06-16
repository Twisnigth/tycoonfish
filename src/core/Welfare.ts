import type { TankState } from './GameState';
import { getFish } from '../data/fish';
import type { FishSpecies } from '../data/types';
import { equipmentEffects } from '../data/equipment';
import { BIOMES } from '../data/biomes';

/**
 * Bien-être d'habitat (M7) — cœur « simulateur » à la Planet Zoo. Le bien-être
 * d'un bac (0..1) agrège plusieurs critères que le joueur GÈRE : espace vital,
 * température réglée vs idéale des espèces, taille des bancs (social),
 * propreté de l'eau, enrichissement/décor, et compatibilité (agressivité).
 * Il pilote la santé, la reproduction naturelle et l'attrait de l'exhibit.
 */

export interface WelfareFactor {
  key: string;
  icon: string;
  label: string;
  score: number; // 0..1
  detail: string;
}

export interface WelfareReport {
  score: number; // 0..1 global
  factors: WelfareFactor[];
}

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

/** Adéquation de la température du bac à l'idéal d'une espèce (1 à l'idéal, 0 au bord). */
function tempFit(t: number, sp: FishSpecies): number {
  const span = Math.max(2, (sp.requirements.maxTemp - sp.requirements.minTemp) / 2);
  return clamp01(1 - Math.abs(t - sp.idealTemp) / span);
}

const WEIGHTS = {
  space: 0.22, temp: 0.16, social: 0.14, clean: 0.13, enrichment: 0.08,
  ph: 0.11, salinity: 0.1, compat: 0.06,
};

/**
 * Calcule le rapport de bien-être d'un bac. `labBonus` (0..1) est un coup de
 * pouce global apporté par un Laboratoire (R&D filtration) construit dans le parc.
 */
export function computeWelfare(tank: TankState, labBonus = 0): WelfareReport {
  const fish = tank.fish;
  const n = fish.length;

  if (n === 0) {
    const ok = (key: string, icon: string, label: string): WelfareFactor => ({ key, icon, label, score: 1, detail: '—' });
    return {
      score: 1,
      factors: [
        ok('space', '📏', 'Espace'),
        ok('temp', '🌡️', 'Température'),
        ok('social', '👥', 'Social'),
        ok('clean', '🫧', 'Propreté'),
        ok('enrichment', '🌿', 'Enrichissement'),
        ok('ph', '⚗️', 'pH'),
        ok('salinity', '🧂', 'Salinité'),
      ],
    };
  }

  // --- Espace : volume du bac vs somme des besoins individuels.
  let need = 0;
  for (const f of fish) need += getFish(f.species)?.spacePerFish ?? 6;
  const space = clamp01(tank.volume / Math.max(1, need));

  const eff = equipmentEffects(tank.equipment);

  // --- Température : adéquation moyenne à l'idéal (garantie par un régulateur).
  let temp: number;
  if (eff.autoTemp) {
    temp = 1;
  } else {
    let tempSum = 0;
    for (const f of fish) {
      const sp = getFish(f.species);
      tempSum += sp ? tempFit(tank.waterTemp, sp) : 1;
    }
    temp = tempSum / n;
  }

  // --- Social : chaque espèce grégaire veut un banc d'au moins `socialMin`.
  const counts = new Map<string, number>();
  for (const f of fish) counts.set(f.species, (counts.get(f.species) ?? 0) + 1);
  let socialW = 0;
  for (const [sid, c] of counts) {
    const sp = getFish(sid);
    const m = sp?.socialMin ?? 1;
    socialW += Math.min(1, c / m) * c;
  }
  const social = clamp01(socialW / n);

  // --- Compatibilité : une espèce agressive stresse les co-occupants plus petits.
  let conflict = false;
  let maxAggroSize = 0;
  for (const f of fish) {
    const sp = getFish(f.species);
    if (sp?.aggressive) maxAggroSize = Math.max(maxAggroSize, sp.sizeClass);
  }
  if (maxAggroSize > 0) {
    conflict = fish.some((f) => {
      const sp = getFish(f.species);
      return sp && !sp.aggressive && sp.sizeClass < maxAggroSize;
    });
  }
  const compat = conflict ? 0.45 : 1;

  const clean = clamp01(tank.water.quality);
  const enrichment = clamp01(Math.max(tank.enrichment, eff.enrichFloor));

  // --- Chimie de l'eau : pH + salinité vs idéal du biome (garantie par un doseur).
  const ideal = BIOMES[tank.biome];
  const ph = eff.autoChem ? 1 : clamp01(1 - Math.abs(tank.ph - ideal.idealPh) / 1.5);
  const salinity = eff.autoChem ? 1 : clamp01(1 - Math.abs(tank.salinity - ideal.idealSalinity) / 8);

  let score =
    space * WEIGHTS.space +
    temp * WEIGHTS.temp +
    social * WEIGHTS.social +
    clean * WEIGHTS.clean +
    enrichment * WEIGHTS.enrichment +
    ph * WEIGHTS.ph +
    salinity * WEIGHTS.salinity +
    compat * WEIGHTS.compat;
  score = clamp01(score + labBonus * 0.08);

  const factors: WelfareFactor[] = [
    { key: 'space', icon: '📏', label: 'Espace', score: space, detail: `${tank.volume} / ${Math.round(need)} vol.` },
    { key: 'temp', icon: '🌡️', label: 'Température', score: temp, detail: `${tank.waterTemp}°C` },
    { key: 'social', icon: '👥', label: 'Social', score: social, detail: socialDetail(counts) },
    { key: 'clean', icon: '🫧', label: 'Propreté', score: clean, detail: `${Math.round(clean * 100)}%` },
    { key: 'enrichment', icon: '🌿', label: 'Enrichissement', score: enrichment, detail: `${Math.round(enrichment * 100)}%` },
    { key: 'ph', icon: '⚗️', label: 'pH', score: ph, detail: `${tank.ph.toFixed(1)} / ${ideal.idealPh}` },
    { key: 'salinity', icon: '🧂', label: 'Salinité', score: salinity, detail: `${tank.salinity} / ${ideal.idealSalinity} ppt` },
  ];
  if (conflict) factors.push({ key: 'compat', icon: '⚔️', label: 'Compatibilité', score: compat, detail: 'Espèces incompatibles' });

  return { score, factors };
}

/** Le bien-être est-il suffisant pour la reproduction naturelle ? */
export const BREEDING_WELFARE = 0.78;

function socialDetail(counts: Map<string, number>): string {
  let worst = '';
  let worstRatio = 1;
  for (const [sid, c] of counts) {
    const sp = getFish(sid);
    const m = sp?.socialMin ?? 1;
    const ratio = Math.min(1, c / m);
    if (ratio < worstRatio) { worstRatio = ratio; worst = `${sp?.name ?? sid} ${c}/${m}`; }
  }
  return worstRatio >= 1 ? 'OK' : worst;
}
