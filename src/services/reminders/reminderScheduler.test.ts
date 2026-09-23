import * as Notifications from 'expo-notifications';

import { registerForPushNotifications } from '@/services/notifications/pushRegistration';

import { DEFAULT_REMINDER_SETTINGS, planReminders, type ReminderContext } from './reminderPlanner';
import { syncReminderSchedule } from './reminderScheduler';

jest.mock('@/services/supabase/client', () => ({ supabase: { rpc: jest.fn() } }));

const mockScheduled = new Map<string, { identifier: string; content: { data: Record<string, unknown> } }>();
jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  setNotificationChannelAsync: jest.fn(),
  AndroidImportance: { DEFAULT: 3 },
  SchedulableTriggerInputTypes: { DATE: 'date' },
  getPermissionsAsync: jest.fn(async () => ({ granted: true, status: 'granted' })),
  requestPermissionsAsync: jest.fn(async () => ({ granted: true, status: 'granted' })),
  getExpoPushTokenAsync: jest.fn(),
  getAllScheduledNotificationsAsync: jest.fn(async () => Array.from(mockScheduled.values())),
  cancelScheduledNotificationAsync: jest.fn(async (id: string) => {
    mockScheduled.delete(id);
  }),
  scheduleNotificationAsync: jest.fn(async ({ identifier, content }: { identifier: string; content: { data: Record<string, unknown> } }) => {
    mockScheduled.set(identifier, { identifier, content });
    return identifier;
  }),
}));

const ctx: ReminderContext = {
  now: new Date(2026, 8, 23, 10, 0),
  language: 'kg',
  dailyCompletedToday: false,
  journey: null,
  trail: null,
  dailyCopy: { title: 'Бүгүнкү OYNO даяр', body: '…' },
};

beforeEach(() => {
  mockScheduled.clear();
  jest.clearAllMocks();
});

describe('syncReminderSchedule', () => {
  it('schedules the plan once - re-syncing never duplicates', async () => {
    const plan = planReminders({ ...DEFAULT_REMINDER_SETTINGS, dailyEnabled: true }, ctx);
    await syncReminderSchedule(plan);
    await syncReminderSchedule(plan);
    expect(mockScheduled.size).toBe(plan.length);
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(plan.length);
  });

  it('cancels outdated reminders and reschedules changed ones (e.g. language)', async () => {
    await syncReminderSchedule(planReminders({ ...DEFAULT_REMINDER_SETTINGS, dailyEnabled: true }, ctx));
    const english = planReminders({ ...DEFAULT_REMINDER_SETTINGS, dailyEnabled: true }, { ...ctx, language: 'en', dailyCopy: { title: "Today's OYNO is ready", body: '…' } });
    await syncReminderSchedule(english);
    expect(Array.from(mockScheduled.values()).every((entry) => entry.content.data.signature && JSON.parse(entry.content.data.signature as string).language === 'en')).toBe(true);
    await syncReminderSchedule([]); // everything turned off
    expect(mockScheduled.size).toBe(0);
  });

  it('never asks for permission while syncing, and schedules nothing without it', async () => {
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValueOnce({ granted: false, status: 'denied' });
    await syncReminderSchedule(planReminders({ ...DEFAULT_REMINDER_SETTINGS, dailyEnabled: true }, ctx));
    expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
    expect(mockScheduled.size).toBe(0);
  });

  it('leaves notifications that are not OYNO reminders alone', async () => {
    mockScheduled.set('someone-else', { identifier: 'someone-else', content: { data: {} } });
    await syncReminderSchedule([]);
    expect(mockScheduled.has('someone-else')).toBe(true);
  });
});

describe('app launch', () => {
  it('push registration never requests notification permission', async () => {
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValueOnce({ granted: false, status: 'undetermined' });
    await registerForPushNotifications();
    expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
  });
});
