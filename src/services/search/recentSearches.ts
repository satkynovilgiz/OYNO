import AsyncStorage from '@react-native-async-storage/async-storage';

import { safeJsonParse } from '@/services/storage/safeJson';

const STORAGE_KEY = 'oyno.search.recent';
const MAX_RECENT = 8;

/** Most-recent-first, de-duplicated (a re-searched term jumps back to the
 * top instead of appearing twice), capped so the list stays a quick
 * glance rather than a growing log. Pure so it's trivially testable
 * without touching AsyncStorage. */
export function addRecentSearch(recent: string[], query: string): string[] {
  const trimmed = query.trim();
  if (!trimmed) return recent;
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
