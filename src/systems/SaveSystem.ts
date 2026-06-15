import { openDB, type IDBPDatabase } from 'idb';
import { D, type Decimal } from '../core/numbers';
import type { GameState } from '../core/GameState';

/**
 * Persistance via IndexedDB (et non localStorage : asynchrone, large capacité —
 * indispensable pour des dizaines de bacs et des milliers de poissons à terme).
 * Les `Decimal` ne sont pas sérialisables en JSON → on les encode en chaîne.
 */
const DB_NAME = 'aqua-tycoon';
const STORE = 'save';
const KEY = 'main';

const DECIMAL_FIELDS = ['money', 'research', 'totalEarned'] as const;
type DecimalField = (typeof DECIMAL_FIELDS)[number];

type SavedState = Omit<GameState, DecimalField> & Record<DecimalField, string>;

function serialize(state: GameState): SavedState {
  const out = { ...state } as unknown as SavedState;
  for (const f of DECIMAL_FIELDS) {
    out[f] = (state[f] as Decimal).toString();
  }
  return out;
}

function deserialize(saved: SavedState): GameState {
  const out = { ...saved } as unknown as GameState;
  for (const f of DECIMAL_FIELDS) {
    out[f] = D(saved[f]);
  }
  return out;
}

let dbPromise: Promise<IDBPDatabase> | null = null;
function db(): Promise<IDBPDatabase> {
  return (dbPromise ??= openDB(DB_NAME, 1, {
    upgrade(database) {
      if (!database.objectStoreNames.contains(STORE)) {
        database.createObjectStore(STORE);
      }
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
    const saved = (await conn.get(STORE, KEY)) as SavedState | undefined;
    return saved ? deserialize(saved) : null;
  } catch {
    return null;
  }
}

export async function clearSave(): Promise<void> {
  const conn = await db();
  await conn.delete(STORE, KEY);
}
