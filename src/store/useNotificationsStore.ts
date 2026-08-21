import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

import { mockNotifications } from '@/features/notifications/data';
import { safeJsonParse } from '@/services/storage/safeJson';

const READ_IDS_KEY = 'oyno.notifications.readIds';

type NotificationsState = {
  readIds: string[];
  isLoaded: boolean;
  load: () => Promise<void>;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  hasUnread: () => boolean;
};

async function persist(readIds: string[]) {
  await AsyncStorage.setItem(READ_IDS_KEY, JSON.stringify(readIds)).catch(() => {});
}

export const useNotificationsStore = create<NotificationsState>((set, get) => ({
  readIds: [],
  isLoaded: false,

  load: async () => {
    const raw = await AsyncStorage.getItem(READ_IDS_KEY).catch(() => null);
    set({ readIds: safeJsonParse<string[]>(raw, []), isLoaded: true });
  },

  markAsRead: (id) => {
    if (get().readIds.includes(id)) return;
    const readIds = [...get().readIds, id];
    set({ readIds });
    void persist(readIds);
  },

  markAllAsRead: () => {
    const readIds = mockNotifications.map((notification) => notification.id);
    set({ readIds });
    void persist(readIds);
  },

  hasUnread: () => mockNotifications.some((notification) => !get().readIds.includes(notification.id)),
}));
