import { openDB, type IDBPDatabase } from 'idb';
import { D } from '../core/numbers';
import type { GameState } from '../core/GameState';

/**
 * Persistance via IndexedDB. La grille n'est PAS sérialisée (reconstruite depuis
 * `buildings` + `plots` par le Game). Les `Decimal` (argent/recherche + registre
 * du parc) sont encodés en chaîne. Schéma v2 ; une sauvegarde d'un autre schéma
 * est ignorée (nouvelle partie).
 */
const DB_NAME = 'aqua-tycoon';
const STORE = 'save';
const KEY = 'main';
const SCHEMA = 4;

function serialize(state: GameState): unknown {
  return {
    ...state,
    money: state.money.toString(),
    research: state.research.toString(),
    park: {
      ...state.park,
      incomeToday: state.park.incomeToday.toString(),
      expensesToday: state.park.expensesToday.toString(),
    },
  };
}

interface Saved {
  schema: number;
  money: string;
  research: string;
  park: { incomeToday: string; expensesToday: string; [k: string]: unknown };
  [k: string]: unknown;
}

function deserialize(s: Saved): GameState {
  const out = { ...s } as unknown as GameState;
  out.money = D(s.money);
  out.research = D(s.research);
  out.park = {
    ...(s.park as unknown as GameState['park']),
    incomeToday: D(s.park.incomeToday),
    expensesToday: D(s.park.expensesToday),
  };
  return out;
}

let dbPromise: Promise<IDBPDatabase> | null = null;
function db(): Promise<IDBPDatabase> {
  return (dbPromise ??= openDB(DB_NAME, 1, {
    upgrade(database) {
      if (!database.objectStoreNames.contains(STORE)) database.createObjectStore(STORE);
    },
  }));
}

export async function saveGame(state: GameState): Promise<void> {
  state.lastSaved = Date.now();
  const conn = await db();
  await conn.put(STORE, serialize(state), KEY);
}

export async function loadGame(): Promise<GameState | null> {
  try {
    const conn = await db();
    const saved = (await conn.get(STORE, KEY)) as Saved | undefined;
    if (!saved || saved.schema !== SCHEMA) return null;
    return deserialize(saved);
  } catch {
    return null;
  }
}

export async function clearSave(): Promise<void> {
  const conn = await db();
  await conn.delete(STORE, KEY);
}
