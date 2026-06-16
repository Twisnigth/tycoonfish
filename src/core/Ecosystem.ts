import type { GameState, TankState } from './GameState';
import { getFish } from '../data/fish';
import { breedFish } from './Fish';
import { computeWelfare, BREEDING_WELFARE } from './Welfare';
import { equipmentEffects } from '../data/equipment';
import { BIOMES } from '../data/biomes';

/**
 * Écosystème vivant : les poissons ont faim, vieillissent, et leur santé suit
 * le BIEN-ÊTRE de l'habitat (espace, température, social, propreté,
 * enrichissement). Un habitat épanoui régénère la santé, calme le stress et
 * permet la reproduction NATURELLE ; un habitat négligé fait dépérir et mourir.
 * Les prédateurs mangent les plus petits. Appelé au tick logique (1 Hz).
 */

const HUNGER_RATE = 0.015; // /s quand pas de nourriture
const FEED_RECOVER = 0.06; // /s quand nourriture dispo
const WATER_DECAY = 0.004; // /s (× densité de population)
const FOOD_CONSUME = 0.003; // /s par poisson
const HEALTH_DECAY = 0.025; // /s max si bien-être très bas
const HEALTH_REGEN = 0.014; // /s si épanoui
const STRESS_RATE = 0.12; // /s lissage du stress vers (1 - bien-être)
const ENRICH_DECAY = 0.002; // /s l'enrichissement se dégrade
const BASE_LIFESPAN = 900; // s, × gène longévité
const PREDATION_CHANCE = 0.015; // par proie et par seconde
const NAT_BREED_CHANCE = 0.012; // /s par bac éligible (bien-être élevé)

// Personnel
export const KEEPER_HIRE_COST = 500;
export const KEEPER_SALARY = 40; // par jour
export const JANITOR_HIRE_COST = 350;
export const JANITOR_SALARY = 30; // par jour
export const STAFF_HIRE_COST: Record<string, number> = { keeper: KEEPER_HIRE_COST, janitor: JANITOR_HIRE_COST };
export const STAFF_SALARY: Record<string, number> = { keeper: KEEPER_SALARY, janitor: JANITOR_SALARY };

export interface EcoResult {
  changed: string[];
  deaths: number;
  births: number;
}

/** Un Laboratoire (R&D filtration) construit booste légèrement le bien-être. */
function labBonus(state: GameState): number {
  return state.buildings.some((b) => b.type === 'research') ? 1 : 0;
}

export function ecosystemTick(state: GameState, dt: number): EcoResult {
  const changed: string[] = [];
  let deaths = 0;
  let births = 0;
  const lab = labBonus(state);

  for (const b of state.buildings) {
    const tank = b.tank;
    if (!tank) continue;
    const n = tank.fish.length;
    const eff = equipmentEffects(tank.equipment);

    // Dégradation eau + nourriture (atténuées par l'équipement) + enrichissement.
    tank.water.quality = clamp01(
      tank.water.quality - WATER_DECAY * (1 + n * 0.12 * eff.densityMult) * eff.waterDecayMult * dt + eff.autoClean * dt,
    );
    tank.water.foodStock = clamp01(
      tank.water.foodStock - FOOD_CONSUME * n * eff.foodDecayMult * dt + eff.autoFeed * dt,
    );
    tank.enrichment = clamp01(tank.enrichment - ENRICH_DECAY * dt);

    if (n === 0) continue;

    // Régulateur thermique : amène la température vers l'idéal moyen des poissons.
    if (eff.autoTemp) {
      let s = 0;
      for (const f of tank.fish) s += getFish(f.species)?.idealTemp ?? tank.waterTemp;
      tank.waterTemp = Math.round(s / n);
    }
    // Doseur : ramène pH et salinité vers l'idéal du biome.
    if (eff.autoChem) {
      const ideal = BIOMES[tank.biome];
      tank.ph = ideal.idealPh;
      tank.salinity = ideal.idealSalinity;
    }

    const welfare = computeWelfare(tank, lab).score;

    const hasPredator = tank.fish.some((f) => getFish(f.species)?.predator);
    const predSize = hasPredator
      ? Math.max(...tank.fish.map((f) => (getFish(f.species)?.predator ? getFish(f.species)!.sizeClass : 0)))
      : 0;

    const before = tank.fish.length;
    const survivors = [];
    for (const f of tank.fish) {
      const sp = getFish(f.species);
      if (!sp) continue;
      f.vitals.age += dt;

      if (tank.water.foodStock > 0) f.vitals.hunger = clamp01(f.vitals.hunger - FEED_RECOVER * dt);
      else f.vitals.hunger = clamp01(f.vitals.hunger + HUNGER_RATE * dt);

      // Stress = miroir lissé du bien-être de l'habitat.
      f.vitals.stress = clamp01(f.vitals.stress + ((1 - welfare) - f.vitals.stress) * STRESS_RATE * dt);

      // Santé : régénère si épanoui ; dépérit proportionnellement au mal-être.
      const starving = f.vitals.hunger > 0.85;
      const thriving = welfare > 0.6 && !starving;
      const delta = thriving
        ? HEALTH_REGEN
        : -HEALTH_DECAY * (starving ? 1 : 0.4 + (1 - welfare));
      f.vitals.health = clamp01(f.vitals.health + (delta * dt) / Math.max(0.4, f.genes.immunity));

      // Prédation : une proie plus petite peut se faire manger.
      const eaten =
        hasPredator && !sp.predator && sp.sizeClass < predSize && Math.random() < PREDATION_CHANCE * dt;
      const lifespan = BASE_LIFESPAN * f.genes.longevity;
      const dead = f.vitals.health <= 0 || f.vitals.age > lifespan;

      if (!eaten && !dead) survivors.push(f);
    }

    if (survivors.length !== before) {
      deaths += before - survivors.length;
      changed.push(b.id);
    }
    tank.fish = survivors;

    // Reproduction NATURELLE : habitat épanoui + place + couple fertile.
    if (welfare >= BREEDING_WELFARE && Math.random() < NAT_BREED_CHANCE * dt) {
      if (tryNaturalBreed(tank)) {
        births += 1;
        if (!changed.includes(b.id)) changed.push(b.id);
      }
    }
  }
  return { changed, deaths, births };
}

/** Tente une naissance naturelle dans un bac (2 fertiles de même espèce + place). */
function tryNaturalBreed(tank: TankState): boolean {
  // Reste-t-il de l'espace ? (besoin courant < 80% du volume)
  let need = 0;
  for (const f of tank.fish) need += getFish(f.species)?.spacePerFish ?? 6;
  if (need > tank.volume * 0.8) return false;

  const bySpecies = new Map<string, typeof tank.fish>();
  for (const f of tank.fish) {
    if (!f.fertile) continue;
    const arr = bySpecies.get(f.species);
    if (arr) arr.push(f);
    else bySpecies.set(f.species, [f]);
  }
  for (const [, group] of bySpecies) {
    if (group.length >= 2) {
      const { child } = breedFish(group[0], group[1]);
      tank.fish.push(child);
      return true;
    }
  }
  return false;
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}
