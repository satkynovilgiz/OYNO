import AsyncStorage from '@react-native-async-storage/async-storage';
import type { QueryClient, QueryKey } from '@tanstack/react-query';

import { safeJsonParse } from '@/services/storage/safeJson';

import { EMPTY_MANIFEST, hashQueryKey, parseManifest, referencedHashes, utf8ByteLength, type OfflineManifest } from './offlineManifest';

/** Everything offline lives under this prefix and nothing else - removing
 * downloads can never touch progress, favorites, Passport or Journey data,
 * which use their own keys. */
export const OFFLINE_STORAGE_PREFIX = 'oyno.offline.';
const MANIFEST_KEY = `${OFFLINE_STORAGE_PREFIX}manifest`;
const QUERY_PREFIX = `${OFFLINE_STORAGE_PREFIX}query:`;

type StoredQuery = { key: QueryKey; data: unknown; savedAt: number };

export async function readManifest(): Promise<OfflineManifest> {
  const raw = await AsyncStorage.getItem(MANIFEST_KEY).catch(() => null);
  return parseManifest(safeJsonParse<unknown>(raw, EMPTY_MANIFEST));
}

export async function writeManifest(manifest: OfflineManifest): Promise<void> {
  await AsyncStorage.setItem(MANIFEST_KEY, JSON.stringify(manifest)).catch(() => {});
}

/** Persists one query result; returns the bytes actually written. */
export async function writeQuery(key: QueryKey, data: unknown): Promise<number> {
  const payload = JSON.stringify({ key, data, savedAt: Date.now() } satisfies StoredQuery);
  await AsyncStorage.setItem(QUERY_PREFIX + hashQueryKey(key), payload);
  return utf8ByteLength(payload);
}

export async function deleteQueries(hashes: string[]): Promise<void> {
  if (hashes.length === 0) return;
  await AsyncStorage.multiRemove(hashes.map((hash) => QUERY_PREFIX + hash)).catch(() => {});
}

/** Measured size of everything stored for offline use. */
export async function measureOfflineBytes(manifest: OfflineManifest): Promise<number> {
  const keys = [MANIFEST_KEY, ...Array.from(referencedHashes(manifest)).map((hash) => QUERY_PREFIX + hash)];
  const pairs: readonly (readonly [string, string | null])[] = await AsyncStorage.multiGet(keys).catch(() => []);
  let bytes = 0;
  for (const [, value] of pairs) bytes += value ? utf8ByteLength(value) : 0;
  return bytes;
}

/**
 * Seeds the react-query cache with every downloaded result that isn't
 * already there - so a screen opened offline has its data immediately
 * (no spinner). `updatedAt` is the real save time, so online the normal
 * staleness rules still refetch fresh data in the background.
 */
export async function hydrateQueryClient(queryClient: QueryClient, manifest: OfflineManifest): Promise<void> {
  const hashes = Array.from(referencedHashes(manifest));
  if (hashes.length === 0) return;
  const pairs: readonly (readonly [string, string | null])[] = await AsyncStorage.multiGet(hashes.map((hash) => QUERY_PREFIX + hash)).catch(() => []);
  for (const [, raw] of pairs) {
    const stored = safeJsonParse<StoredQuery | null>(raw, null);
    if (!stored || !Array.isArray(stored.key)) continue;
    if (queryClient.getQueryData(stored.key) !== undefined) continue;
    queryClient.setQueryData(stored.key, stored.data, { updatedAt: stored.savedAt });
  }
}

/**
 * Deletes stored query results that no manifest entry references - what an
 * interrupted download (app killed, storage error) can leave behind, since
 * the manifest is only written after everything else succeeded. Only keys
 * under the offline prefix are touched, and only unreferenced ones, so a
 * complete download is never affected. Returns how many were removed.
 */
export async function pruneOrphanQueries(manifest: OfflineManifest): Promise<number> {
  const keys: readonly string[] = await AsyncStorage.getAllKeys().catch(() => []);
  const referenced = referencedHashes(manifest);
  const orphans = keys.filter((key) => key.startsWith(QUERY_PREFIX) && !referenced.has(key.slice(QUERY_PREFIX.length)));
  if (orphans.length > 0) await AsyncStorage.multiRemove(orphans).catch(() => {});
  return orphans.length;
}
