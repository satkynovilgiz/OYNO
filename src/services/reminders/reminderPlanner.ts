import type { SupportedLanguage } from '@/i18n';
import { localDateKey } from '@/services/daily/dailyDiscovery';

/**
 * Pure planning for OYNO's opt-in local reminders - decides WHAT to
 * schedule; reminderScheduler.ts applies it with expo-notifications.
 *
 * Rules (no spam):
 * - Everything is opt-in; nothing is planned for a type that's off.
 * - At most ONE reminder per day. Priority: Daily OYNO > Continue Journey
 *   > Guided Trail. With Daily on, it owns every day's slot.
 * - Daily: once a day at the chosen time; skipped today if today's Daily is
 *   already completed.
 * - Continue Journey: every 2nd day, only when the Home recommendation is
 *   a real continuation (never for "explore next"/"complete").
 * - Guided Trail: every 3rd day, only while a trail is started and
 *   unfinished.
 * - Quiet hours: a reminder that would land inside them moves to the end
 *   of the quiet window (same morning), never earlier.
 * - Stable ids (type + local date) + a content signature, so re-planning
 *   never stacks duplicates and outdated/changed ones get cancelled.
 */

export type ReminderType = 'daily' | 'journey' | 'trail';

export type ReminderSettings = {
  dailyEnabled: boolean;
  journeyEnabled: boolean;
  trailEnabled: boolean;
  /** Minutes after local midnight. */
  time: number;
  quietHours: { enabled: boolean; start: number; end: number };
};

export const DEFAULT_REMINDER_SETTINGS: ReminderSettings = {
  dailyEnabled: false,
  journeyEnabled: false,
  trailEnabled: false,
  time: 19 * 60,
  quietHours: { enabled: false, start: 22 * 60, end: 8 * 60 },
};

export type ReminderCopy = { title: string; body: string };

export type ReminderContext = {
  now: Date;
  language: SupportedLanguage;
  dailyCompletedToday: boolean;
  /** Only when Home's recommendation is a real continuation. */
  journey: { route: string; copy: ReminderCopy } | null;
  /** Only while a trail is in progress. */
  trail: { id: string; route: string; copy: ReminderCopy } | null;
  dailyCopy: ReminderCopy;
};

export type PlannedReminder = {
  id: string;
  type: ReminderType;
  date: Date;
  title: string;
  body: string;
  route: string;
  /** Changes whenever anything the user would see changes (text, language,
   * route, time) - used to replace outdated scheduled notifications. */
  signature: string;
};

export const PLAN_DAYS = 7;
const JOURNEY_EVERY_DAYS = 2;
const TRAIL_EVERY_DAYS = 3;

function minutesOf(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

export function isInQuietHours(minutes: number, quiet: ReminderSettings['quietHours']): boolean {
  if (!quiet.enabled || quiet.start === quiet.end) return false;
  // Window may wrap midnight (22:00-08:00) or not (13:00-15:00).
  return quiet.start < quiet.end ? minutes >= quiet.start && minutes < quiet.end : minutes >= quiet.start || minutes < quiet.end;
}

/** Moves a time inside quiet hours to the moment they end. */
export function adjustForQuietHours(date: Date, quiet: ReminderSettings['quietHours']): Date {
  if (!isInQuietHours(minutesOf(date), quiet)) return date;
  const adjusted = new Date(date);
  if (quiet.start > quiet.end && minutesOf(date) >= quiet.start) adjusted.setDate(adjusted.getDate() + 1);
  adjusted.setHours(Math.floor(quiet.end / 60), quiet.end % 60, 0, 0);
  return adjusted;
}

function make(type: ReminderType, idSuffix: string, date: Date, copy: ReminderCopy, route: string, language: SupportedLanguage): PlannedReminder {
  const signature = JSON.stringify({ at: date.toISOString(), title: copy.title, body: copy.body, route, language });
  return { id: `oyno-${type}-${idSuffix}`, type, date, title: copy.title, body: copy.body, route, signature };
}

export function planReminders(settings: ReminderSettings, context: ReminderContext, days = PLAN_DAYS): PlannedReminder[] {
  const planned: PlannedReminder[] = [];
  const usedDays = new Set<string>();

  for (let offset = 0; offset < days; offset += 1) {
    const base = new Date(context.now);
    base.setDate(base.getDate() + offset);
    base.setHours(Math.floor(settings.time / 60), settings.time % 60, 0, 0);
    const date = adjustForQuietHours(base, settings.quietHours);
    if (date.getTime() <= context.now.getTime()) continue;
    const dayKey = localDateKey(date);
    if (usedDays.has(dayKey)) continue; // max one per day, even after a quiet-hours shift

    let reminder: PlannedReminder | null = null;
    if (settings.dailyEnabled) {
      const isToday = dayKey === localDateKey(context.now);
      if (!(isToday && context.dailyCompletedToday)) reminder = make('daily', dayKey, date, context.dailyCopy, '/daily', context.language);
    } else if (settings.journeyEnabled && context.journey && offset % JOURNEY_EVERY_DAYS === 0) {
      reminder = make('journey', dayKey, date, context.journey.copy, context.journey.route, context.language);
    } else if (settings.trailEnabled && context.trail && offset % TRAIL_EVERY_DAYS === 1) {
      reminder = make('trail', `${context.trail.id}-${dayKey}`, date, context.trail.copy, context.trail.route, context.language);
    }

    if (reminder) {
      planned.push(reminder);
      usedDays.add(dayKey);
    }
  }
  return planned;
}

export type ScheduledReminderRef = { id: string; signature: string | null };

/** What to cancel and what to (re)schedule so the device matches the plan -
 * unchanged reminders are left alone (no duplicates, no churn). */
export function diffSchedule(existing: ScheduledReminderRef[], planned: PlannedReminder[]): { toCancel: string[]; toSchedule: PlannedReminder[] } {
  const plannedById = new Map(planned.map((reminder) => [reminder.id, reminder]));
  const existingById = new Map(existing.map((entry) => [entry.id, entry]));
  const toCancel = existing.filter((entry) => plannedById.get(entry.id)?.signature !== entry.signature).map((entry) => entry.id);
  const toSchedule = planned.filter((reminder) => existingById.get(reminder.id)?.signature !== reminder.signature);
  return { toCancel, toSchedule };
}
