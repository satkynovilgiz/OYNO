import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

import { registerAccountBoundKeys } from '@/services/sync/accountScope';
import { safeJsonParse } from '@/services/storage/safeJson';

const READ_IDS_KEY = 'oyno.notifications.readIds';
/** Read ids are only kept for this many items - live ids are date-scoped
 * and events are capped, so older ids can't matter any more. */
const MAX_READ_IDS = 200;

registerAccountBoundKeys([READ_IDS_KEY]);

/**
 * Read state for the Notifications inbox. What the inbox CONTAINS comes
 * from real state and the activity log (features/notifications/useInbox);
 * this only remembers which of those items the user has opened. The Home
 * bell and the screen both read unread counts through useInbox, so there
 * is exactly one source of truth.
 */
type NotificationsState = {
  readIds: string[];
  isLoaded: boolean;
  load: () => Promise<void>;
  markAsRead: (id: string) => void;
  markAllAsRead: (ids: string[]) => void;
  reset: () => void;
};

async function persist(readIds: string[]) {
  await AsyncStorage.setItem(READ_IDS_KEY, JSON.stringify(readIds)).catch(() => {});
}

export const useNotificationsStore = create<NotificationsState>((set, get) => ({
  readIds: [],
  isLoaded: false,

  load: async () => {
    const raw = await AsyncStorage.getItem(READ_IDS_KEY).catch(() => null);
    const parsed = safeJsonParse<unknown>(raw, []);
    set({ readIds: Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [], isLoaded: true });
  },

  markAsRead: (id) => {
    if (get().readIds.includes(id)) return;
    const readIds = [...get().readIds, id].slice(-MAX_READ_IDS);
    set({ readIds });
    void persist(readIds);
  },

  markAllAsRead: (ids) => {
    const readIds = Array.from(new Set([...get().readIds, ...ids])).slice(-MAX_READ_IDS);
    set({ readIds });
    void persist(readIds);
  },

  reset: () => set({ readIds: [], isLoaded: true }),
}));
