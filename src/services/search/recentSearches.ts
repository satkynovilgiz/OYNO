import AsyncStorage from '@react-native-async-storage/async-storage';

import { safeJsonParse } from '@/services/storage/safeJson';
import { registerAccountBoundKeys } from '@/services/sync/accountScope';

export const RECENT_SEARCHES_KEY = 'oyno.search.recent';
const STORAGE_KEY = RECENT_SEARCHES_KEY;
export const MAX_RECENT = 8;
const MAX_QUERY_LENGTH = 60;

// Device-local only (never synced), but personal: cleared with the rest of
// an account's local state on sign-out / account switch, so the next
// person on this phone never sees them.
registerAccountBoundKeys([RECENT_SEARCHES_KEY]);

/** Queries never kept in history: anything that looks like an email
 * address (people sometimes paste one into the wrong field) or a long
 * pasted passage. Search only ever sees public catalog text, never private notes. */
export function isStorableQuery(query: string): boolean {
  const trimmed = query.trim();
  return trimmed.length > 0 && trimmed.length <= MAX_QUERY_LENGTH && !trimmed.includes('@');
}

/** Most-recent-first, de-duplicated (a re-searched term jumps back to the
 * top instead of appearing twice), capped so the list stays a quick
 * glance rather than a growing log. Pure so it's trivially testable
 * without touching AsyncStorage. */
export function addRecentSearch(recent: string[], query: string): string[] {
  const trimmed = query.trim().replace(/\s+/g, ' ');
  if (!isStorableQuery(trimmed)) return recent;
  const deduped = recent.filter((entry) => entry.toLowerCase() !== trimmed.toLowerCase());
  return [trimmed, ...deduped].slice(0, MAX_RECENT);
}

export async function getRecentSearches(): Promise<string[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY).catch(() => null);
  return safeJsonParse<string[]>(raw, []);
}

export async function saveRecentSearches(recent: string[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(recent)).catch(() => {});
}

export async function clearRecentSearches(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
}
