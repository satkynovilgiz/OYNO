import type { QueryKey } from '@tanstack/react-query';

/**
 * Offline downloads are NOT a second content database: a download is a
 * list of the exact react-query cache entries (query keys) the EXISTING
 * detail screen reads, persisted and re-seeded into the query cache at
 * startup. The screens stay the only screens; they just find their data.
 */

/** Bump when the shape of what a download stores changes. Older entries are
 * kept and still used offline, then refreshed when online - never silently
 * deleted. */
export const OFFLINE_CACHE_VERSION = 1;

export type OfflineKind = 'nature' | 'collection' | 'culture_item';

export type OfflineDownloadId = `${OfflineKind}:${string}`;

export type OfflineManifestEntry = {
  id: OfflineDownloadId;
  kind: OfflineKind;
  contentId: string;
  /** Hashes of the persisted query results this download needs. */
  queryHashes: string[];
  /** Remote (non-bundled) image URLs prefetched into the image disk cache. */
  remoteImageUrls: string[];
  downloadedAt: string;
  version: number;
};

export type OfflineManifest = { entries: Record<string, OfflineManifestEntry> };

export type DownloadState = 'not_downloaded' | 'downloading' | 'downloaded' | 'error';

export const EMPTY_MANIFEST: OfflineManifest = { entries: {} };

export function downloadId(kind: OfflineKind, contentId: string): OfflineDownloadId {
  return `${kind}:${contentId}`;
}

export function hashQueryKey(key: QueryKey): string {
  return JSON.stringify(key);
}

/** Tolerates corrupted/foreign storage values instead of crashing boot. */
export function parseManifest(value: unknown): OfflineManifest {
  if (!value || typeof value !== 'object' || !('entries' in value)) return EMPTY_MANIFEST;
  const entries = (value as { entries: unknown }).entries;
  if (!entries || typeof entries !== 'object') return EMPTY_MANIFEST;
  const valid: Record<string, OfflineManifestEntry> = {};
  for (const [id, entry] of Object.entries(entries as Record<string, OfflineManifestEntry>)) {
    if (entry && typeof entry.kind === 'string' && Array.isArray(entry.queryHashes)) {
      valid[id] = { ...entry, remoteImageUrls: Array.isArray(entry.remoteImageUrls) ? entry.remoteImageUrls : [], version: entry.version ?? 0 };
    }
  }
  return { entries: valid };
}

export function upsertEntry(manifest: OfflineManifest, entry: OfflineManifestEntry): OfflineManifest {
  return { entries: { ...manifest.entries, [entry.id]: entry } };
}

export function referencedHashes(manifest: OfflineManifest): Set<string> {
  return new Set(Object.values(manifest.entries).flatMap((entry) => entry.queryHashes));
}

/** Removes one download. Returns the persisted query results no other
 * download still needs (safe to delete) - shared data like the full
 * explore_regions list stays while any place still uses it. */
export function removeEntry(manifest: OfflineManifest, id: string): { manifest: OfflineManifest; orphanHashes: string[] } {
  const removed = manifest.entries[id];
  if (!removed) return { manifest, orphanHashes: [] };
  const { [id]: _removed, ...rest } = manifest.entries;
  const next = { entries: rest };
  const stillUsed = referencedHashes(next);
  return { manifest: next, orphanHashes: removed.queryHashes.filter((hash) => !stillUsed.has(hash)) };
}

export function needsRefresh(entry: OfflineManifestEntry): boolean {
  return entry.version !== OFFLINE_CACHE_VERSION;
}

export function downloadStateOf(manifest: OfflineManifest, inFlight: string[], failed: string[], id: string): DownloadState {
  if (inFlight.includes(id)) return 'downloading';
  if (failed.includes(id)) return 'error';
  return manifest.entries[id] ? 'downloaded' : 'not_downloaded';
}

/**
 * True when a query has no data and can't get any right now: react-query
 * pauses fetches while offline (fetchStatus 'paused'), which would
 * otherwise read as an endless spinner. Screens show the localized
 * "not available offline yet" state instead.
 */
export function isWaitingForNetwork(query: { data: unknown; fetchStatus: string }): boolean {
  return query.data === undefined && query.fetchStatus === 'paused';
}

/** UTF-8 byte length of what we actually write to storage - the only
 * storage number shown, because it's genuinely measured. */
export function utf8ByteLength(text: string): number {
  let bytes = 0;
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i);
    if (code < 0x80) bytes += 1;
    else if (code < 0x800) bytes += 2;
    else if (code >= 0xd800 && code <= 0xdbff) {
      bytes += 4;
      i += 1;
    } else bytes += 3;
  }
  return bytes;
}
