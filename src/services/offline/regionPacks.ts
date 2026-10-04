import type { RegionExperienceConfig } from '@/features/explore/regions/regionExperiences';

import { downloadId, requestersOf, type OfflineKind, type OfflineManifest } from './offlineManifest';

/**
 * Region offline packs - NOT a second download system. A pack is the list of
 * EXISTING individual downloads for a region's linked content; downloading a
 * pack runs those downloads (tagged 'region:<id>'), and removing it only
 * releases that tag, so an item saved on its own, or by another pack, stays.
 */
export type RegionPackItem = { kind: OfflineKind; contentId: string; id: string };

export type RegionPackManifest = {
  items: RegionPackItem[];
  /** Linked content the existing offline system has no download for
   * (reported, never faked). */
  notDownloadable: { type: 'culture_material'; id: string }[];
};

export function regionRequester(regionId: string): string {
  return `region:${regionId}`;
}

/**
 * Deterministic, de-duplicated list of downloads for a region:
 * - each place (the region itself and its member places) -> the existing
 *   'nature' download: its destination page data, discoveries and the
 *   current quest (discovery content comes with it);
 * - each linked culture item -> the existing 'culture_item' download.
 * Trails, guided quests, the illustrated map and every bundled photo are
 * part of the app already, so nothing is downloaded for them.
 */
export function buildRegionOfflineManifest(config: RegionExperienceConfig): RegionPackManifest {
  const seen = new Set<string>();
  const items: RegionPackItem[] = [];
  const add = (kind: OfflineKind, contentId: string) => {
    const id = downloadId(kind, contentId);
    if (seen.has(id)) return;
    seen.add(id);
    items.push({ kind, contentId, id });
  };
  for (const id of config.destinationIds) add('nature', id);
  for (const id of config.cultureItemIds) add('culture_item', id);
  return { items, notDownloadable: config.materialIds.map((id) => ({ type: 'culture_material' as const, id })) };
}

export type RegionPackStatus = 'none' | 'downloading' | 'available' | 'partial' | 'attention';

export type RegionPackState = {
  status: RegionPackStatus;
  total: number;
  /** Items with a complete copy on this device (from any requester). */
  downloaded: number;
  /** Whether this region's pack has been requested at all. */
  requested: boolean;
  missingIds: string[];
  failedIds: string[];
};

/**
 * Derived only from the real download state. "Available offline" only when
 * EVERY item has a complete copy; some but not all -> "partial" (never
 * rounded up); a failure with items still missing -> "attention".
 */
export function regionPackState(pack: RegionPackManifest, regionId: string, manifest: OfflineManifest, inFlight: readonly string[], failed: readonly string[]): RegionPackState {
  const requester = regionRequester(regionId);
  const downloadedIds = pack.items.filter((item) => !!manifest.entries[item.id]).map((item) => item.id);
  const missingIds = pack.items.filter((item) => !manifest.entries[item.id]).map((item) => item.id);
  const failedIds = missingIds.filter((id) => failed.includes(id));
  const requested = pack.items.some((item) => requestersOf(manifest.entries[item.id]).includes(requester));
  const downloading = pack.items.some((item) => inFlight.includes(item.id));
  const total = pack.items.length;
  const downloaded = downloadedIds.length;
  const status: RegionPackStatus = downloading
    ? 'downloading'
    : total > 0 && downloaded === total
      ? 'available'
      : failedIds.length > 0
        ? 'attention'
        : downloaded > 0
          ? 'partial'
          : 'none';
  return { status, total, downloaded, requested, missingIds, failedIds };
}

/** Region ids whose pack the user asked for (for the Offline manager). */
export function requestedRegionIds(manifest: OfflineManifest): string[] {
  const ids = new Set<string>();
  for (const entry of Object.values(manifest.entries)) {
    for (const requester of requestersOf(entry)) if (requester.startsWith('region:')) ids.add(requester.slice('region:'.length));
  }
  return [...ids];
}

export type PackStore = {
  manifest: OfflineManifest;
  download: (kind: OfflineKind, contentId: string, requester?: string, priority?: 'user' | 'background') => Promise<boolean>;
  claim: (id: string, requester: string) => Promise<void>;
  release: (id: string, requester: string) => Promise<void>;
  /** Download queue: cancel this owner's queued / running request. */
  cancel?: (id: string, requester: string) => Promise<void>;
};

/**
 * Download (or retry) a pack: items already on the device are only tagged
 * (never fetched or stored twice); only missing/failed items download.
 * Successful items are kept if another item fails. Returns how many of the
 * pack's items are on the device afterwards.
 */
export async function downloadRegionPack(regionId: string, pack: RegionPackManifest, store: () => PackStore): Promise<number> {
  return downloadPackItems(regionRequester(regionId), pack.items, store);
}

/** Shared by Region and Learning Path packs: claim what is already on the
 * device (stored once), then QUEUE everything missing in one go (the
 * download queue dedupes items another pack already asked for and runs
 * them under the network policy). */
export async function downloadPackItems(requester: string, items: readonly RegionPackItem[], store: () => PackStore, priority: 'user' | 'background' = 'user'): Promise<number> {
  const missing: RegionPackItem[] = [];
  for (const item of items) {
    if (store().manifest.entries[item.id]) await store().claim(item.id, requester);
    else missing.push(item);
  }
  await Promise.all(missing.map((item) => store().download(item.kind, item.contentId, requester, priority)));
  return items.filter((item) => !!store().manifest.entries[item.id]).length;
}

/**
 * Cancel a pack request that is still queued / downloading: only this
 * pack's claim on items not yet downloaded is withdrawn. Items another
 * owner wants keep downloading; items already downloaded stay (Remove
 * handles those, with the same shared-ownership rule).
 */
export async function cancelPackItems(requester: string, items: readonly RegionPackItem[], store: () => PackStore): Promise<void> {
  for (const item of items) if (!store().manifest.entries[item.id]) await store().cancel?.(item.id, requester);
}

/** Releases only this requester's claim on each item. */
export async function releasePackItems(requester: string, items: readonly RegionPackItem[], store: () => PackStore): Promise<void> {
  for (const item of items) await store().release(item.id, requester);
}

/** Remove a pack: release its claim on each item. Items also saved on their
 * own or by another region stay on the device. */
export async function removeRegionPack(regionId: string, pack: RegionPackManifest, store: () => PackStore): Promise<void> {
  await releasePackItems(regionRequester(regionId), pack.items, store);
}
