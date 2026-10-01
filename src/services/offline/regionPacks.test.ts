import * as fs from 'fs';
import * as path from 'path';

import AsyncStorage from '@react-native-async-storage/async-storage';

import { getRegionExperience, listRegionExperiences } from '@/features/explore/regions/regionExperiences';
import { useChallengeStore } from '@/store/useChallengeStore';

import { downloadId, EMPTY_MANIFEST, parseManifest, requestersOf, type OfflineKind, type OfflineManifest } from './offlineManifest';
import { buildRegionOfflineManifest, downloadRegionPack, regionPackState, regionRequester, removeRegionPack, requestedRegionIds } from './regionPacks';

jest.mock('@/services/supabase/client', () => ({ supabase: {} }));

/** In-memory stand-in for useOfflineStore's download/claim/release. */
function fakeStore(initial: OfflineManifest, failIds: string[] = []) {
  let manifest = initial;
  const downloaded: string[] = [];
  const entry = (kind: OfflineKind, contentId: string, requestedBy: string[]) => ({ id: downloadId(kind, contentId), kind, contentId, queryHashes: [], remoteImageUrls: [], downloadedAt: '2026-09-30T00:00:00Z', version: 1, requestedBy });
  const store = {
    get manifest() {
      return manifest;
    },
    download: async (kind: OfflineKind, contentId: string, requester = 'user') => {
      const id = downloadId(kind, contentId);
      if (failIds.includes(id)) return false;
      downloaded.push(id);
      manifest = { entries: { ...manifest.entries, [id]: entry(kind, contentId, Array.from(new Set([...requestersOf(manifest.entries[id]), requester]))) } };
      return true;
    },
    claim: async (id: string, requester: string) => {
      const current = manifest.entries[id];
      manifest = { entries: { ...manifest.entries, [id]: { ...current, requestedBy: Array.from(new Set([...requestersOf(current), requester])) } } };
    },
    release: async (id: string, requester: string) => {
      const current = manifest.entries[id];
      if (!current) return;
      const remaining = requestersOf(current).filter((value) => value !== requester);
      const { [id]: _removed, ...rest } = manifest.entries;
      manifest = remaining.length > 0 ? { entries: { ...manifest.entries, [id]: { ...current, requestedBy: remaining } } } : { entries: rest };
    },
  };
  return { store, get: () => store, downloaded };
}

describe('Region offline packs', () => {
  const naryn = getRegionExperience('naryn')!;
  const pack = buildRegionOfflineManifest(naryn);

  it('composes a pack from the region’s own links, deterministically and without duplicates', () => {
    expect(pack.items.map((item) => item.id)).toEqual(['nature:naryn', 'nature:son-kol', 'culture_item:shyrdak-at-bashy']);
    for (const config of listRegionExperiences()) {
      const ids = buildRegionOfflineManifest(config).items.map((item) => item.id);
      expect(new Set(ids).size).toBe(ids.length);
      expect(buildRegionOfflineManifest(config)).toEqual(buildRegionOfflineManifest(config));
    }
    expect(buildRegionOfflineManifest(getRegionExperience('ysyk-kol')!).items.map((item) => item.id)).toEqual(['nature:ysyk-kol']);
  });

  it('reuses what is already on the device (Son-Köl saved on its own is tagged, not fetched again)', async () => {
    const son = { id: 'nature:son-kol' as const, kind: 'nature' as const, contentId: 'son-kol', queryHashes: [], remoteImageUrls: [], downloadedAt: 'x', version: 1 };
    const { get, downloaded } = fakeStore({ entries: { 'nature:son-kol': son } });
    expect(await downloadRegionPack('naryn', pack, get)).toBe(3);
    expect(downloaded).toEqual(['nature:naryn', 'culture_item:shyrdak-at-bashy']);
    expect(requestersOf(get().manifest.entries['nature:son-kol'])).toEqual(['user', 'region:naryn']);
  });

  it('partial is never "available"; a failure keeps successes and needs attention', async () => {
    const { get } = fakeStore(EMPTY_MANIFEST, ['culture_item:shyrdak-at-bashy']);
    await downloadRegionPack('naryn', pack, get);
    const state = regionPackState(pack, 'naryn', get().manifest, [], ['culture_item:shyrdak-at-bashy']);
    expect(state).toMatchObject({ status: 'attention', downloaded: 2, total: 3, failedIds: ['culture_item:shyrdak-at-bashy'] });
    expect(regionPackState(pack, 'naryn', get().manifest, [], []).status).toBe('partial');
    expect(regionPackState(pack, 'naryn', get().manifest, ['culture_item:shyrdak-at-bashy'], []).status).toBe('downloading');
  });

  it('retry downloads only the missing item', async () => {
    const first = fakeStore(EMPTY_MANIFEST, ['culture_item:shyrdak-at-bashy']);
    await downloadRegionPack('naryn', pack, first.get);
    const retry = fakeStore(first.get().manifest);
    await downloadRegionPack('naryn', pack, retry.get);
    expect(retry.downloaded).toEqual(['culture_item:shyrdak-at-bashy']);
    expect(regionPackState(pack, 'naryn', retry.get().manifest, [], []).status).toBe('available');
  });

  it('removing the region keeps what the user (or another region) still needs', async () => {
    const son = { id: 'nature:son-kol' as const, kind: 'nature' as const, contentId: 'son-kol', queryHashes: [], remoteImageUrls: [], downloadedAt: 'x', version: 1 };
    const { get } = fakeStore({ entries: { 'nature:son-kol': son } });
    await downloadRegionPack('naryn', pack, get);
    expect(requestedRegionIds(get().manifest)).toEqual(['naryn']);
    await removeRegionPack('naryn', pack, get);
    expect(Object.keys(get().manifest.entries)).toEqual(['nature:son-kol']);
    expect(requestersOf(get().manifest.entries['nature:son-kol'])).toEqual(['user']);
    expect(requestedRegionIds(get().manifest)).toEqual([]);
  });

  it('entries saved before tags existed count as the user’s (never removed by a region)', () => {
    const legacy = parseManifest({ entries: { 'nature:son-kol': { id: 'nature:son-kol', kind: 'nature', contentId: 'son-kol', queryHashes: [] } } });
    expect(requestersOf(legacy.entries['nature:son-kol'])).toEqual(['user']);
    expect(regionRequester('osh')).toBe('region:osh');
  });

  it('the hub opens honestly offline instead of loading forever', () => {
    const hub = fs.readFileSync(path.join(__dirname, '../../features/explore/regions/RegionHubScreen.tsx'), 'utf8');
    expect(hub).toMatch(/if \(isWaitingForNetwork\(regionsQuery\)\) return <OfflineUnavailable/);
  });

  it('a regional challenge result made offline is kept on the device (synced later)', async () => {
    await AsyncStorage.clear();
    const store = useChallengeStore.getState();
    await store.load();
    store.start('region:naryn');
    useChallengeStore.getState().complete('region:naryn', 3, 3);
    const saved = JSON.parse((await AsyncStorage.getItem('oyno.challenges.v1')) ?? '{}');
    expect(saved.results['region:naryn']).toMatchObject({ bestCorrect: 3, lastTotal: 3 });
  });
});
