import { onlineManager } from '@tanstack/react-query';
import { create } from 'zustand';

import { getCollection } from '@/features/collections/collectionsData';
import type { CultureItemRow, CultureMaterialRow, QuestRow } from '@/services/content/types';
import { queryClient } from '@/services/queryClient';

import { deleteQueries, hydrateQueryClient, measureOfflineBytes, readManifest, writeManifest, writeQuery } from './offlineCache';
import {
  downloadId,
  EMPTY_MANIFEST,
  hashQueryKey,
  needsRefresh,
  OFFLINE_CACHE_VERSION,
  removeEntry,
  upsertEntry,
  type OfflineKind,
  type OfflineManifest,
} from './offlineManifest';
import { fetcherFor, queryKeysForDownload } from './offlineQueries';

/** Remote images only - bundled `require()` assets are part of the app and
 * are never copied. Uses expo-image's disk cache (intentional prefetch). */
async function prefetchRemoteImages(urls: string[]): Promise<void> {
  if (urls.length === 0) return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Image } = require('expo-image') as typeof import('expo-image');
    await Image.prefetch(urls, 'disk');
  } catch {
    // Prefetch is best-effort; the text content is still saved.
  }
}

function remoteImageUrlsIn(data: unknown): string[] {
  const rows = Array.isArray(data) ? data : data ? [data] : [];
  return rows
    .map((row) => (row as Partial<CultureItemRow | CultureMaterialRow>).image_url)
    .filter((url): url is string => typeof url === 'string' && /^https?:\/\//.test(url));
}

type OfflineState = {
  isLoaded: boolean;
  manifest: OfflineManifest;
  inFlight: string[];
  failed: string[];
  load: () => Promise<void>;
  download: (kind: OfflineKind, contentId: string) => Promise<boolean>;
  remove: (id: string) => Promise<void>;
  removeAll: () => Promise<void>;
  /** Re-downloads every entry when online (fresh data, older cache
   * versions upgraded). A failure keeps the existing copy. */
  refreshAll: (onlyOutdated?: boolean) => Promise<void>;
  measureBytes: () => Promise<number>;
};

export const useOfflineStore = create<OfflineState>((set, get) => ({
  isLoaded: false,
  manifest: EMPTY_MANIFEST,
  inFlight: [],
  failed: [],

  load: async () => {
    const manifest = await readManifest();
    await hydrateQueryClient(queryClient, manifest);
    set({ manifest, isLoaded: true });
  },

  download: async (kind, contentId) => {
    const id = downloadId(kind, contentId);
    if (get().inFlight.includes(id)) return false;
    set({ inFlight: [...get().inFlight, id], failed: get().failed.filter((entry) => entry !== id) });
    try {
      if (!onlineManager.isOnline()) throw new Error('offline');
      let questId: string | null = null;
      if (kind === 'nature') {
        const quest = await queryClient.fetchQuery({ queryKey: ['quests', 'current'], queryFn: fetcherFor(['quests', 'current'])!, staleTime: 0 });
        questId = (quest as QuestRow | null)?.id ?? null;
      }
      const collection = kind === 'collection' ? getCollection(contentId) : undefined;
      if (kind === 'collection' && !collection) throw new Error('unknown collection');

      const keys = queryKeysForDownload(kind, contentId, { collection, questId });
      const remoteImageUrls: string[] = [];
      for (const key of keys) {
        const fetcher = fetcherFor(key);
        if (!fetcher) continue;
        const data = await queryClient.fetchQuery({ queryKey: key, queryFn: fetcher, staleTime: 0 });
        if (data === null || data === undefined) continue;
        await writeQuery(key, data);
        remoteImageUrls.push(...remoteImageUrlsIn(data));
      }
      const uniqueUrls = Array.from(new Set(remoteImageUrls));
      await prefetchRemoteImages(uniqueUrls);

      const manifest = upsertEntry(get().manifest, {
        id,
        kind,
        contentId,
        queryHashes: keys.filter((key) => !!fetcherFor(key)).map(hashQueryKey),
        remoteImageUrls: uniqueUrls,
        downloadedAt: new Date().toISOString(),
        version: OFFLINE_CACHE_VERSION,
      });
      await writeManifest(manifest);
      set({ manifest, inFlight: get().inFlight.filter((entry) => entry !== id) });
      return true;
    } catch {
      set({ inFlight: get().inFlight.filter((entry) => entry !== id), failed: [...get().failed.filter((entry) => entry !== id), id] });
      return false;
    }
  },

  remove: async (id) => {
    const { manifest, orphanHashes } = removeEntry(get().manifest, id);
    await deleteQueries(orphanHashes);
    await writeManifest(manifest);
    set({ manifest, failed: get().failed.filter((entry) => entry !== id) });
  },

  removeAll: async () => {
    let manifest = get().manifest;
    for (const id of Object.keys(manifest.entries)) {
      const result = removeEntry(manifest, id);
      await deleteQueries(result.orphanHashes);
      manifest = result.manifest;
    }
    await writeManifest(manifest);
    set({ manifest, failed: [] });
  },

  refreshAll: async (onlyOutdated = false) => {
    if (!onlineManager.isOnline()) return;
    for (const entry of Object.values(get().manifest.entries)) {
      if (onlyOutdated && !needsRefresh(entry)) continue;
      await get().download(entry.kind, entry.contentId);
      // A failed refresh leaves the previous entry (and its data) in place.
      set({ failed: get().failed.filter((id) => id !== entry.id) });
    }
  },

  measureBytes: () => measureOfflineBytes(get().manifest),
}));

export function useDownloadState(kind: OfflineKind, contentId: string) {
  const id = downloadId(kind, contentId);
  return useOfflineStore((state) => (state.inFlight.includes(id) ? 'downloading' : state.failed.includes(id) ? 'error' : state.manifest.entries[id] ? 'downloaded' : 'not_downloaded'));
}
