import * as fs from 'fs';
import * as path from 'path';

import en from '@/i18n/locales/en.json';
import kg from '@/i18n/locales/kg.json';
import ru from '@/i18n/locales/ru.json';
import { LEARNING_PATHS } from '@/features/learn/learningPaths';

import { isRouteAvailableOffline } from './offlineAvailability';
import { downloadId, EMPTY_MANIFEST, requestersOf, upsertEntry, type OfflineKind, type OfflineManifest } from './offlineManifest';
import { buildOfflineView } from './offlineModel';
import { buildLearningPathOfflineManifest, CULTURE_INDEX_ID, downloadPathPack, learningPathPackState, offlineContinue, removePathPack, requestedPathIds, retryPartialPathPacks } from './pathPacks';
import { buildRegionOfflineManifest, downloadRegionPack } from './regionPacks';

jest.mock('@/services/supabase/client', () => ({ supabase: {} }));

const bozUy = LEARNING_PATHS.find((entry) => entry.id === 'boz-uy')!;
const felt = LEARNING_PATHS.find((entry) => entry.id === 'felt-oymo')!;
const horse = LEARNING_PATHS.find((entry) => entry.id === 'horse-games')!;

/** The real store contract (claim / release / download), in memory. */
function fakeStore(options: { failIds?: string[] } = {}) {
  const state = {
    manifest: EMPTY_MANIFEST as OfflineManifest,
    downloads: [] as string[],
    failed: [] as string[],
  };
  const api = {
    get manifest() {
      return state.manifest;
    },
    download: async (kind: OfflineKind, contentId: string, requester = 'user') => {
      const id = downloadId(kind, contentId);
      state.downloads.push(id);
      if (options.failIds?.includes(id)) {
        state.failed.push(id);
        return false;
      }
      const existing = state.manifest.entries[id];
      state.manifest = upsertEntry(state.manifest, { id, kind, contentId, queryHashes: [id], remoteImageUrls: [], downloadedAt: '2026-10-02T00:00:00Z', version: 1, requestedBy: [...new Set([...(existing ? requestersOf(existing) : []), requester])] });
      return true;
    },
    claim: async (id: string, requester: string) => {
      const entry = state.manifest.entries[id];
      if (entry && !requestersOf(entry).includes(requester)) state.manifest = upsertEntry(state.manifest, { ...entry, requestedBy: [...requestersOf(entry), requester] });
    },
    release: async (id: string, requester: string) => {
      const entry = state.manifest.entries[id];
      if (!entry) return;
      const remaining = requestersOf(entry).filter((value) => value !== requester);
      if (remaining.length > 0) state.manifest = upsertEntry(state.manifest, { ...entry, requestedBy: remaining });
      else {
        const entries = { ...state.manifest.entries };
        delete entries[id];
        state.manifest = { entries };
      }
    },
  };
  return { state, store: () => api };
}

describe('Learning Path offline packs', () => {
  it('builds the manifest from the steps: articles download, glossary reuses its source article, the rest is built in', () => {
    const pack = buildLearningPathOfflineManifest(bozUy);
    expect(pack.steps.map((step) => [step.type, step.mode])).toEqual([
      ['culture_item', 'download'],
      ['culture_item', 'download'],
      ['glossary', 'download'],
      ['interactive_lab', 'built_in'],
      ['challenge', 'built_in'],
    ]);
    expect(pack.steps[2].deps).toEqual(['culture_item:boz-uy-tunduk', CULTURE_INDEX_ID]);
    expect(pack.items.map((item) => item.id)).toEqual([CULTURE_INDEX_ID, 'culture_item:boz-uy-overview', 'culture_item:boz-uy-karkas', 'culture_item:boz-uy-tunduk']);
  });

  it('eliminates duplicate dependencies (each download listed once)', () => {
    for (const entry of LEARNING_PATHS) {
      const ids = buildLearningPathOfflineManifest(entry).items.map((item) => item.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('games and labs are built in - never downloaded; challenges are local', () => {
    const pack = buildLearningPathOfflineManifest(horse);
    expect(pack.steps.filter((step) => step.type === 'game').every((step) => step.mode === 'built_in' && step.deps.length === 0)).toBe(true);
    expect(pack.steps.filter((step) => step.type === 'challenge').every((step) => step.mode === 'built_in')).toBe(true);
    expect(pack.items.every((item) => item.kind === 'culture_item' || item.kind === 'culture_index')).toBe(true);
    expect(learningPathPackState(pack, EMPTY_MANIFEST, [], []).builtIn).toBe(3);
  });

  it('partial honesty: 4 of 5 is never "Available offline"', async () => {
    const { store, state } = fakeStore({ failIds: ['culture_item:boz-uy-karkas'] });
    const pack = buildLearningPathOfflineManifest(bozUy);
    await downloadPathPack(pack, store);
    const result = learningPathPackState(pack, state.manifest, [], state.failed);
    expect(result.offlineCapable).toBe(4);
    expect(result.totalSteps).toBe(5);
    expect(result.status).toBe('attention');
    expect(result.stepStates[1]).toBe('failed');
  });

  it('retry downloads only the missing/failed dependency', async () => {
    const first = fakeStore({ failIds: ['culture_item:boz-uy-karkas'] });
    const pack = buildLearningPathOfflineManifest(bozUy);
    await downloadPathPack(pack, first.store);
    first.state.downloads = [];
    const retry = fakeStore();
    retry.state.manifest = first.state.manifest;
    await retryPartialPathPacks(retry.store);
    expect(retry.state.downloads).toEqual(['culture_item:boz-uy-karkas']);
    expect(learningPathPackState(pack, retry.state.manifest, [], []).status).toBe('available');
  });

  it('shared assets are stored once and kept while another owner needs them', async () => {
    const { store, state } = fakeStore();
    // shyrdak-craft: saved on its own first, then needed by the Felt & Oymo path.
    await store().download('culture_item', 'shyrdak-craft', 'user');
    const feltPack = buildLearningPathOfflineManifest(felt);
    await downloadPathPack(feltPack, store);
    expect(state.downloads.filter((id) => id === 'culture_item:shyrdak-craft')).toHaveLength(1);
    expect(requestersOf(state.manifest.entries['culture_item:shyrdak-craft'])).toEqual(['user', 'path:felt-oymo']);

    // The culture list is shared by two paths.
    await downloadPathPack(buildLearningPathOfflineManifest(bozUy), store);
    expect(state.downloads.filter((id) => id === CULTURE_INDEX_ID)).toHaveLength(1);

    await removePathPack(feltPack, store);
    expect(state.manifest.entries['culture_item:shyrdak-craft']).toBeTruthy();
    expect(requestersOf(state.manifest.entries['culture_item:shyrdak-craft'])).toEqual(['user']);
    expect(state.manifest.entries[CULTURE_INDEX_ID]).toBeTruthy();
    expect(requestedPathIds(state.manifest)).toEqual(['boz-uy']);
  });

  it('removing a path removes only its ownership (a Region pack keeps its copy)', async () => {
    const { store, state } = fakeStore();
    await downloadRegionPack('test-region', { items: [{ kind: 'culture_item', contentId: 'boz-uy-overview', id: 'culture_item:boz-uy-overview' }], notDownloadable: [] }, store);
    const pack = buildLearningPathOfflineManifest(bozUy);
    await downloadPathPack(pack, store);
    await removePathPack(pack, store);
    expect(requestersOf(state.manifest.entries['culture_item:boz-uy-overview'])).toEqual(['region:test-region']);
    expect(state.manifest.entries['culture_item:boz-uy-karkas']).toBeUndefined();
    expect(state.manifest.entries[CULTURE_INDEX_ID]).toBeUndefined();
    expect(typeof buildRegionOfflineManifest).toBe('function');
  });

  it('offline path screen: each step reports Available / Unavailable from the existing offline check', () => {
    const cache = new Map<string, unknown>([[JSON.stringify(['culture_item', 'boz-uy-overview']), {}]]);
    const queryClient = { getQueryData: (key: unknown[]) => cache.get(JSON.stringify(key)) } as never;
    expect(isRouteAvailableOffline('/culture/item/boz-uy-overview', queryClient)).toBe(true);
    expect(isRouteAvailableOffline('/culture/item/boz-uy-karkas', queryClient)).toBe(false);
    expect(isRouteAvailableOffline('/culture/glossary/tunduk', queryClient)).toBe(false);
    cache.set(JSON.stringify(['culture_items', 'all']), []);
    expect(isRouteAvailableOffline('/culture/glossary/tunduk', queryClient)).toBe(true);
    expect(isRouteAvailableOffline('/games/kok-boru', queryClient)).toBe(true);
  });

  it('offline Continue: says when the true next step is unavailable, never skips completion', () => {
    expect(offlineContinue(1, [true, false, false], [true, false, true])).toEqual({ index: 2, trueNextUnavailable: true });
    expect(offlineContinue(1, [true, false, false], [true, true, false])).toEqual({ index: 1, trueNextUnavailable: false });
    expect(offlineContinue(1, [true, false, false], [true, false, false])).toEqual({ index: null, trueNextUnavailable: true });
    expect(offlineContinue(null, [true, true], [true, true])).toEqual({ index: null, trueNextUnavailable: false });
    const screen = fs.readFileSync(path.join(__dirname, '../../features/learn/LearningPathScreen.tsx'), 'utf8');
    expect(screen).not.toMatch(/setManual\([^)]*offline/i);
  });

  it('no fake size: before downloading only an item count is shown', () => {
    const state = learningPathPackState(buildLearningPathOfflineManifest(bozUy), EMPTY_MANIFEST, [], []);
    expect(state.missingItems).toBe(4);
    expect(state.status).toBe('none');
    const row = fs.readFileSync(path.join(__dirname, '../../features/learn/PathOfflineRow.tsx'), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '');
    expect(row).not.toMatch(/formatBytes|MB|bytes/);
    for (const dict of [en, ru, kg]) expect(JSON.stringify((dict as unknown as { pathOffline: unknown }).pathOffline)).not.toMatch(/\bMB\b|МБ/);
  });

  it('the shared culture list is support data, never a row of its own', () => {
    const manifest = upsertEntry(EMPTY_MANIFEST, { id: CULTURE_INDEX_ID, kind: 'culture_index', contentId: 'all', queryHashes: [], remoteImageUrls: [], downloadedAt: '2026-10-02T00:00:00Z', version: 1, requestedBy: ['path:boz-uy'] });
    const view = buildOfflineView(manifest, [CULTURE_INDEX_ID], [CULTURE_INDEX_ID]);
    expect(view.availableCount).toBe(0);
    expect(view.groups).toEqual([]);
    expect(view.downloading).toEqual([]);
    expect(view.needsAttention).toEqual([]);
  });

  it('KG / RU / EN copy', () => {
    for (const dict of [en, ru, kg]) {
      const block = (dict as unknown as { pathOffline: Record<string, string> }).pathOffline;
      for (const key of ['download', 'downloading', 'available', 'partial', 'retry', 'stepAvailable', 'stepUnavailable', 'nextUnavailable']) expect(block[key]).toBeTruthy();
    }
  });
});
