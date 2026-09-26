import AsyncStorage from '@react-native-async-storage/async-storage';

import { pruneOrphanQueries, writeManifest, writeQuery } from './offlineCache';
import { EMPTY_MANIFEST, hashQueryKey, removeEntry, upsertEntry, type OfflineManifest, type OfflineManifestEntry } from './offlineManifest';
import { buildOfflineView, formatBytes, isAvailableOffline, offlineRoute } from './offlineModel';

function entry(id: `${'nature' | 'collection' | 'culture_item'}:${string}`, downloadedAt: string, hashes: string[] = []): OfflineManifestEntry {
  const [kind, contentId] = id.split(':') as [OfflineManifestEntry['kind'], string];
  return { id, kind, contentId, queryHashes: hashes, remoteImageUrls: [], downloadedAt, version: 1 };
}

const manifest: OfflineManifest = [
  entry('nature:son-kol', '2026-09-20T10:00:00Z'),
  entry('nature:alay', '2026-09-24T10:00:00Z'),
  entry('collection:boz-uy-world', '2026-09-22T10:00:00Z'),
].reduce(upsertEntry, EMPTY_MANIFEST);

describe('offline view model', () => {
  it('groups complete downloads by type, newest first', () => {
    const view = buildOfflineView(manifest, [], []);
    expect(view.groups.map((g) => g.id)).toEqual(['places', 'collections']);
    expect(view.groups[0].rows.map((r) => r.contentId)).toEqual(['alay', 'son-kol']);
    expect(view.availableCount).toBe(3);
  });

  it('never shows a running or failed download as available', () => {
    const view = buildOfflineView(manifest, ['culture_item:boz-uy-tunduk'], ['nature:arslanbob']);
    expect(view.downloading.map((r) => r.state)).toEqual(['downloading']);
    expect(view.needsAttention.map((r) => [r.contentId, r.state])).toEqual([['arslanbob', 'failed']]);
    expect(isAvailableOffline(manifest, 'culture_item', 'boz-uy-tunduk')).toBe(false);
    expect(view.availableCount).toBe(3);
  });

  it('keeps a refreshing or refresh-failed download available (its copy still works)', () => {
    const view = buildOfflineView(manifest, ['nature:alay'], ['nature:son-kol']);
    expect(view.downloading).toEqual([]);
    expect(view.needsAttention).toEqual([]);
    expect(view.groups[0].rows.every((r) => r.state === 'available')).toBe(true);
  });

  it('marks items being removed and stops counting them', () => {
    const view = buildOfflineView(manifest, [], [], ['nature:alay']);
    expect(view.groups[0].rows.find((r) => r.contentId === 'alay')?.state).toBe('removing');
    expect(view.availableCount).toBe(2);
  });

  it('ignores malformed ids instead of crashing', () => {
    expect(buildOfflineView(EMPTY_MANIFEST, ['garbage', 'unknown:x'], ['::']).downloading).toEqual([]);
  });

  it('maps every kind to its real detail screen', () => {
    expect(offlineRoute('nature', 'son-kol')).toBe('/explore/son-kol');
    expect(offlineRoute('collection', 'horse-culture')).toBe('/collections/horse-culture');
    expect(offlineRoute('culture_item', 'boz-uy-tunduk')).toBe('/culture/item/boz-uy-tunduk');
  });

  it('formats only measured sizes and never invents one', () => {
    expect(formatBytes(null)).toBeNull();
    expect(formatBytes(2048)).toBe('2 KB');
    expect(formatBytes(3 * 1024 * 1024)).toBe('3.0 MB');
  });
});

describe('remove + interrupted downloads', () => {
  beforeEach(() => AsyncStorage.clear());

  it('removing one download keeps data another download still needs', () => {
    const shared = hashQueryKey(['explore_regions']);
    const m = [entry('nature:a', '2026-09-01T00:00:00Z', [shared, 'x']), entry('nature:b', '2026-09-02T00:00:00Z', [shared])].reduce(upsertEntry, EMPTY_MANIFEST);
    const { manifest: next, orphanHashes } = removeEntry(m, 'nature:a');
    expect(orphanHashes).toEqual(['x']);
    expect(Object.keys(next.entries)).toEqual(['nature:b']);
  });

  it('cleans up leftovers of an interrupted download but never a complete one', async () => {
    await writeQuery(['kept'], { ok: true });
    await writeQuery(['leftover'], { partial: true });
    await AsyncStorage.setItem('oyno.progress', 'untouched');
    const m = upsertEntry(EMPTY_MANIFEST, entry('nature:son-kol', '2026-09-20T00:00:00Z', [hashQueryKey(['kept'])]));
    await writeManifest(m);
    expect(await pruneOrphanQueries(m)).toBe(1);
    const keys = await AsyncStorage.getAllKeys();
    expect(keys.some((k) => k.endsWith(hashQueryKey(['kept'])))).toBe(true);
    expect(keys.some((k) => k.endsWith(hashQueryKey(['leftover'])))).toBe(false);
    expect(await AsyncStorage.getItem('oyno.progress')).toBe('untouched');
  });
});
