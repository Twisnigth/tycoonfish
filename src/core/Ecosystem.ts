import type { GameState } from './GameState';
import { getFish } from '../data/fish';

/**
 * Écosystème vivant (M3) : les poissons ont faim, vieillissent, tombent malades
 * et meurent. L'eau se dégrade et la nourriture s'épuise ; les soigneurs
 * réapprovisionnent. Les prédateurs mangent les plus petits.
 * Appelé au tick logique (1 Hz). Retourne les bacs dont la population a changé.
 */

const HUNGER_RATE = 0.02; // /s quand pas de nourriture
const FEED_RECOVER = 0.06; // /s quand nourriture dispo
const WATER_DECAY = 0.008; // /s (× densité de population)
const FOOD_CONSUME = 0.01; // /s par poisson
const HEALTH_DECAY = 0.03; // /s si affamé ou eau sale
const HEALTH_REGEN = 0.012; // /s sinon
const BASE_LIFESPAN = 900; // s, × gène longévité
const PREDATION_CHANCE = 0.015; // par proie et par seconde

// Soigneurs
export const KEEPER_CAPACITY = 4; // bacs entretenus par soigneur et par tick
export const KEEPER_REFILL = 0.06; // nourriture /s
export const KEEPER_CLEAN = 0.05; // qualité d'eau /s
export const KEEPER_HIRE_COST = 500;
export const KEEPER_SALARY = 40; // par jour

export function ecosystemTick(state: GameState, dt: number): string[] {
  const changed: string[] = [];
  let serviceBudget = state.staff.keepers * KEEPER_CAPACITY;

  for (const b of state.buildings) {
    const tank = b.tank;
    if (!tank) continue;
    const n = tank.fish.length;

    // Dégradation eau + consommation nourriture.
    tank.water.quality = clamp01(tank.water.quality - WATER_DECAY * (1 + n * 0.12) * dt);
    tank.water.foodStock = clamp01(tank.water.foodStock - FOOD_CONSUME * n * dt);

    // Service des soigneurs (réappro nourriture + nettoyage).
    if (serviceBudget > 0 && (tank.water.foodStock < 0.6 || tank.water.quality < 0.6)) {
      tank.water.foodStock = clamp01(tank.water.foodStock + KEEPER_REFILL * dt);
      tank.water.quality = clamp01(tank.water.quality + KEEPER_CLEAN * dt);
      serviceBudget -= 1;
    }

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

      const suffering = f.vitals.hunger > 0.8 || tank.water.quality < 0.3;
      f.vitals.health = clamp01(
        f.vitals.health + (suffering ? -HEALTH_DECAY : HEALTH_REGEN) * dt / Math.max(0.4, f.genes.immunity),
      );

      // Prédation : une proie plus petite peut se faire manger.
      const eaten =
        hasPredator && !sp.predator && sp.sizeClass < predSize && Math.random() < PREDATION_CHANCE * dt;
      const lifespan = BASE_LIFESPAN * f.genes.longevity;
      const dead = f.vitals.health <= 0 || f.vitals.age > lifespan;

      if (!eaten && !dead) survivors.push(f);
    }

    if (survivors.length !== before) {
      tank.fish = survivors;
      changed.push(b.id);
    }
  }
  return changed;
}

/** Santé moyenne d'un bac (0..1), pour l'UI et l'attrait. */
export function tankHealth(fishHealth: number[]): number {
  if (fishHealth.length === 0) return 1;
  return fishHealth.reduce((a, h) => a + h, 0) / fishHealth.length;
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}
