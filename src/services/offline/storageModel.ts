import { downloadId, requestersOf, USER_REQUESTER, type OfflineKind, type OfflineManifest, type OfflineManifestEntry } from './offlineManifest';

/**
 * Smart Storage Manager - a READ model over the ONE offline manifest
 * (offlineManifest.ts). No second manifest, no file walking: only entries
 * OYNO's offline system created, with their real owners (`requestedBy`).
 *
 * Owners ("requesters"): 'user' (saved on its own), 'region:<id>',
 * 'path:<id>'. An entry is stored once however many owners need it, and
 * is removed only when its LAST owner releases it.
 */

export type StorageCategory = 'articles' | 'places' | 'collections' | 'support';
const CATEGORY: Record<OfflineKind, StorageCategory> = { culture_item: 'articles', nature: 'places', collection: 'collections', culture_index: 'support' };

export type OwnerRef = { kind: 'user' } | { kind: 'region'; id: string } | { kind: 'path'; id: string } | { kind: 'unknown'; raw: string };

export function parseOwner(raw: string): OwnerRef {
  if (raw === USER_REQUESTER) return { kind: 'user' };
  if (raw.startsWith('region:') && raw.length > 7) return { kind: 'region', id: raw.slice(7) };
  if (raw.startsWith('path:') && raw.length > 5) return { kind: 'path', id: raw.slice(5) };
  return { kind: 'unknown', raw };
}

export type InventoryItem = { id: string; kind: OfflineKind; contentId: string; category: StorageCategory; owners: OwnerRef[]; shared: boolean };

export type Inventory = {
  items: InventoryItem[];
  /** Real items people downloaded (support data excluded). */
  itemCount: number;
  byCategory: Record<StorageCategory, number>;
  /** Each item exactly once, with all its owners. */
  sharedCount: number;
  downloading: number;
};

export function storageInventory(manifest: OfflineManifest, inFlight: readonly string[]): Inventory {
  const items = Object.values(manifest.entries)
    .map((entry: OfflineManifestEntry): InventoryItem => {
      const owners = requestersOf(entry).map(parseOwner);
      return { id: entry.id, kind: entry.kind, contentId: entry.contentId, category: CATEGORY[entry.kind] ?? 'support', owners, shared: owners.length > 1 };
    })
    .sort((a, b) => a.id.localeCompare(b.id));
  const byCategory: Record<StorageCategory, number> = { articles: 0, places: 0, collections: 0, support: 0 };
  for (const item of items) byCategory[item.category] += 1;
  return {
    items,
    itemCount: items.filter((item) => item.category !== 'support').length,
    byCategory,
    sharedCount: items.filter((item) => item.shared && item.category !== 'support').length,
    downloading: inFlight.filter((id) => !manifest.entries[id]).length,
  };
}

/**
 * GENUINELY unused: an entry whose every owner no longer exists (a removed
 * Learning Path or Region, or an unknown owner tag). A person's own
 * download ('user') is never "unused". Owners are judged only against
 * KNOWN lists (pass null for a list that isn't known -> nothing judged).
 */
export function unusedEntries(manifest: OfflineManifest, known: { regionIds: readonly string[] | null; pathIds: readonly string[] }): string[] {
  return Object.values(manifest.entries)
    .filter((entry) => {
      const owners = requestersOf(entry).map(parseOwner);
      return owners.every((owner) => {
        if (owner.kind === 'user') return false;
        if (owner.kind === 'path') return !known.pathIds.includes(owner.id);
        if (owner.kind === 'region') return known.regionIds !== null && !known.regionIds.includes(owner.id);
        return true;
      });
    })
    .map((entry) => entry.id)
    .sort();
}

/** Owners of an entry that no longer exist (released during cleanup). */
export function staleOwners(entry: OfflineManifestEntry, known: { regionIds: readonly string[] | null; pathIds: readonly string[] }): string[] {
  return requestersOf(entry).filter((raw) => {
    const owner = parseOwner(raw);
    if (owner.kind === 'path') return !known.pathIds.includes(owner.id);
    if (owner.kind === 'region') return known.regionIds !== null && !known.regionIds.includes(owner.id);
    return owner.kind === 'unknown';
  });
}

/** After a pack is removed: items kept on the device because another owner still needs them. */
export function keptAfterRemoval(manifest: OfflineManifest, packItemIds: readonly string[]): number {
  return packItemIds.filter((id) => !!manifest.entries[id]).length;
}

/** Failed downloads with no usable copy - "Needs attention". */
export function needsAttention(manifest: OfflineManifest, inFlight: readonly string[], failed: readonly string[]): { id: string; kind: OfflineKind; contentId: string }[] {
  return failed
    .filter((id) => !manifest.entries[id] && !inFlight.includes(id))
    .flatMap((id) => {
      const index = id.indexOf(':');
      const kind = id.slice(0, index) as OfflineKind;
      return index > 0 && kind in CATEGORY ? [{ id, kind, contentId: id.slice(index + 1) }] : [];
    });
}

export { downloadId };
