/**
 * "Check downloads" + repair, against the REAL offline store, queue and
 * cache over the in-memory AsyncStorage from jest.setup.js. Only the
 * content fetchers are faked (they would hit Supabase).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { onlineManager } from '@tanstack/react-query';

import { queryClient } from '@/services/queryClient';

import { verifyStoredQueries } from './offlineCache';
import { buildHealthReport, itemsToRepair, newerVersionAvailable, packHealth } from './offlineHealth';
import { hashQueryKey, OFFLINE_CACHE_VERSION, type OfflineManifest } from './offlineManifest';
import { buildOfflineView } from './offlineModel';
import { cancelPackItems, repairPackItems, type RegionPackItem } from './regionPacks';
import { useOfflineStore } from './useOfflineStore';

jest.mock('@/services/supabase/client', () => ({ supabase: { from: jest.fn(), rpc: jest.fn() } }));
const mockFetches: string[] = [];
let mockGate: Promise<void> | null = null;
jest.mock('./offlineQueries', () => {
  const actual = jest.requireActual('./offlineQueries');
  return {
    ...actual,
    fetcherFor: (key: [string, string?]) => {
      if (key[0] === 'culture_item')
        return async () => {
          mockFetches.push(`culture_item:${key[1]}`);
          if (mockGate) await mockGate;
          return { id: key[1], title: 'x', image_url: null, content_updated_at: '2026-10-01T00:00:00Z' };
        };
      if (key[0] === 'content_translations') return async () => [];
      return null;
    },
  };
});
jest.mock('expo-image', () => ({ Image: { prefetch: jest.fn(async () => true) } }));

const store = useOfflineStore.getState;
const itemKey = (id: string) => `oyno.offline.query:${hashQueryKey(['culture_item', id])}`;
const A: RegionPackItem = { kind: 'culture_item', contentId: 'a', id: 'culture_item:a' };
const B: RegionPackItem = { kind: 'culture_item', contentId: 'b', id: 'culture_item:b' };
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeAll(() => queryClient.setDefaultOptions({ queries: { ...queryClient.getDefaultOptions().queries, retry: false } }));
afterAll(() => queryClient.clear());
beforeEach(async () => {
  await AsyncStorage.clear();
  queryClient.clear();
  onlineManager.setOnline(true);
  mockFetches.length = 0;
  mockGate = null;
  useOfflineStore.setState({ manifest: { entries: {} }, inFlight: [], failed: [], queue: { intents: [] }, isLoaded: true, appActive: true, network: { isConnected: true, type: 'WIFI' }, preference: 'any', wifiSupported: true, health: null });
});

async function downloaded(...ids: string[]) {
  for (const id of ids) await store().download('culture_item', id, 'region:naryn');
  mockFetches.length = 0;
}

describe('Check downloads', () => {
  it('a complete download is ready', async () => {
    await downloaded('a');
    const report = await store().checkDownloads();
    expect(report.items['culture_item:a']).toBe('ready');
    expect(report.counts).toEqual({ ready: 1, incomplete: 0, update_available: 0 });
  });

  it('a manifest entry whose cached data is missing is NOT reported as ready (nor shown as available)', async () => {
    await downloaded('a', 'b');
    await AsyncStorage.removeItem(itemKey('a'));
    const report = await store().checkDownloads();
    expect(report.items['culture_item:a']).toBe('incomplete');
    expect(report.items['culture_item:b']).toBe('ready');
    const view = buildOfflineView(store().manifest, [], [], [], ['culture_item:a']);
    expect(view.needsRepair.map((row) => row.id)).toEqual(['culture_item:a']);
    expect(view.availableCount).toBe(1);
  });

  it('malformed cached data is reported (no crash) and repaired', async () => {
    await downloaded('a');
    await AsyncStorage.setItem(itemKey('a'), '{"key": not json');
    const stored = await verifyStoredQueries([hashQueryKey(['culture_item', 'a'])]);
    expect([...stored.values()][0].status).toBe('corrupt');
    expect((await store().checkDownloads()).items['culture_item:a']).toBe('incomplete');
    await expect(store().repair([{ kind: 'culture_item', contentId: 'a' }])).resolves.toEqual([true]);
    expect(store().health?.items['culture_item:a']).toBe('ready');
    expect((await store().checkDownloads()).items['culture_item:a']).toBe('ready');
  });

  it('a stored value for a DIFFERENT key, or without data, is not accepted', async () => {
    await downloaded('a');
    await AsyncStorage.setItem(itemKey('a'), JSON.stringify({ key: ['culture_item', 'zzz'], data: {}, savedAt: 1 }));
    expect((await store().checkDownloads()).items['culture_item:a']).toBe('incomplete');
    await AsyncStorage.setItem(itemKey('a'), JSON.stringify({ key: ['culture_item', 'a'], savedAt: 1 }));
    expect((await store().checkDownloads()).items['culture_item:a']).toBe('incomplete');
  });

  it('works offline without any network request, and removes nothing', async () => {
    await downloaded('a');
    await AsyncStorage.removeItem(itemKey('a'));
    onlineManager.setOnline(false);
    const fetchSpy = jest.spyOn(globalThis, 'fetch');
    const before = JSON.stringify(store().manifest);
    await store().checkDownloads();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(mockFetches).toEqual([]);
    expect(JSON.stringify(store().manifest)).toBe(before);
    fetchSpy.mockRestore();
  });

  it('update available only from a REAL signal: an older offline format, or a newer content_updated_at fetched since', () => {
    const manifest: OfflineManifest = { entries: { 'culture_item:a': { id: 'culture_item:a', kind: 'culture_item', contentId: 'a', queryHashes: ['h'], remoteImageUrls: [], downloadedAt: '2026-10-01', version: OFFLINE_CACHE_VERSION - 1 } } };
    const ok = new Map([['h', { status: 'ok' as const, savedAt: 1000, data: { content_updated_at: '2026-09-01T00:00:00Z' } }]]);
    expect(buildHealthReport(manifest, ok).items['culture_item:a']).toBe('update_available');
    expect(newerVersionAvailable(ok.get('h'), { data: { content_updated_at: '2026-09-20T00:00:00Z' }, updatedAt: 2000 })).toBe(true);
    // Fetched BEFORE the download was saved, or not newer, or no signal: no claim.
    expect(newerVersionAvailable(ok.get('h'), { data: { content_updated_at: '2026-09-20T00:00:00Z' }, updatedAt: 500 })).toBe(false);
    expect(newerVersionAvailable(ok.get('h'), { data: { content_updated_at: '2026-08-01T00:00:00Z' }, updatedAt: 2000 })).toBe(false);
    expect(newerVersionAvailable(ok.get('h'), { data: {}, updatedAt: 2000 })).toBe(false);
    expect(newerVersionAvailable(ok.get('h'), null)).toBe(false);
  });
});

describe('Repair', () => {
  it('overlapping packs enqueue a shared repair only once; both packs keep their claim', async () => {
    await downloaded('a');
    await AsyncStorage.removeItem(itemKey('a'));
    await store().checkDownloads();
    const regionItems = [A];
    const pathItems = [A, B];
    await Promise.all([
      repairPackItems('region:naryn', regionItems, itemsToRepair(regionItems, store().manifest, store().health), store),
      repairPackItems('path:boz-uy', pathItems, itemsToRepair(pathItems, store().manifest, store().health), store),
    ]);
    expect(mockFetches.filter((id) => id === 'culture_item:a')).toHaveLength(1);
    expect(mockFetches.filter((id) => id === 'culture_item:b')).toHaveLength(1);
    expect(store().manifest.entries['culture_item:a'].requestedBy?.sort()).toEqual(['path:boz-uy', 'region:naryn']);
    expect(packHealth(pathItems, store().manifest, store().health)).toEqual({ ready: 2, total: 2, repairable: 0 });
  });

  it("cancelling one pack's repair does not cancel another pack's required repair", async () => {
    await downloaded('a');
    await AsyncStorage.removeItem(itemKey('a'));
    await store().checkDownloads();
    let release!: () => void;
    mockGate = new Promise<void>((resolve) => (release = resolve));
    const first = repairPackItems('region:naryn', [A], [A], store);
    const second = repairPackItems('path:boz-uy', [A], [A], store);
    await tick();
    await cancelPackItems('region:naryn', [A], store);
    expect(store().queue.intents.find((intent) => intent.id === A.id)?.requesters).toEqual(['path:boz-uy']);
    release();
    await Promise.all([first, second]);
    expect(store().health?.items[A.id]).toBe('ready');
    expect(await AsyncStorage.getItem(itemKey('a'))).not.toBeNull();
    // The item was the region's before; it stays on the device for both.
    expect(store().manifest.entries[A.id]).toBeDefined();
  });

  it('repair waits while offline (usable content untouched, not "failed") and resumes when the connection returns', async () => {
    await downloaded('a');
    await AsyncStorage.removeItem(itemKey('a'));
    await store().checkDownloads();
    onlineManager.setOnline(false);
    useOfflineStore.setState({ network: { isConnected: false, type: 'NONE' } });
    const pending = store().repair([{ kind: 'culture_item', contentId: 'a' }]);
    await tick();
    expect(store().failed).toEqual([]);
    expect(store().manifest.entries[A.id]).toBeDefined();
    expect(mockFetches).toEqual([]);
    onlineManager.setOnline(true);
    store().setRuntime({ network: { isConnected: true, type: 'WIFI' } });
    await expect(pending).resolves.toEqual([true]);
    expect(store().health?.items[A.id]).toBe('ready');
  });

  it('repair respects Wi-Fi-only: waits on cellular', async () => {
    await downloaded('a');
    await AsyncStorage.removeItem(itemKey('a'));
    await store().checkDownloads();
    useOfflineStore.setState({ preference: 'wifi_only', network: { isConnected: true, type: 'CELLULAR' } });
    const pending = store().repair([{ kind: 'culture_item', contentId: 'a' }]);
    await tick();
    expect(mockFetches).toEqual([]);
    store().setRuntime({ network: { isConnected: true, type: 'WIFI' } });
    await expect(pending).resolves.toEqual([true]);
  });

  it('only public offline content is checked: journal / account keys are never read or touched', async () => {
    await AsyncStorage.setItem('oyno.journal.entries', '["private"]');
    await downloaded('a');
    const requested: string[] = [];
    const original = AsyncStorage.multiGet;
    AsyncStorage.multiGet = (async (keys: readonly string[]) => {
      requested.push(...keys);
      return original(keys);
    }) as typeof AsyncStorage.multiGet;
    try {
      await store().checkDownloads();
    } finally {
      AsyncStorage.multiGet = original;
    }
    expect(requested.length).toBeGreaterThan(0);
    expect(requested.every((key) => key.startsWith('oyno.offline.query:'))).toBe(true);
    expect(await AsyncStorage.getItem('oyno.journal.entries')).toBe('["private"]');
  });
});
