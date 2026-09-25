import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

import { appendEvent, type ActivityEvent } from '@/features/notifications/inbox';
import { registerAccountBoundKeys } from '@/services/sync/accountScope';
import { safeJsonParse } from '@/services/storage/safeJson';

export const ACTIVITY_STORAGE_KEY = 'oyno.activity.v1';

// Per account: stashed/cleared with the rest of the account's local data,
// so one account's activity never shows up in another's inbox.
registerAccountBoundKeys([ACTIVITY_STORAGE_KEY]);

type ActivityState = {
  events: ActivityEvent[];
  isLoaded: boolean;
  load: () => Promise<void>;
  record: (event: ActivityEvent) => void;
  reset: () => void;
};

async function persist(events: ActivityEvent[]) {
  await AsyncStorage.setItem(ACTIVITY_STORAGE_KEY, JSON.stringify(events)).catch(() => {});
}

function isEvent(value: unknown): value is ActivityEvent {
  const e = value as ActivityEvent;
  return !!e && typeof e.id === 'string' && typeof e.type === 'string' && typeof e.createdAt === 'string' && typeof e.params === 'object' && e.params !== null;
}

/** Local log of real in-app events for the Notifications inbox (see
 * features/notifications/inbox.ts). Device-local; never synced or sent. */
export const useActivityStore = create<ActivityState>((set, get) => ({
  events: [],
  isLoaded: false,

  load: async () => {
    const parsed = safeJsonParse<unknown>(await AsyncStorage.getItem(ACTIVITY_STORAGE_KEY).catch(() => null), []);
    set({ events: Array.isArray(parsed) ? parsed.filter(isEvent) : [], isLoaded: true });
  },

  record: (event) => {
    const events = appendEvent(get().events, event);
    if (events === get().events) return;
    set({ events });
    void persist(events);
  },

  reset: () => set({ events: [], isLoaded: true }),
}));
