import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

import { DEFAULT_REMINDER_SETTINGS, type ReminderSettings } from '@/services/reminders/reminderPlanner';
import { safeJsonParse } from '@/services/storage/safeJson';

const STORAGE_KEY = 'oyno.reminders.settings';

/** Reminder preferences, on this device only (local notifications are
 * scheduled on this device). All reminders start OFF. */
type ReminderSettingsState = {
  isLoaded: boolean;
  settings: ReminderSettings;
  load: () => Promise<void>;
  update: (patch: Partial<ReminderSettings>) => Promise<void>;
};

export const useReminderSettingsStore = create<ReminderSettingsState>((set, get) => ({
  isLoaded: false,
  settings: DEFAULT_REMINDER_SETTINGS,
  load: async () => {
    const raw = await AsyncStorage.getItem(STORAGE_KEY).catch(() => null);
    const parsed = safeJsonParse<Partial<ReminderSettings> | null>(raw, null);
    const settings: ReminderSettings = {
      ...DEFAULT_REMINDER_SETTINGS,
      ...(parsed && typeof parsed === 'object' ? parsed : {}),
      quietHours: { ...DEFAULT_REMINDER_SETTINGS.quietHours, ...(parsed?.quietHours ?? {}) },
    };
    set({ settings, isLoaded: true });
  },
  update: async (patch) => {
    const settings = { ...get().settings, ...patch };
    set({ settings });
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(settings)).catch(() => {});
  },
}));
