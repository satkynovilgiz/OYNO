import * as fs from 'fs';
import * as path from 'path';

import en from '@/i18n/locales/en.json';
import kg from '@/i18n/locales/kg.json';
import ru from '@/i18n/locales/ru.json';

import { downloadId, EMPTY_MANIFEST, requestersOf, upsertEntry, type OfflineKind, type OfflineManifest } from './offlineManifest';
import { keptAfterRemoval, needsAttention, staleOwners, storageInventory, unusedEntries } from './storageModel';

jest.mock('@/services/supabase/client', () => ({ supabase: {} }));

const entry = (kind: OfflineKind, contentId: string, requestedBy: string[]) => ({ id: downloadId(kind, contentId), kind, contentId, queryHashes: [downloadId(kind, contentId)], remoteImageUrls: [], downloadedAt: '2026-10-03T10:00:00Z', version: 1, requestedBy });
const manifestOf = (...entries: ReturnType<typeof entry>[]): OfflineManifest => entries.reduce((m, e) => upsertEntry(m, e), EMPTY_MANIFEST);
const KNOWN = { regionIds: ['son-kol'], pathIds: ['boz-uy', 'felt-oymo'] };

/** The real release() semantics (useOfflineStore): drop one owner; remove the entry with its last owner. */
function release(manifest: OfflineManifest, id: string, owner: string): OfflineManifest {
  const current = manifest.entries[id];
  if (!current) return manifest;
  const remaining = requestersOf(current).filter((value) => value !== owner);
  if (remaining.length > 0) return upsertEntry(manifest, { ...current, requestedBy: remaining });
  const entries = { ...manifest.entries };
  delete entries[id];
  return { entries };
}

describe('Smart Storage Manager', () => {
  it('inventory counts real items once each; support data is not an item', () => {
    const manifest = manifestOf(entry('culture_item', 'boz-uy-overview', ['user', 'path:boz-uy']), entry('nature', 'son-kol', ['region:son-kol']), entry('culture_index', 'all', ['path:boz-uy']));
    const inventory = storageInventory(manifest, ['culture_item:new-one']);
    expect(inventory.itemCount).toBe(2);
    expect(inventory.byCategory).toEqual({ articles: 1, places: 1, collections: 0, support: 1 });
    expect(inventory.items.filter((item) => item.id === 'culture_item:boz-uy-overview')).toHaveLength(1);
    expect(inventory.sharedCount).toBe(1);
    expect(inventory.downloading).toBe(1);
  });

  it('removing one owner keeps a shared item; the last owner removes it', () => {
    let manifest = manifestOf(entry('culture_item', 'boz-uy-overview', ['user', 'path:boz-uy']));
    manifest = release(manifest, 'culture_item:boz-uy-overview', 'path:boz-uy');
    expect(manifest.entries['culture_item:boz-uy-overview']).toBeTruthy();
    expect(keptAfterRemoval(manifest, ['culture_item:boz-uy-overview'])).toBe(1);
    manifest = release(manifest, 'culture_item:boz-uy-overview', 'user');
    expect(manifest.entries['culture_item:boz-uy-overview']).toBeUndefined();
    expect(keptAfterRemoval(manifest, ['culture_item:boz-uy-overview'])).toBe(0);
  });

  it('failed downloads with no copy need attention; a failed refresh of an existing copy does not', () => {
    const manifest = manifestOf(entry('culture_item', 'a', ['user']));
    expect(needsAttention(manifest, [], ['culture_item:a', 'culture_item:b', 'garbage'])).toEqual([{ id: 'culture_item:b', kind: 'culture_item', contentId: 'b' }]);
    expect(needsAttention(manifest, ['culture_item:b'], ['culture_item:b'])).toEqual([]);
  });

  it('cleanup finds only genuinely orphaned entries (removed path/region, unknown owner)', () => {
    const manifest = manifestOf(
      entry('culture_item', 'old', ['path:removed-path']),
      entry('culture_item', 'mine', ['user']),
      entry('culture_item', 'shared', ['path:removed-path', 'path:boz-uy']),
      entry('nature', 'gone', ['region:gone-region']),
      entry('culture_index', 'all', ['weird-owner']),
    );
    expect(unusedEntries(manifest, KNOWN)).toEqual(['culture_index:all', 'culture_item:old', 'nature:gone']);
    expect(staleOwners(manifest.entries['culture_item:shared'], KNOWN)).toEqual(['path:removed-path']);
  });

  it('cleanup never touches a valid user download or a live pack', () => {
    const manifest = manifestOf(entry('culture_item', 'mine', ['user']), entry('culture_item', 'path', ['path:boz-uy']), entry('nature', 'son-kol', ['region:son-kol']));
    expect(unusedEntries(manifest, KNOWN)).toEqual([]);
    // Regions not known (list unavailable) are never judged.
    expect(unusedEntries(manifestOf(entry('nature', 'x', ['region:x'])), { ...KNOWN, regionIds: null })).toEqual([]);
  });

  it('partial pack + retry and remove reuse the existing pack APIs', () => {
    const screen = fs.readFileSync(path.join(__dirname, '../../features/settings/StorageScreen.tsx'), 'utf8');
    expect(screen).toMatch(/downloadPathPack\(pack, store\)/);
    expect(screen).toMatch(/removeRegionPack\(regionId, pack, store\)/);
    expect(screen).toMatch(/useOfflineStore\.getState\(\)\.download\(item\.kind, item\.contentId\)/);
    expect(screen).toMatch(/disabled=\{isOffline\}/);
  });

  it('clear all is offline copies only (same removeAll), behind a confirmation', () => {
    const screen = fs.readFileSync(path.join(__dirname, '../../features/settings/StorageScreen.tsx'), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '');
    expect(screen).toMatch(/setConfirm\(\{ kind: 'clearAll' \}\)/);
    expect(screen).toMatch(/\} else \{\s*await useOfflineStore\.getState\(\)\.removeAll\(\);\s*showToast\(t\('storage\.clearedAll'\)\)/);
    expect(screen).not.toMatch(/Journal|journalPhotos|useJournalStore|Directory|deleteAsync|Paths\./);
  });

  it('works from the local manifest (no network needed to show) and never shows a fake size', () => {
    const screen = fs.readFileSync(path.join(__dirname, '../../features/settings/StorageScreen.tsx'), 'utf8');
    expect(screen).toMatch(/measureBytes\(\)/);
    expect(screen).not.toMatch(/MB['"]|\* 1024|estimate/i);
    const model = fs.readFileSync(path.join(__dirname, 'storageModel.ts'), 'utf8');
    expect(model).not.toMatch(/fetch|supabase|FileSystem/);
  });

  it('KG / RU / EN', () => {
    for (const dict of [en, ru, kg]) {
      const block = (dict as unknown as { storage: Record<string, string> }).storage;
      for (const key of ['title', 'downloadedContent', 'available', 'partial', 'needsAttention', 'retry', 'removeDownload', 'cleanUp', 'clearAll', 'nothingToClean', 'offlineOnly', 'items_other', 'sharedItems_other']) expect(block[key]).toBeTruthy();
    }
  });
});
