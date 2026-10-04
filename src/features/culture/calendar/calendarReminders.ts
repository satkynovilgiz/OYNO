import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { create } from 'zustand';

import { requestReminderPermission } from '@/services/reminders/reminderScheduler';
import { safeJsonParse } from '@/services/storage/safeJson';

/**
 * "Remind me" for a calendar date - explicit opt-in only, one local
 * notification on the morning of the date (10:00 local), through the same
 * expo-notifications permission flow as Reminders. Tagged `oynoCalendar`
 * (not `oynoReminder`) so the daily reminder planner never removes it.
 * Nothing is sent to a server.
 */
const KEY = 'oyno.calendarReminders.v1';
export const REMIND_HOUR = 10;

export function reminderDate(occurrenceStart: Date): Date {
  return new Date(occurrenceStart.getFullYear(), occurrenceStart.getMonth(), occurrenceStart.getDate(), REMIND_HOUR, 0, 0);
}

type State = { isLoaded: boolean; ids: string[]; load: () => Promise<void>; setIds: (ids: string[]) => void };

export const useCalendarReminders = create<State>((set, get) => ({
  isLoaded: false,
  ids: [],
  load: async () => {
    if (get().isLoaded) return;
    const parsed = safeJsonParse<unknown>(await AsyncStorage.getItem(KEY).catch(() => null), []);
    set({ ids: Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === 'string') : [], isLoaded: true });
  },
  setIds: (ids) => {
    set({ ids });
    void AsyncStorage.setItem(KEY, JSON.stringify(ids)).catch(() => undefined);
  },
}));

export type RemindResult = 'scheduled' | 'denied' | 'unavailable' | 'past';

export async function remindMe(eventId: string, when: Date, content: { title: string; body: string; route: string }): Promise<RemindResult> {
  if (Platform.OS === 'web') return 'unavailable';
  if (when.getTime() <= Date.now()) return 'past';
  if (!(await requestReminderPermission())) return 'denied';
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Notifications = require('expo-notifications') as typeof import('expo-notifications');
    await Notifications.scheduleNotificationAsync({
      identifier: `oyno-calendar-${eventId}`,
      content: { title: content.title, body: content.body, data: { oynoCalendar: true, route: content.route } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: when },
    });
  } catch {
    return 'unavailable';
  }
  const store = useCalendarReminders.getState();
  store.setIds([...new Set([...store.ids, eventId])]);
  return 'scheduled';
}

export async function cancelReminder(eventId: string): Promise<void> {
  try {
    if (Platform.OS !== 'web') {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Notifications = require('expo-notifications') as typeof import('expo-notifications');
      await Notifications.cancelScheduledNotificationAsync(`oyno-calendar-${eventId}`);
    }
  } catch {
    // already gone
  }
  const store = useCalendarReminders.getState();
  store.setIds(store.ids.filter((id) => id !== eventId));
}
