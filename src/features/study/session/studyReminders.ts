import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { create } from 'zustand';

import { requestReminderPermission } from '@/services/reminders/reminderScheduler';
import { safeJsonParse } from '@/services/storage/safeJson';

/**
 * Study Planner reminders - optional, local only, opt-in. Weekly
 * notifications on the chosen days at the chosen time, through the same
 * expo-notifications permission flow as Reminders. Tagged `oynoStudy` with
 * ids `oyno-study-<weekday>`: rescheduling or turning them off touches ONLY
 * these (never Daily/Journey reminders or calendar reminders). Neutral copy,
 * no personal data in the notification.
 */
const KEY = 'oyno.studyReminders.v1';
export const STUDY_REMINDER_PREFIX = 'oyno-study-';
/** expo-notifications weekly trigger weekdays: 1 = Sunday ... 7 = Saturday. */
export const WEEKDAYS = [2, 3, 4, 5, 6, 7, 1] as const;

export type StudyReminderSettings = { enabled: boolean; days: number[]; hour: number; minute: number };
export const DEFAULT_STUDY_REMINDERS: StudyReminderSettings = { enabled: false, days: [2, 4, 6], hour: 18, minute: 0 };

export function sanitizeSettings(value: unknown): StudyReminderSettings {
  if (!value || typeof value !== 'object') return DEFAULT_STUDY_REMINDERS;
  const raw = value as Partial<StudyReminderSettings>;
  const days = Array.isArray(raw.days) ? [...new Set(raw.days.filter((day): day is number => Number.isInteger(day) && day >= 1 && day <= 7))].sort() : DEFAULT_STUDY_REMINDERS.days;
  const hour = Number.isInteger(raw.hour) && raw.hour! >= 0 && raw.hour! <= 23 ? raw.hour! : DEFAULT_STUDY_REMINDERS.hour;
  const minute = Number.isInteger(raw.minute) && raw.minute! >= 0 && raw.minute! <= 59 ? raw.minute! : DEFAULT_STUDY_REMINDERS.minute;
  return { enabled: raw.enabled === true, days, hour, minute };
}

export function studyReminderIds(days: readonly number[]): string[] {
  return days.map((day) => `${STUDY_REMINDER_PREFIX}${day}`);
}

type State = { isLoaded: boolean; settings: StudyReminderSettings; load: () => Promise<void>; save: (settings: StudyReminderSettings) => void };

export const useStudyReminders = create<State>((set, get) => ({
  isLoaded: false,
  settings: DEFAULT_STUDY_REMINDERS,
  load: async () => {
    if (get().isLoaded) return;
    set({ settings: sanitizeSettings(safeJsonParse<unknown>(await AsyncStorage.getItem(KEY).catch(() => null), null)), isLoaded: true });
  },
  save: (settings) => {
    const clean = sanitizeSettings(settings);
    set({ settings: clean });
    void AsyncStorage.setItem(KEY, JSON.stringify(clean)).catch(() => undefined);
  },
}));

type NotificationsModule = typeof import('expo-notifications');
function notifications(): NotificationsModule | null {
  if (Platform.OS === 'web') return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-notifications') as NotificationsModule;
  } catch {
    return null;
  }
}

/** Cancels every Study Planner notification (and nothing else). */
export async function cancelStudyReminders(): Promise<void> {
  const Notifications = notifications();
  if (!Notifications) return;
  for (const id of studyReminderIds([1, 2, 3, 4, 5, 6, 7])) await Notifications.cancelScheduledNotificationAsync(id).catch(() => undefined);
}

export type StudyReminderResult = 'scheduled' | 'off' | 'denied' | 'unavailable';

/** Applies the settings: always clears our own ids first, then schedules the chosen days. */
export async function applyStudyReminders(settings: StudyReminderSettings, copy: { title: string; body: string }): Promise<StudyReminderResult> {
  const Notifications = notifications();
  if (!Notifications) return 'unavailable';
  await cancelStudyReminders();
  if (!settings.enabled || settings.days.length === 0) return 'off';
  if (!(await requestReminderPermission())) return 'denied';
  try {
    for (const day of settings.days) {
      await Notifications.scheduleNotificationAsync({
        identifier: `${STUDY_REMINDER_PREFIX}${day}`,
        content: { title: copy.title, body: copy.body, data: { oynoStudy: true, route: '/study/session' } },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.WEEKLY, weekday: day, hour: settings.hour, minute: settings.minute },
      });
    }
  } catch {
    return 'unavailable';
  }
  return 'scheduled';
}
