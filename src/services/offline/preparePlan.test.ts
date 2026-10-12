import { LEARNING_PATHS } from '@/features/learn/learningPaths';
import { ACTIVITY_CATALOG } from '@/features/home/chooser/activityChooser';
import type { Queue } from '@/features/nextVisit/nextVisitModel';

import { downloadId, type OfflineManifest, type OfflineManifestEntry } from './offlineManifest';
import { buildLearningPathOfflineManifest, pathRequester } from './pathPacks';
import { isDownloadUsable } from './offlineAvailability';
import { BUNDLED_ACTIVITIES, buildPreparePlan, PLAN_REQUESTER, prepareCancel, prepareDownload, prepareRepair, readiness, resourceState } from './preparePlan';
import type { PackStore } from './regionPacks';

const T = '2026-10-12T00:00:00Z';
const queue: Queue = [
  { kind: 'article', id: 'boz-uy-overview', titleSnapshot: 'Боз үй', addedAt: T, openedAt: null },
  { kind: 'activity', id: 'jaaAtuu', titleSnapshot: '', addedAt: T, openedAt: null },
  { kind: 'activity', id: 'daily', titleSnapshot: '', addedAt: T, openedAt: null },
  { kind: 'article', id: 'removed-article', titleSnapshot: 'Old', addedAt: T, openedAt: null },
  { kind: 'article', id: 'boz-uy-tunduk', titleSnapshot: 'Түндүк', addedAt: T, openedAt: null },
];
const exists = (id: string) => id !== 'removed-article';
const entry = (id: string): OfflineManifestEntry => ({ id: id as OfflineManifestEntry['id'], kind: id.split(':')[0] as OfflineManifestEntry['kind'], contentId: id.split(':')[1], queryHashes: [id], remoteImageUrls: [], downloadedAt: T, version: 1, requestedBy: ['user'] });
const manifestOf = (...ids: string[]): OfflineManifest => ({ entries: Object.fromEntries(ids.map((id) => [id, entry(id)])) });

/** A fake of the existing download store: records what is downloaded, claimed and cancelled. */
function fakeStore(initial: OfflineManifest, fail: string[] = []) {
  const log: string[] = [];
  const state = { manifest: initial };
  const store: PackStore = {
    get manifest() {
      return state.manifest;
    },
    claim: async (id: string, requester: string) => void log.push(`claim ${id} ${requester}`),
    download: async (kind: string, contentId: string, requester: string) => {
      const id = `${kind}:${contentId}`;
      log.push(`download ${id} ${requester}`);
      if (fail.includes(id)) return false;
      state.manifest = { entries: { ...state.manifest.entries, [id]: entry(id) } };
      return true;
    },
    release: async (id: string, requester: string) => void log.push(`release ${id} ${requester}`),
    cancel: async (id: string, requester: string) => void log.push(`cancel ${id} ${requester}`),
  } as unknown as PackStore;
  return { store: () => store, log, state };
}

describe('manifest generation', () => {
  it('a plan: articles need their download + the shared list; bundled activities are built in; Daily and gone items are not promised', () => {
    const plan = buildPreparePlan({ kind: 'plan' }, { queue, articleExists: exists })!;
    expect(plan.requester).toBe(PLAN_REQUESTER);
    expect(plan.resources.map((r) => [r.id, r.mode])).toEqual([['boz-uy-overview', 'download'], ['jaaAtuu', 'built_in'], ['daily', 'unknown'], ['removed-article', 'unavailable'], ['boz-uy-tunduk', 'download']]);
    expect(plan.items.map((i) => i.id)).toEqual([downloadId('culture_item', 'boz-uy-overview'), downloadId('culture_index', 'all'), downloadId('culture_item', 'boz-uy-tunduk')]);
  });
  it('a journey reuses the Learning Path pack (same items, same requester)', () => {
    const path = LEARNING_PATHS[0];
    const plan = buildPreparePlan({ kind: 'path', pathId: path.id }, { queue: [], articleExists: () => true })!;
    expect(plan.items).toEqual(buildLearningPathOfflineManifest(path).items);
    expect(plan.requester).toBe(pathRequester(path.id));
    expect(plan.resources).toHaveLength(path.steps.length);
    expect(buildPreparePlan({ kind: 'path', pathId: 'nope' }, { queue: [], articleExists: () => true })).toBeNull();
  });
  it('only stable ids; bundled activities exist in the registry and exclude Daily', () => {
    for (const id of BUNDLED_ACTIVITIES) expect(ACTIVITY_CATALOG.some((a) => a.id === id)).toBe(true);
    expect(BUNDLED_ACTIVITIES.has('daily')).toBe(false);
    for (const item of buildPreparePlan({ kind: 'plan' }, { queue, articleExists: exists })!.items) expect(item.id).toMatch(/^(culture_item|culture_index):[a-z0-9-]+$/);
  });
});

describe('states and readiness (from the real manifest + queue)', () => {
  const plan = buildPreparePlan({ kind: 'plan' }, { queue, articleExists: exists })!;
  it('downloaded / downloading / failed / missing', () => {
    const m = manifestOf('culture_item:boz-uy-overview', 'culture_index:all');
    expect(resourceState(plan.resources[0], m, [], [])).toBe('downloaded');
    expect(resourceState(plan.resources[4], m, ['culture_item:boz-uy-tunduk'], [])).toBe('downloading');
    expect(resourceState(plan.resources[4], m, [], ['culture_item:boz-uy-tunduk'])).toBe('failed');
    expect(resourceState(plan.resources[4], m, [], [])).toBe('missing');
  });
  it('readiness counts built-in + downloaded only; unknown/unavailable never count as ready', () => {
    const r = readiness(plan, manifestOf('culture_item:boz-uy-overview', 'culture_index:all'), [], []);
    expect([r.ready, r.total]).toEqual([2, 5]);
    expect(r.missingItems.map((i) => i.id)).toEqual(['culture_item:boz-uy-tunduk']);
    expect(r.downloadedEntries.map((e) => e.id)).toEqual(['culture_item:boz-uy-overview', 'culture_index:all']);
  });
});

describe('download, partial failure, retry, cancel', () => {
  const plan = buildPreparePlan({ kind: 'plan' }, { queue, articleExists: exists })!;
  it('partial failure keeps the successful downloads; retry fetches only what is missing', async () => {
    const fake = fakeStore(manifestOf('culture_index:all'), ['culture_item:boz-uy-tunduk']);
    await prepareDownload(plan, fake.store);
    expect(fake.log).toEqual([`claim culture_index:all ${PLAN_REQUESTER}`, `download culture_item:boz-uy-overview ${PLAN_REQUESTER}`, `download culture_item:boz-uy-tunduk ${PLAN_REQUESTER}`]);
    expect(Object.keys(fake.state.manifest.entries).sort()).toEqual(['culture_index:all', 'culture_item:boz-uy-overview']);
    fake.log.length = 0;
    await prepareDownload(plan, fake.store);
    expect(fake.log.filter((line) => line.startsWith('download'))).toEqual([`download culture_item:boz-uy-tunduk ${PLAN_REQUESTER}`]);
  });
  it('cancelling only withdraws this preparation\'s pending requests - nothing is released or deleted', async () => {
    const fake = fakeStore(manifestOf('culture_item:boz-uy-overview'));
    await prepareCancel(plan, fake.store);
    expect(fake.log.every((line) => line.startsWith('cancel'))).toBe(true);
    expect(fake.log.some((line) => line.startsWith('release'))).toBe(false);
    expect(fake.state.manifest.entries['culture_item:boz-uy-overview']).toBeDefined();
  });
  it('an interrupted download (still queued after a restart) shows as downloading, then missing if dropped - never as downloaded', () => {
    const m = manifestOf('culture_index:all');
    expect(resourceState(plan.resources[0], m, ['culture_item:boz-uy-overview'], [])).toBe('downloading');
    expect(resourceState(plan.resources[0], m, [], [])).toBe('missing');
  });
});

describe('REGRESSION: readiness uses actual download usability (health + cached results)', () => {
  const plan = buildPreparePlan({ kind: 'plan' }, { queue, articleExists: exists })!;
  const m = manifestOf('culture_item:boz-uy-overview', 'culture_index:all');
  it('a listed download that failed its health check is incomplete, not ready', () => {
    const health = { checkedAt: T, items: { 'culture_item:boz-uy-overview': 'incomplete' } } as never;
    const usable = (id: string) => isDownloadUsable(m.entries[id], health, () => true);
    expect(resourceState(plan.resources[0], m, [], [], usable)).toBe('incomplete');
    const r = readiness(plan, m, [], [], usable);
    expect(r.ready).toBe(1); // only the built-in activity
    expect(r.incompleteItems.map((i) => i.id)).toEqual(['culture_item:boz-uy-overview']);
  });
  it('a listed download whose results are not in the cache is incomplete', () => {
    const usable = (id: string) => isDownloadUsable(m.entries[id], null, (hash) => hash !== 'culture_index:all');
    expect(resourceState(plan.resources[0], m, [], [], usable)).toBe('incomplete');
  });
  it('healthy and cached -> downloaded', () => {
    const usable = (id: string) => isDownloadUsable(m.entries[id], null, () => true);
    expect(resourceState(plan.resources[0], m, [], [], usable)).toBe('downloaded');
  });
  it('repair re-downloads only the incomplete items', async () => {
    const fake = fakeStore(m);
    await prepareRepair(plan, [{ kind: 'culture_item', contentId: 'boz-uy-overview', id: 'culture_item:boz-uy-overview' }], fake.store);
    expect(fake.log).toEqual([`download culture_item:boz-uy-overview ${PLAN_REQUESTER}`]);
  });
});
