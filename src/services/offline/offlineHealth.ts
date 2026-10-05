import type { StoredQueryCheck } from './offlineCache';
import { needsRefresh, type OfflineManifest, type OfflineManifestEntry } from './offlineManifest';
import type { RegionPackItem } from './regionPacks';

/**
 * "Downloaded" must mean "opens offline". A health check compares each
 * manifest entry with what is ACTUALLY stored (offlineCache.verifyStoredQueries,
 * local reads only):
 *
 *   ready             every stored result the entry needs exists and parses
 *   incomplete        something it needs is missing or malformed - not
 *                     reported as available until repaired
 *   update_available  complete, but a REAL newer-version signal exists:
 *                     the app's offline format changed (entry.version), or
 *                     an article fetched since was updated after the saved
 *                     copy (content_updated_at). No guessing otherwise.
 *
 * Public offline content only - journals and account state never live in
 * the offline manifest.
 */
export type ItemHealth = 'ready' | 'incomplete' | 'update_available';

export type HealthReport = {
  checkedAt: string;
  items: Record<string, ItemHealth>;
  counts: Record<ItemHealth, number>;
};

/** The newest public signal we can trust without a request: a culture item's content_updated_at. */
function contentUpdatedAt(data: unknown): string | null {
  const value = (data as { content_updated_at?: unknown } | null)?.content_updated_at;
  return typeof value === 'string' && !Number.isNaN(Date.parse(value)) ? value : null;
}

/**
 * Newer public version, ONLY from data already in memory (no network):
 * the live copy was fetched after the download was saved and its
 * content_updated_at is later than the saved copy's.
 */
export function newerVersionAvailable(stored: StoredQueryCheck | undefined, live: { data: unknown; updatedAt: number } | null): boolean {
  if (!stored || stored.status !== 'ok' || !live || stored.savedAt === null || live.updatedAt <= stored.savedAt) return false;
  const saved = contentUpdatedAt(stored.data);
  const current = contentUpdatedAt(live.data);
  return !!saved && !!current && Date.parse(current) > Date.parse(saved);
}

export function entryHealth(entry: OfflineManifestEntry, stored: ReadonlyMap<string, StoredQueryCheck>, hasNewerVersion = false): ItemHealth {
  if (entry.queryHashes.some((hash) => stored.get(hash)?.status !== 'ok')) return 'incomplete';
  if (needsRefresh(entry) || hasNewerVersion) return 'update_available';
  return 'ready';
}

export function buildHealthReport(manifest: OfflineManifest, stored: ReadonlyMap<string, StoredQueryCheck>, newer: (entry: OfflineManifestEntry) => boolean = () => false, now = new Date()): HealthReport {
  const items: Record<string, ItemHealth> = {};
  const counts: Record<ItemHealth, number> = { ready: 0, incomplete: 0, update_available: 0 };
  for (const entry of Object.values(manifest.entries)) {
    const health = entryHealth(entry, stored, newer(entry));
    items[entry.id] = health;
    counts[health] += 1;
  }
  return { checkedAt: now.toISOString(), items, counts };
}

/** Items of a pack that need (re)downloading: incomplete ones and ones not on the device at all. */
export function itemsToRepair(items: readonly RegionPackItem[], manifest: OfflineManifest, report: HealthReport | null): RegionPackItem[] {
  return items.filter((item) => !manifest.entries[item.id] || report?.items[item.id] === 'incomplete');
}

/** Pack status after a check: never "ready" while any of its items is incomplete. */
export function packHealth(items: readonly RegionPackItem[], manifest: OfflineManifest, report: HealthReport | null): { ready: number; total: number; repairable: number } {
  const repairable = itemsToRepair(items, manifest, report).length;
  return { ready: items.length - repairable, total: items.length, repairable };
}
