import { isDownloadUsable } from '@/services/offline/offlineAvailability';
import type { HealthReport } from '@/services/offline/offlineHealth';
import { hashQueryKey, type OfflineManifestEntry } from '@/services/offline/offlineManifest';

import { announcementKey, relevantSources, searchStatus, sourceGroups, sourceState, type SearchSourceId, type SourceState } from './searchStatus';

const all = (state: SourceState): Record<SearchSourceId, SourceState> => ({ places: state, cultureCategories: state, cultureItems: state, cultureMaterials: state });

describe('source state', () => {
  it('data wins: a cached catalogue whose refresh failed is still usable', () => {
    expect(sourceState({ status: 'error', fetchStatus: 'idle', data: [] })).toBe('ready');
    expect(sourceState({ status: 'success', fetchStatus: 'fetching', data: [{}] })).toBe('ready');
  });

  it('separates first load, failure and waiting for a connection', () => {
    expect(sourceState({ status: 'pending', fetchStatus: 'fetching', data: undefined })).toBe('loading');
    expect(sourceState({ status: 'error', fetchStatus: 'idle', data: undefined })).toBe('failed');
    expect(sourceState({ status: 'pending', fetchStatus: 'paused', data: undefined })).toBe('offline');
  });
});

describe('search status', () => {
  const base = { query: 'komuz', group: 'all' as const };

  it('nothing typed is idle, whatever is loading', () => {
    expect(searchStatus({ ...base, query: '   ', resultCount: 0, sources: all('loading') })).toEqual({ kind: 'idle' });
  });

  it('slow loading never looks like an empty catalogue', () => {
    expect(searchStatus({ ...base, resultCount: 0, sources: all('loading') })).toEqual({ kind: 'loading', pending: ['places', 'cultureCategories', 'cultureItems', 'cultureMaterials'] });
    expect(searchStatus({ ...base, resultCount: 0, sources: { ...all('ready'), cultureItems: 'loading' } }).kind).toBe('loading');
  });

  it('"No results" is final only when every relevant source answered', () => {
    expect(searchStatus({ ...base, resultCount: 0, sources: all('ready') })).toEqual({ kind: 'empty' });
    expect(searchStatus({ ...base, resultCount: 0, sources: { ...all('ready'), places: 'failed' } })).toEqual({ kind: 'emptyIncomplete', failed: ['places'], offline: [] });
    expect(searchStatus({ ...base, resultCount: 0, sources: { ...all('ready'), cultureItems: 'offline' } })).toEqual({ kind: 'emptyIncomplete', failed: [], offline: ['cultureItems'] });
  });

  it('a failed source does not hide the results of healthy ones', () => {
    expect(searchStatus({ ...base, resultCount: 3, sources: { ...all('ready'), places: 'failed', cultureMaterials: 'loading' } })).toEqual({ kind: 'results', pending: ['cultureMaterials'], failed: ['places'], offline: [] });
  });

  it('only sources that feed the current group filter matter', () => {
    expect(relevantSources('games')).toEqual([]);
    expect(relevantSources('places')).toEqual(['places']);
    // Games come from local data: a failed culture catalogue is irrelevant there.
    expect(searchStatus({ ...base, group: 'games', resultCount: 0, sources: all('failed') })).toEqual({ kind: 'empty' });
    expect(searchStatus({ ...base, group: 'places', resultCount: 0, sources: { ...all('ready'), cultureItems: 'loading' } })).toEqual({ kind: 'empty' });
  });

  it('labels sources by result group, once each', () => {
    expect(sourceGroups(['cultureItems', 'places', 'cultureMaterials'])).toEqual(['culture', 'places']);
  });

  it('announces settled outcomes only', () => {
    expect(announcementKey({ kind: 'idle' })).toBeNull();
    expect(announcementKey({ kind: 'loading', pending: ['places'] })).toBeNull();
    expect(announcementKey({ kind: 'empty' })?.key).toBe('search.status.announceNone');
    expect(announcementKey({ kind: 'results', pending: [], failed: [], offline: [] })?.key).toBe('search.status.announceResults');
    expect(announcementKey({ kind: 'results', pending: [], failed: ['places'], offline: [] })?.key).toBe('search.status.announcePartial');
  });
});

describe('"Available offline" means usable, not merely listed', () => {
  const key = ['culture_item', 'boz-uy-overview'];
  const entry: OfflineManifestEntry = {
    id: 'culture_item:boz-uy-overview',
    kind: 'culture_item',
    contentId: 'boz-uy-overview',
    queryHashes: [hashQueryKey(key)],
    remoteImageUrls: [],
    downloadedAt: '2026-10-01T00:00:00.000Z',
    version: 1,
  };
  const health = (state: 'ready' | 'incomplete'): HealthReport => ({ checkedAt: '2026-10-01T00:00:00.000Z', items: { [entry.id]: state }, counts: { ready: 0, incomplete: 0, update_available: 0 } });
  const cached = (...hashes: string[]) => (hash: string) => hashes.includes(hash);

  it('a complete download whose data is in the cache is usable', () => {
    expect(isDownloadUsable(entry, null, cached(hashQueryKey(key)))).toBe(true);
    expect(isDownloadUsable(entry, health('ready'), cached(hashQueryKey(key)))).toBe(true);
  });

  it('a manifest entry alone is not enough', () => {
    expect(isDownloadUsable(undefined, null, () => true)).toBe(false);
    expect(isDownloadUsable({ ...entry, queryHashes: [] }, null, () => true)).toBe(false);
    // Listed, but its stored result never made it into the cache (missing / unreadable).
    expect(isDownloadUsable(entry, null, cached())).toBe(false);
    // Found incomplete by the last check.
    expect(isDownloadUsable(entry, health('incomplete'), cached(hashQueryKey(key)))).toBe(false);
    // One of several results missing.
    expect(isDownloadUsable({ ...entry, queryHashes: [hashQueryKey(key), hashQueryKey(['culture_items', 'all'])] }, null, cached(hashQueryKey(key)))).toBe(false);
  });
});
