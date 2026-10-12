/**
 * The in-memory unsaved-edit maps of the editors that keep drafts while
 * you navigate (portfolios, scrapbooks, My Questions, Listening Compare
 * notes). Each editor still owns its map and its key format; this module
 * only makes those SAME maps listable for the Recovery Center - nothing is
 * copied. In memory only: these drafts end when the app is closed.
 *
 * Keys always start with the owner, so listing for one owner never shows
 * another's drafts.
 */
export type DraftSource = 'portfolio' | 'scrapbook' | 'question' | 'compareNote';
const maps = new Map<DraftSource, Map<string, unknown>>();

export function draftMap<T>(source: DraftSource): Map<string, T> {
  let map = maps.get(source);
  if (!map) {
    map = new Map();
    maps.set(source, map);
  }
  return map as Map<string, T>;
}

/** Owner-prefixed key formats used by the editors. */
export const ownerKey = (owner: string, rest: string) => `${owner}\u0000${rest}`;
export function entriesFor<T>(source: DraftSource, owner: string): { key: string; rest: string; value: T }[] {
  const prefix = `${owner}\u0000`;
  return [...draftMap<T>(source).entries()].filter(([key]) => key.startsWith(prefix)).map(([key, value]) => ({ key, rest: key.slice(prefix.length), value }));
}
