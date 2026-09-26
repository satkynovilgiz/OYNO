import AsyncStorage from '@react-native-async-storage/async-storage';
import { onlineManager, QueryClient } from '@tanstack/react-query';

import { getCollection } from '@/features/collections/collectionsData';

import { hydrateQueryClient } from './offlineCache';
import {
  downloadId,
  downloadStateOf,
  isWaitingForNetwork,
  needsRefresh,
  OFFLINE_CACHE_VERSION,
  parseManifest,
  removeEntry,
  upsertEntry,
  utf8ByteLength,
  type OfflineManifestEntry,
} from './offlineManifest';
import { queryKeysForDownload } from './offlineQueries';
import { useOfflineStore } from './useOfflineStore';
import { queryClient } from '@/services/queryClient';

jest.mock('@/services/supabase/client', () => ({ supabase: { from: jest.fn(), rpc: jest.fn() } }));

const REGIONS = [{ id: 'son-kol', kind: 'nature', name_kg: 'Сон-Көл' }];
jest.mock('./offlineQueries', () => {
  const actual = jest.requireActual('./offlineQueries');
  return {
    ...actual,
    fetcherFor: (key: [string, string?]) => {
      if (key[0] === 'explore_regions') return async () => [{ id: 'son-kol', kind: 'nature', name_kg: 'Сон-Көл' }];
      if (key[0] === 'discoveries') return async () => [];
      if (key[0] === 'quests') return async () => null;
      if (key[0] === 'culture_items') return async () => [{ id: 'horse-eer', image_url: 'https://cdn.example/horse.jpg' }];
      if (key[0] === 'culture_materials') return async () => [];
      if (key[0] === 'culture_item') return async () => ({ id: key[1], title: 'x', image_url: null });
      return null;
    },
  };
});
jest.mock('expo-image', () => ({ Image: { prefetch: jest.fn(async () => true) } }));

function entry(id: string, hashes: string[], version = OFFLINE_CACHE_VERSION): OfflineManifestEntry {
  const [kind, contentId] = id.split(':') as [OfflineManifestEntry['kind'], string];
  return { id: id as OfflineManifestEntry['id'], kind, contentId, queryHashes: hashes, remoteImageUrls: [], downloadedAt: '2026-09-22T00:00:00Z', version };
}

describe('offline manifest', () => {
  it('builds stable ids and the exact queries each existing screen reads', () => {
    expect(downloadId('nature', 'son-kol')).toBe('nature:son-kol');
    expect(queryKeysForDownload('nature', 'son-kol', { questId: 'lost-shyrdak' })).toEqual([
      ['explore_regions'],
      ['discoveries'],
      ['quests', 'current'],
      ['quest_steps', 'lost-shyrdak'],
      // RU/EN translations travel with every download (read offline too).
      ['content_translations'],
    ]);
    expect(queryKeysForDownload('culture_item', 'boz-uy-tunduk', {})).toEqual([['culture_item', 'boz-uy-tunduk'], ['content_translations']]);
    const keys = queryKeysForDownload('collection', 'horse-culture', { collection: getCollection('horse-culture') });
    expect(keys.slice(0, 2)).toEqual([['culture_items', 'all'], ['culture_materials']]);
    expect(keys).toContainEqual(['culture_item', 'horse-kok-boru']);
    expect(keys).not.toContainEqual(['game', 'kok-boru']);
  });

  it('deleting one download keeps data other downloads still share', () => {
    let manifest = upsertEntry({ entries: {} }, entry('nature:son-kol', ['regions', 'discoveries']));
    manifest = upsertEntry(manifest, entry('nature:alay', ['regions', 'discoveries']));
    const first = removeEntry(manifest, 'nature:son-kol');
    expect(first.orphanHashes).toEqual([]);
    const second = removeEntry(first.manifest, 'nature:alay');
    expect(second.orphanHashes).toEqual(['regions', 'discoveries']);
    expect(second.manifest.entries).toEqual({});
  });

  it('keeps entries from an older cache version and marks them for refresh', () => {
    const parsed = parseManifest({ entries: { 'nature:son-kol': { ...entry('nature:son-kol', ['r'], 0) } } });
    expect(parsed.entries['nature:son-kol']).toBeDefined();
    expect(needsRefresh(parsed.entries['nature:son-kol'])).toBe(true);
    expect(parseManifest('garbage')).toEqual({ entries: {} });
  });

  it('reports the four download states', () => {
    const manifest = upsertEntry({ entries: {} }, entry('nature:son-kol', []));
    expect(downloadStateOf(manifest, [], [], 'nature:son-kol')).toBe('downloaded');
    expect(downloadStateOf(manifest, ['nature:alay'], [], 'nature:alay')).toBe('downloading');
    expect(downloadStateOf(manifest, [], ['nature:alay'], 'nature:alay')).toBe('error');
    expect(downloadStateOf(manifest, [], [], 'collection:horse-culture')).toBe('not_downloaded');
  });

  it('detects uncached content waiting for a network that is not there', () => {
    expect(isWaitingForNetwork({ data: undefined, fetchStatus: 'paused' })).toBe(true);
    expect(isWaitingForNetwork({ data: [], fetchStatus: 'paused' })).toBe(false);
    expect(isWaitingForNetwork({ data: undefined, fetchStatus: 'fetching' })).toBe(false);
  });

  it('measures real UTF-8 bytes', () => {
    expect(utf8ByteLength('abc')).toBe(3);
    expect(utf8ByteLength('Көл')).toBe(6); // 3 Cyrillic letters x 2 bytes
  });
});

describe('useOfflineStore', () => {
  // fetchQuery leaves react-query's garbage-collection timers on the shared
  // client; clear them so Jest can exit.
  afterAll(() => queryClient.clear());

  beforeEach(async () => {
    await AsyncStorage.clear();
    onlineManager.setOnline(true);
    useOfflineStore.setState({ manifest: { entries: {} }, inFlight: [], failed: [] });
  });

  it('downloads, persists across a reload, and hydrates the query cache', async () => {
    expect(await useOfflineStore.getState().download('nature', 'son-kol')).toBe(true);
    expect(useOfflineStore.getState().manifest.entries['nature:son-kol']).toMatchObject({ kind: 'nature', version: OFFLINE_CACHE_VERSION });

    // Fresh app start: read back from storage into an empty query cache.
    const stored = JSON.parse((await AsyncStorage.getItem('oyno.offline.manifest'))!);
    const fresh = new QueryClient();
    await hydrateQueryClient(fresh, parseManifest(stored));
    expect(fresh.getQueryData(['explore_regions'])).toEqual(REGIONS);
    fresh.clear();
  });

  it('prefetches only remote images', async () => {
    await useOfflineStore.getState().download('collection', 'horse-culture');
    expect(useOfflineStore.getState().manifest.entries['collection:horse-culture'].remoteImageUrls).toEqual(['https://cdn.example/horse.jpg']);
  });

  it('fails honestly when offline instead of pretending to download', async () => {
    onlineManager.setOnline(false);
    expect(await useOfflineStore.getState().download('nature', 'alay')).toBe(false);
    expect(useOfflineStore.getState().failed).toContain('nature:alay');
    expect(useOfflineStore.getState().manifest.entries['nature:alay']).toBeUndefined();
  });

  it('removing downloads never touches progress, favorites or other app data', async () => {
    const other = {
      'oyno.progress.cache': '{"xp":120,"visitedRegionIds":["son-kol"]}',
      'oyno.favorites.cache': '{"favoriteIds":["nature:son-kol"]}',
      'oyno.daily.completions': '{"2026-09-22":"horse-eer"}',
      'oyno.passport.seenStamps': '["son-kol"]',
    };
    await AsyncStorage.multiSet(Object.entries(other));
    await useOfflineStore.getState().download('nature', 'son-kol');
    await useOfflineStore.getState().download('collection', 'horse-culture');
    await useOfflineStore.getState().removeAll();

    for (const [key, value] of Object.entries(other)) expect(await AsyncStorage.getItem(key)).toBe(value);
    const leftover = (await AsyncStorage.getAllKeys()).filter((key) => key.startsWith('oyno.offline.query:'));
    expect(leftover).toEqual([]);
  });
});
