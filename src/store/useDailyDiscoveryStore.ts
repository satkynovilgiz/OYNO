import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

import { safeJsonParse } from '@/services/storage/safeJson';
import { requestAccountSync } from '@/services/sync/syncTrigger';

const STORAGE_KEY = 'oyno.daily.completions';
/** Enough history for Journey to list recent daily discoveries without the
 * record growing forever. */
const MAX_ENTRIES = 120;

/** local YYYY-MM-DD -> culture item id completed that day. */
export type DailyCompletions = Record<string, string>;

/** Pure: records one completion, keeping only the newest `MAX_ENTRIES`
 * dates. Re-completing the same date keeps the first item recorded. */
export function addDailyCompletion(completions: DailyCompletions, dateKey: string, itemId: string): DailyCompletions {
  if (completions[dateKey]) return completions;
  const next = { ...completions, [dateKey]: itemId };
  const keys = Object.keys(next).sort();
  if (keys.length <= MAX_ENTRIES) return next;
  return Object.fromEntries(keys.slice(keys.length - MAX_ENTRIES).map((key) => [key, next[key]]));
}

type DailyDiscoveryState = {
  isLoaded: boolean;
  completions: DailyCompletions;
  load: () => Promise<void>;
  complete: (dateKey: string, itemId: string) => Promise<void>;
  /** Sync layer only: replace with an already-merged record. */
  replaceAll: (completions: DailyCompletions) => Promise<void>;
  /** Sign-out: forget this account's completions (server keeps them). */
  reset: () => void;
};

/**
 * Record of which days' discoveries were completed
 * (spec "Persist completion by local calendar date"). Deliberately NOT a
 * streak - OYNO already has one server-side (`user_progress.streak_days`),
 * and completing a discovery feeds it through the existing
 * `discoverCulture()` action instead of starting a second counter (spec
 * "If a streak already exists in the project, integrate carefully rather
 * than creating another one"). Works the same for guests; for a signed-in
 * user the sync layer (services/sync) merges it with the account.
 */
export const useDailyDiscoveryStore = create<DailyDiscoveryState>((set, get) => ({
  isLoaded: false,
  completions: {},

  load: async () => {
    const raw = await AsyncStorage.getItem(STORAGE_KEY).catch(() => null);
    const parsed = safeJsonParse<unknown>(raw, {});
    const completions = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as DailyCompletions) : {};
    set({ completions, isLoaded: true });
  },

  complete: async (dateKey, itemId) => {
    const completions = addDailyCompletion(get().completions, dateKey, itemId);
    if (completions === get().completions) return;
    set({ completions });
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(completions)).catch(() => {});
    requestAccountSync('local_change');
  },

  replaceAll: async (completions) => {
    set({ completions });
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(completions)).catch(() => {});
  },

  reset: () => set({ completions: {}, isLoaded: true }),
}));
