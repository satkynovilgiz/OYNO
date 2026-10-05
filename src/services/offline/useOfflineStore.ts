import AsyncStorage from '@react-native-async-storage/async-storage';
import { onlineManager } from '@tanstack/react-query';
import { create } from 'zustand';

import { getCollection } from '@/features/collections/collectionsData';
import type { CultureItemRow, CultureMaterialRow, QuestRow } from '@/services/content/types';
import { queryClient } from '@/services/queryClient';

import { deleteQueries, hydrateQueryClient, measureOfflineBytes, pruneOrphanQueries, readManifest, verifyStoredQueries, writeManifest, writeQuery } from './offlineCache';
import { buildHealthReport, newerVersionAvailable, type HealthReport } from './offlineHealth';
import {
  downloadId,
  EMPTY_MANIFEST,
  hashQueryKey,
  needsRefresh,
  OFFLINE_CACHE_VERSION,
  removeEntry,
  requestersOf,
  upsertEntry,
  USER_REQUESTER,
  type OfflineKind,
  type OfflineManifest,
} from './offlineManifest';
import { fetcherFor, queryKeysForDownload } from './offlineQueries';
import {
  cancelRequest,
  DEFAULT_DOWNLOAD_PREFERENCE,
  effectivePreference,
  EMPTY_QUEUE,
  enqueue,
  networkGate,
  nextIntent,
  parsePreference,
  parseQueue,
  removeIntent,
  setStatus,
  type DownloadPreference,
  type DownloadQueue,
  type NetworkGate,
  type NetworkSnapshot,
  type QueuePriority,
} from './downloadQueue';

export const DOWNLOAD_QUEUE_KEY = 'oyno.offline.queue.v1';
export const DOWNLOAD_PREFERENCE_KEY = 'oyno.offline.downloadOn.v1';

/** Transient completion callbacks for callers awaiting a queued download.
 * Never persisted - after a restart the intent simply runs again. */
const waiters = new Map<string, ((ok: boolean) => void)[]>();
function settle(id: string, ok: boolean) {
  const list = waiters.get(id) ?? [];
  waiters.delete(id);
  for (const resolve of list) resolve(ok);
}

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
  /** Requested and not finished (queued, waiting or downloading) - derived from `queue`. */
  inFlight: string[];
  /** Failed with no retry pending - derived from `queue`. */
  failed: string[];
  /** The ONE download queue (persisted intent; see downloadQueue.ts). */
  queue: DownloadQueue;
  /** Settings -> Downloads. Stored even where Wi-Fi can't be detected; applied only where it can. */
  preference: DownloadPreference;
  wifiSupported: boolean;
  network: NetworkSnapshot;
  appActive: boolean;
  load: () => Promise<void>;
  /**
   * Queue a download (the existing download runs when the network policy
   * allows). `requester` (default 'user') is recorded on the entry; an
   * existing entry keeps its other requesters; the same id requested twice
   * is ONE download. Resolves when it completes (true), fails or is
   * cancelled (false).
   */
  download: (kind: OfflineKind, contentId: string, requester?: string, priority?: QueuePriority) => Promise<boolean>;
  /** Cancel one owner's queued / in-progress request (shared items other owners need continue). */
  cancel: (id: string, requester: string) => Promise<void>;
  setPreference: (preference: DownloadPreference) => Promise<void>;
  /** Runtime signals (network, app foreground) - processing resumes automatically. */
  setRuntime: (runtime: Partial<Pick<OfflineState, 'network' | 'appActive' | 'wifiSupported'>>) => void;
  gate: () => NetworkGate;
  /** Run queued work now if allowed (no-op while running or waiting). */
  pump: () => Promise<void>;
  /** Last "Check downloads" result (null until checked). */
  health: HealthReport | null;
  /** Local-only check of every download's stored data (no network). */
  checkDownloads: () => Promise<HealthReport>;
  /** Re-download incomplete items through the SAME deduplicated queue (network
   * and Wi-Fi rules apply). Existing copies stay until a repair succeeds. */
  repair: (items: readonly { kind: OfflineKind; contentId: string; requester?: string }[]) => Promise<boolean[]>;
  /** Adds a requester to an entry that is already downloaded (no refetch). */
  claim: (id: string, requester: string) => Promise<void>;
  /** Drops one requester; the entry (and data no other entry uses) is
   * removed only when no requester is left. */
  release: (id: string, requester: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
  /** Forgets a failed attempt (no copy existed - nothing on disk to delete). */
  dismissFailed: (id: string) => void;
  removeAll: () => Promise<void>;
  /** Re-downloads every entry when online (fresh data, older cache
   * versions upgraded). A failure keeps the existing copy. */
  refreshAll: (onlyOutdated?: boolean) => Promise<void>;
  measureBytes: () => Promise<number>;
};

type Internal = { runDownload: (kind: OfflineKind, contentId: string, requester: string) => Promise<boolean> };

let pumping = false;

/** inFlight / failed are derived from the queue so every existing screen keeps reading them. */
function derived(queue: DownloadQueue) {
  return { inFlight: queue.intents.filter((intent) => intent.status !== 'failed').map((intent) => intent.id), failed: queue.intents.filter((intent) => intent.status === 'failed').map((intent) => intent.id) };
}

export const useOfflineStore = create<OfflineState>((set, get) => {
  const setQueue = (queue: DownloadQueue) => {
    if (queue === get().queue) return;
    set({ queue, ...derived(queue) });
    void AsyncStorage.setItem(DOWNLOAD_QUEUE_KEY, JSON.stringify(queue)).catch(() => undefined);
  };
  return {
    isLoaded: false,
    manifest: EMPTY_MANIFEST,
    inFlight: [],
    failed: [],
    queue: EMPTY_QUEUE,
    preference: DEFAULT_DOWNLOAD_PREFERENCE,
    wifiSupported: false,
    health: null,
    network: { isConnected: undefined, type: undefined },
    appActive: true,

    load: async () => {
      const manifest = await readManifest();
      // Awaited BEFORE the store reports loaded: boot starts refreshAll() only
      // after load() resolves, so no download can be writing yet - any stored
      // query no manifest entry references is a leftover of an interrupted
      // download, and removing it can't race a new one.
      await pruneOrphanQueries(manifest);
      await hydrateQueryClient(queryClient, manifest);
      // Queue intent from the last session: interrupted downloads continue.
      const [rawQueue, rawPreference] = await Promise.all([AsyncStorage.getItem(DOWNLOAD_QUEUE_KEY).catch(() => null), AsyncStorage.getItem(DOWNLOAD_PREFERENCE_KEY).catch(() => null)]);
      let queue = EMPTY_QUEUE;
      try {
        queue = parseQueue(rawQueue ? JSON.parse(rawQueue) : null);
      } catch {
        queue = EMPTY_QUEUE;
      }
      // Already complete (finished just before the app stopped): nothing to do.
      queue = { intents: queue.intents.filter((intent) => !(manifest.entries[intent.id] && intent.status !== 'failed' && intent.requesters.every((requester) => requestersOf(manifest.entries[intent.id]).includes(requester)))) };
      // Requests made before load finished are kept (merged, never duplicated).
      for (const intent of get().queue.intents) for (const requester of intent.requesters) queue = enqueue(queue, { id: intent.id, kind: intent.kind, contentId: intent.contentId, requester, priority: intent.priority });
      set({ manifest, isLoaded: true, queue, ...derived(queue), preference: parsePreference(rawPreference) });
      void get().pump();
    },

    download: (kind, contentId, requester = USER_REQUESTER, priority = 'user') => {
      const id = downloadId(kind, contentId);
      const promise = new Promise<boolean>((resolve) => waiters.set(id, [...(waiters.get(id) ?? []), resolve]));
      setQueue(enqueue(get().queue, { id, kind, contentId, requester, priority }));
      void get().pump();
      return promise;
    },

    cancel: async (id, requester) => {
      const result = cancelRequest(get().queue, id, requester);
      if (result.queue === get().queue) return;
      setQueue(result.queue);
      // Nobody wants it any more: callers stop waiting. A download already
      // running finishes, then releases this owner's claim (see pump).
      if (result.removed) settle(id, false);
    },

    setPreference: async (preference) => {
      set({ preference });
      await AsyncStorage.setItem(DOWNLOAD_PREFERENCE_KEY, preference).catch(() => undefined);
      void get().pump();
    },

    setRuntime: (runtime) => {
      set(runtime);
      void get().pump();
    },

    gate: () => {
      const { preference, wifiSupported, network } = get();
      return networkGate(effectivePreference(preference, wifiSupported), network, wifiSupported);
    },

    pump: async () => {
      // V1: processes while the app is active only (no background transfer claimed).
      if (pumping || !get().isLoaded || !get().appActive) return;
      pumping = true;
      try {
        for (;;) {
          if (get().gate() !== 'go' || !onlineManager.isOnline() || !get().appActive) break;
          const intent = nextIntent(get().queue);
          if (!intent) break;
          const primary = intent.requesters[0];
          const hadPrimary = requestersOf(get().manifest.entries[intent.id]).includes(primary) && !!get().manifest.entries[intent.id];
          setQueue(setStatus(get().queue, intent.id, 'downloading'));
          const ok = await (get() as unknown as Internal).runDownload(intent.kind, intent.contentId, primary);
          const current = get().queue.intents.find((candidate) => candidate.id === intent.id);
          if (ok) {
            // Every owner still waiting gets its claim (stored once, shared).
            for (const requester of current?.requesters ?? []) if (requester !== primary) await get().claim(intent.id, requester);
            // The owner it ran for cancelled meanwhile: drop only that claim
            // (the copy goes only if nobody else needs it).
            if (!(current?.requesters ?? []).includes(primary) && !hadPrimary) await get().release(intent.id, primary);
            setQueue(removeIntent(get().queue, intent.id));
            // A fresh, complete copy was just written: no longer incomplete.
            const health = get().health;
            if (health && health.items[intent.id] && health.items[intent.id] !== 'ready') {
              const items = { ...health.items, [intent.id]: 'ready' as const };
              const counts = { ready: 0, incomplete: 0, update_available: 0 };
              for (const value of Object.values(items)) counts[value] += 1;
              set({ health: { ...health, items, counts } });
            }
            settle(intent.id, true);
          } else if (!current) {
            settle(intent.id, false);
          } else if (!onlineManager.isOnline() || get().gate() !== 'go') {
            // Connection lost mid-way: waiting, not failed.
            setQueue(setStatus(get().queue, intent.id, 'queued'));
          } else if (get().manifest.entries[intent.id]) {
            // A background refresh failed: the existing copy stays usable.
            setQueue(removeIntent(get().queue, intent.id));
            settle(intent.id, false);
          } else {
            setQueue(setStatus(get().queue, intent.id, 'failed', true));
            settle(intent.id, false);
          }
        }
      } finally {
        pumping = false;
      }
    },

    runDownload: async (kind: OfflineKind, contentId: string, requester: string): Promise<boolean> => {
      const id = downloadId(kind, contentId);
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
          requestedBy: Array.from(new Set([...(get().manifest.entries[id] ? requestersOf(get().manifest.entries[id]) : []), requester])),
        });
        await writeManifest(manifest);
        set({ manifest });
        return true;
      } catch {
        return false;
      }
    },

    claim: async (id, requester) => {
      const entry = get().manifest.entries[id];
      if (!entry || requestersOf(entry).includes(requester)) return;
      const manifest = upsertEntry(get().manifest, { ...entry, requestedBy: [...requestersOf(entry), requester] });
      await writeManifest(manifest);
      set({ manifest });
    },

    release: async (id, requester) => {
      const entry = get().manifest.entries[id];
      if (!entry) return;
      const remaining = requestersOf(entry).filter((value) => value !== requester);
      if (remaining.length > 0) {
        if (remaining.length === requestersOf(entry).length) return;
        const manifest = upsertEntry(get().manifest, { ...entry, requestedBy: remaining });
        await writeManifest(manifest);
        set({ manifest });
        return;
      }
      await get().remove(id);
    },

    remove: async (id) => {
      const { manifest, orphanHashes } = removeEntry(get().manifest, id);
      await deleteQueries(orphanHashes);
      await writeManifest(manifest);
      set({ manifest, failed: get().failed.filter((entry) => entry !== id) });
    },

    dismissFailed: (id) => {
      const intent = get().queue.intents.find((candidate) => candidate.id === id);
      if (intent?.status === 'failed') setQueue(removeIntent(get().queue, id));
    },

    removeAll: async () => {
      let manifest = get().manifest;
      for (const id of Object.keys(manifest.entries)) {
        const result = removeEntry(manifest, id);
        await deleteQueries(result.orphanHashes);
        manifest = result.manifest;
      }
      await writeManifest(manifest);
      set({ manifest });
      setQueue({ intents: get().queue.intents.filter((intent) => intent.status !== 'failed') });
    },

    refreshAll: async (onlyOutdated = false) => {
      if (!onlineManager.isOnline()) return;
      // Background priority: a download the person just asked for goes first.
      // A failed refresh leaves the previous entry (and its data) in place.
      const entries = Object.values(get().manifest.entries).filter((entry) => !onlyOutdated || needsRefresh(entry));
      await Promise.all(entries.map((entry) => get().download(entry.kind, entry.contentId, requestersOf(entry)[0], 'background')));
    },

    measureBytes: () => measureOfflineBytes(get().manifest),

    checkDownloads: async () => {
      const manifest = get().manifest;
      const hashes = [...new Set(Object.values(manifest.entries).flatMap((entry) => entry.queryHashes))];
      const stored = await verifyStoredQueries(hashes);
      const report = buildHealthReport(manifest, stored, (entry) => {
        if (entry.kind !== 'culture_item') return false;
        const key = ['culture_item', entry.contentId];
        const state = queryClient.getQueryState(key);
        return newerVersionAvailable(stored.get(hashQueryKey(key)), state?.data !== undefined ? { data: state.data, updatedAt: state.dataUpdatedAt } : null);
      });
      set({ health: report });
      return report;
    },

    repair: (items) =>
      Promise.all(
        items.map((item) => {
          const entry = get().manifest.entries[downloadId(item.kind, item.contentId)];
          return get().download(item.kind, item.contentId, item.requester ?? requestersOf(entry)[0] ?? USER_REQUESTER, 'user');
        }),
      ),
  };
});

export function useDownloadState(kind: OfflineKind, contentId: string) {
  const id = downloadId(kind, contentId);
  // An entry whose stored data failed the last check is NOT "downloaded".
  return useOfflineStore((state) => (state.inFlight.includes(id) ? 'downloading' : state.failed.includes(id) || state.health?.items[id] === 'incomplete' ? 'error' : state.manifest.entries[id] ? 'downloaded' : 'not_downloaded'));
}
