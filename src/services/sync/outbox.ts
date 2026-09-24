import AsyncStorage from '@react-native-async-storage/async-storage';

import { safeJsonParse } from '@/services/storage/safeJson';

import type { PendingFavoriteOp } from './mergeRules';

/**
 * Changes made on this device that the account hasn't confirmed yet -
 * the only things the sync layer ever writes. Persisted, so an offline
 * change survives an app restart and is sent once the connection is back;
 * an entry is removed only after the server accepted it (no duplicate
 * writes, nothing silently dropped).
 *
 * Guests use the same outbox: a guest's visits and favorites wait here
 * and are merged into the account the moment they sign in.
 */
export const PENDING_VISITS_KEY = 'oyno.sync.pendingVisits';
export const PENDING_FAVORITES_KEY = 'oyno.sync.pendingFavorites';

/** region id -> ISO time it was first visited on this device. */
export type PendingVisits = Record<string, string>;
/** favorite key (`type:id`) -> the latest unsynced edit for it. */
export type PendingFavorites = Record<string, PendingFavoriteOp>;

// Every read-modify-write goes through one queue, so a favorite toggled
// while a sync is removing applied entries can't be lost to a race.
let queue: Promise<unknown> = Promise.resolve();
function serialized<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task, task);
  queue = run.catch(() => {});
  return run;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

export async function readPendingVisits(): Promise<PendingVisits> {
  const parsed = safeJsonParse<unknown>(await AsyncStorage.getItem(PENDING_VISITS_KEY).catch(() => null), {});
  if (!isRecord(parsed)) return {};
  return Object.fromEntries(Object.entries(parsed).filter((entry): entry is [string, string] => typeof entry[1] === 'string'));
}

export async function writePendingVisits(visits: PendingVisits): Promise<void> {
  await AsyncStorage.setItem(PENDING_VISITS_KEY, JSON.stringify(visits)).catch(() => {});
}

export function addPendingVisit(regionId: string, at: string): Promise<void> {
  return serialized(async () => {
    const visits = await readPendingVisits();
    if (visits[regionId]) return;
    await writePendingVisits({ ...visits, [regionId]: at });
  });
}

/** Drops only the visits the server accepted. */
export function removePendingVisits(regionIds: string[]): Promise<void> {
  if (regionIds.length === 0) return Promise.resolve();
  return serialized(async () => {
    const visits = await readPendingVisits();
    for (const id of regionIds) delete visits[id];
    await writePendingVisits(visits);
  });
}

export async function readPendingFavorites(): Promise<PendingFavorites> {
  const parsed = safeJsonParse<unknown>(await AsyncStorage.getItem(PENDING_FAVORITES_KEY).catch(() => null), {});
  if (!isRecord(parsed)) return {};
  const result: PendingFavorites = {};
  for (const [key, value] of Object.entries(parsed)) {
    if (isRecord(value) && typeof value.favorited === 'boolean' && typeof value.at === 'string') {
      result[key] = { favorited: value.favorited, at: value.at, origin: value.origin === 'guest' ? 'guest' : 'account' };
    }
  }
  return result;
}

export async function writePendingFavorites(ops: PendingFavorites): Promise<void> {
  await AsyncStorage.setItem(PENDING_FAVORITES_KEY, JSON.stringify(ops)).catch(() => {});
}

/** Records the latest edit for a key (an earlier unsynced edit is replaced). */
export function recordFavoriteOp(key: string, op: PendingFavoriteOp): Promise<void> {
  return serialized(async () => {
    const ops = await readPendingFavorites();
    await writePendingFavorites({ ...ops, [key]: op });
  });
}

/** Drops only the edits that were applied - and only if no newer edit for
 * the same key arrived while the sync was in flight. */
export function removeFavoriteOps(applied: Record<string, string>): Promise<void> {
  const keys = Object.keys(applied);
  if (keys.length === 0) return Promise.resolve();
  return serialized(async () => {
    const ops = await readPendingFavorites();
    for (const key of keys) {
      if (ops[key]?.at === applied[key]) delete ops[key];
    }
    await writePendingFavorites(ops);
  });
}

/** Merges ops from another source (a stash); the newer edit per key wins. */
export function mergeFavoriteOps(incoming: PendingFavorites): Promise<void> {
  return serialized(async () => {
    const ops = await readPendingFavorites();
    for (const [key, op] of Object.entries(incoming)) {
      if (!ops[key] || ops[key].at < op.at) ops[key] = op;
    }
    await writePendingFavorites(ops);
  });
}

export function mergePendingVisits(incoming: PendingVisits): Promise<void> {
  return serialized(async () => {
    const visits = await readPendingVisits();
    for (const [id, at] of Object.entries(incoming)) {
      if (!visits[id] || visits[id] > at) visits[id] = at;
    }
    await writePendingVisits(visits);
  });
}
