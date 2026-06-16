import type { Game } from '../core/Game';

/** Récompense de quête. */
export interface QuestReward {
  money?: number;
  bait?: number;
}

/** Une quête du mode Histoire (chaîne linéaire). */
export interface Quest {
  id: string;
  title: string;
  desc: string;
  /** Condition de complétion (lue sur l'état du jeu). */
  check: (g: Game) => boolean;
  reward: QuestReward;
}

/** Campagne Histoire : progression guidée du petit parc au grand complexe. */
export const QUESTS: Quest[] = [
  {
    id: 'connect', title: "Relier l'entrée",
    desc: "Trace un chemin depuis la porte d'entrée.",
    check: (g) => g.agents.spawnReady, reward: { money: 150 },
  },
  {
    id: 'open', title: 'Ouvrir le parc',
    desc: 'Ouvre les portes aux visiteurs.',
    check: (g) => g.state.park.isOpen, reward: { money: 150 },
  },
  {
    id: 'tank', title: 'Premier aquarium',
    desc: 'Construis un bac.',
    check: (g) => g.state.buildings.some((b) => b.tank !== undefined), reward: { money: 200, bait: 5 },
  },
  {
    id: 'fish', title: 'Première prise',
    desc: 'Pêche un poisson lors d\'une expédition.',
    check: (g) => g.state.stats.fishCaught >= 1, reward: { money: 150 },
  },
  {
    id: 'stock', title: 'Peupler un bac',
    desc: 'Place un poisson dans un aquarium.',
    check: (g) => g.state.buildings.some((b) => (b.tank?.fish.length ?? 0) > 0), reward: { money: 250 },
  },
  {
    id: 'snack', title: 'Petite restauration',
    desc: 'Construis un stand snack.',
    check: (g) => g.state.buildings.some((b) => b.type === 'food'), reward: { money: 300 },
  },
  {
    id: 'guests', title: 'Affluence',
    desc: 'Accueille et sers 25 visiteurs.',
    check: (g) => g.state.stats.guestsServed >= 25, reward: { money: 500 },
  },
  {
    id: 'keeper', title: 'Recrutement',
    desc: 'Embauche un soigneur.',
    check: (g) => g.state.staff.employees.some((e) => e.role === 'keeper'), reward: { money: 400 },
  },
  {
    id: 'appeal', title: 'Parc attractif',
    desc: "Atteins 30 points d'attrait.",
    check: (g) => g.state.park.appeal >= 30, reward: { money: 600 },
  },
  {
    id: 'lab', title: 'Laboratoire',
    desc: 'Construis un Laboratoire pour démarrer la recherche.',
    check: (g) => g.labCount > 0, reward: { money: 400 },
  },
  {
    id: 'breed', title: 'Élevage',
    desc: 'Construis une Nursery et fais naître un poisson.',
    check: (g) =>
      g.state.caughtInventory.some((f) => f.origin === 'bred') ||
      g.state.buildings.some((b) => b.tank?.fish.some((f) => f.origin === 'bred')),
    reward: { money: 500 },
  },
  {
    id: 'rich', title: 'Prospérité',
    desc: 'Possède 10 000 $.',
    check: (g) => g.state.money.gte(10000), reward: { money: 1000 },
  },
  {
    id: 'mythic', title: 'Espèces mythiques',
    desc: 'Débloque les espèces mythiques via la recherche (Laboratoire).',
    check: (g) => g.state.unlockedResearch.includes('res-mythic'), reward: { money: 5000 },
  },
];
