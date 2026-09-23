import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { diffSchedule, type PlannedReminder } from './reminderPlanner';

/**
 * Applies a reminder plan to the device's local notification schedule
 * (expo-notifications, works offline). It never ASKS for permission - that
 * happens only when the user turns a reminder on (requestReminderPermission)
 * - and without permission it schedules nothing. Only OYNO reminders
 * (data.oynoReminder) are ever touched; other notifications are left alone.
 */

export async function requestReminderPermission(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;
    const requested = await Notifications.requestPermissionsAsync();
    return requested.granted;
  } catch {
    return false;
  }
}

type ScheduledOynoReminder = { id: string; signature: string | null };

async function scheduledOynoReminders(): Promise<ScheduledOynoReminder[]> {
  const all = await Notifications.getAllScheduledNotificationsAsync();
  return all
    .filter((request) => request.content.data?.oynoReminder === true)
    .map((request) => ({ id: request.identifier, signature: (request.content.data?.signature as string | undefined) ?? null }));
}

let queue: Promise<void> = Promise.resolve();

/** Serialized so overlapping syncs can't double-schedule. */
export function syncReminderSchedule(planned: PlannedReminder[]): Promise<void> {
  queue = queue.then(() => applyPlan(planned)).catch(() => {});
  return queue;
}

async function applyPlan(planned: PlannedReminder[]): Promise<void> {
  if (Platform.OS === 'web') return;
  const permission = await Notifications.getPermissionsAsync();
  const existing = await scheduledOynoReminders();
  // No permission (never granted, or revoked in iOS Settings): clear ours.
  const target = permission.granted ? planned : [];
  const { toCancel, toSchedule } = diffSchedule(existing, target);
  for (const id of toCancel) await Notifications.cancelScheduledNotificationAsync(id);
  for (const reminder of toSchedule) {
    await Notifications.scheduleNotificationAsync({
      identifier: reminder.id,
      content: {
        title: reminder.title,
        body: reminder.body,
        data: { oynoReminder: true, type: reminder.type, route: reminder.route, signature: reminder.signature },
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: reminder.date },
    });
  }
}
