import type { SearchResultGroup } from './globalSearch';

/**
 * What Search can honestly say about its answer while the remote
 * catalogues (places, culture categories / items / materials) are loading,
 * failing or unreachable offline. Local catalogues (collections, trails,
 * games, interactive experiences) are always complete.
 *
 * Rules:
 *  - a source with data is usable - even if a background refresh failed;
 *  - "No results" is final only when every RELEVANT source answered;
 *  - one failed source never hides the results of the others.
 */
export type SearchSourceId = 'places' | 'cultureCategories' | 'cultureItems' | 'cultureMaterials';

export const SEARCH_SOURCES: SearchSourceId[] = ['places', 'cultureCategories', 'cultureItems', 'cultureMaterials'];

/** The result group each remote source feeds. */
export const SOURCE_GROUP: Record<SearchSourceId, SearchResultGroup> = {
  places: 'places',
  cultureCategories: 'culture',
  cultureItems: 'culture',
  cultureMaterials: 'culture',
};

/** loading = first fetch running; offline = waiting for a connection (react-query paused). */
export type SourceState = 'loading' | 'ready' | 'failed' | 'offline';

/** The parts of a react-query result this needs. */
export type SourceQuery = { status: 'pending' | 'error' | 'success'; fetchStatus: 'fetching' | 'paused' | 'idle'; data: unknown };

export function sourceState(query: SourceQuery): SourceState {
  if (query.data !== undefined) return 'ready';
  if (query.status === 'error') return 'failed';
  if (query.fetchStatus === 'paused') return 'offline';
  return 'loading';
}

/** Sources that can contribute to the current group filter ('all' = every one). */
export function relevantSources(group: 'all' | SearchResultGroup): SearchSourceId[] {
  return group === 'all' ? SEARCH_SOURCES : SEARCH_SOURCES.filter((id) => SOURCE_GROUP[id] === group);
}

export type SearchStatus =
  /** Nothing typed. */
  | { kind: 'idle' }
  /** Typed, nothing to show yet, and a relevant source is still loading. */
  | { kind: 'loading'; pending: SearchSourceId[] }
  /** Some results. `pending` / `failed` / `offline`: relevant sources not (yet) in them. */
  | { kind: 'results'; pending: SearchSourceId[]; failed: SearchSourceId[]; offline: SearchSourceId[] }
  /** No results, and every relevant source answered: a final "No results". */
  | { kind: 'empty' }
  /** No results among the sources that answered; others failed / are offline - not final. */
  | { kind: 'emptyIncomplete'; failed: SearchSourceId[]; offline: SearchSourceId[] };

export function searchStatus(input: { query: string; resultCount: number; sources: Record<SearchSourceId, SourceState>; group: 'all' | SearchResultGroup }): SearchStatus {
  if (!input.query.trim()) return { kind: 'idle' };
  const relevant = relevantSources(input.group);
  const pick = (state: SourceState) => relevant.filter((id) => input.sources[id] === state);
  const pending = pick('loading');
  const failed = pick('failed');
  const offline = pick('offline');
  if (input.resultCount > 0) return { kind: 'results', pending, failed, offline };
  if (pending.length > 0) return { kind: 'loading', pending };
  if (failed.length > 0 || offline.length > 0) return { kind: 'emptyIncomplete', failed, offline };
  return { kind: 'empty' };
}

/** Distinct result groups behind some sources ("Places", "Culture") - for one readable label. */
export function sourceGroups(ids: SearchSourceId[]): SearchResultGroup[] {
  return Array.from(new Set(ids.map((id) => SOURCE_GROUP[id])));
}

/**
 * The one short sentence a screen reader hears once results SETTLE - not
 * per keystroke. null while nothing should be announced (idle / still
 * loading with nothing to show).
 */
export function announcementKey(status: SearchStatus): { key: string; count?: number } | null {
  switch (status.kind) {
    case 'idle':
    case 'loading':
      return null;
    case 'empty':
      return { key: 'search.status.announceNone' };
    case 'emptyIncomplete':
      return { key: 'search.status.announceNoneIncomplete' };
    case 'results':
      return status.failed.length > 0 || status.offline.length > 0 ? { key: 'search.status.announcePartial' } : { key: 'search.status.announceResults' };
  }
}
