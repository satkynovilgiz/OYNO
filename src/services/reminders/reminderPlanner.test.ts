import { adjustForQuietHours, DEFAULT_REMINDER_SETTINGS, diffSchedule, isInQuietHours, planReminders, type ReminderContext, type ReminderSettings } from './reminderPlanner';

const now = new Date(2026, 8, 23, 10, 0); // local 23 Sep 2026 10:00
const ctx: ReminderContext = {
  now,
  language: 'kg',
  dailyCompletedToday: false,
  journey: { route: '/games/kyz-kuumai', copy: { title: 'Саякатыңды улант', body: 'Ат маданияты' } },
  trail: { id: 'horse-culture', route: '/trails/horse-culture', copy: { title: 'Саякат', body: 'Ат маданияты' } },
  dailyCopy: { title: 'Бүгүнкү OYNO даяр', body: 'Кыргыз маданиятынан бүгүнкү окуяны ач.' },
};
const on = (overrides: Partial<ReminderSettings>): ReminderSettings => ({ ...DEFAULT_REMINDER_SETTINGS, ...overrides });

describe('planReminders', () => {
  it('plans nothing when everything is off (opt-in)', () => {
    expect(planReminders(DEFAULT_REMINDER_SETTINGS, ctx)).toEqual([]);
  });

  it('schedules one Daily a day at the chosen time with stable ids', () => {
    const plan = planReminders(on({ dailyEnabled: true, time: 19 * 60 }), ctx);
    expect(plan).toHaveLength(7);
    expect(plan[0]).toMatchObject({ id: 'oyno-daily-2026-09-23', route: '/daily' });
    expect(plan[0].date.getHours()).toBe(19);
    expect(new Set(plan.map((r) => r.id)).size).toBe(plan.length);
  });

  it('skips today when today’s Daily is already completed', () => {
    const plan = planReminders(on({ dailyEnabled: true }), { ...ctx, dailyCompletedToday: true });
    expect(plan[0].id).toBe('oyno-daily-2026-09-24');
  });

  it('never plans more than one reminder per day; Daily wins', () => {
    const plan = planReminders(on({ dailyEnabled: true, journeyEnabled: true, trailEnabled: true }), ctx);
    const days = plan.map((r) => r.id.slice(-10));
    expect(new Set(days).size).toBe(plan.length);
    expect(plan.every((r) => r.type === 'daily')).toBe(true);
  });

  it('journey every 2nd day, trail every 3rd - and only when meaningful', () => {
    const plan = planReminders(on({ journeyEnabled: true, trailEnabled: true }), ctx);
    expect(plan.filter((r) => r.type === 'journey').map((r) => r.id)).toEqual([
      'oyno-journey-2026-09-23',
      'oyno-journey-2026-09-25',
      'oyno-journey-2026-09-27',
      'oyno-journey-2026-09-29',
    ]);
    expect(plan.filter((r) => r.type === 'trail').length).toBeGreaterThan(0);
    expect(planReminders(on({ journeyEnabled: true, trailEnabled: true }), { ...ctx, journey: null, trail: null })).toEqual([]);
  });

  it('moves reminders out of quiet hours', () => {
    const plan = planReminders(on({ dailyEnabled: true, time: 23 * 60, quietHours: { enabled: true, start: 22 * 60, end: 8 * 60 } }), ctx);
    expect(plan.every((r) => !isInQuietHours(r.date.getHours() * 60 + r.date.getMinutes(), { enabled: true, start: 22 * 60, end: 8 * 60 }))).toBe(true);
    expect(plan[0].date.getHours()).toBe(8);
  });

  it('quiet hours that do not wrap midnight', () => {
    const quiet = { enabled: true, start: 13 * 60, end: 15 * 60 };
    expect(isInQuietHours(14 * 60, quiet)).toBe(true);
    expect(isInQuietHours(16 * 60, quiet)).toBe(false);
    expect(adjustForQuietHours(new Date(2026, 8, 23, 14, 0), quiet).getHours()).toBe(15);
  });

  it('a language change changes signatures so reminders get rescheduled', () => {
    const kg = planReminders(on({ dailyEnabled: true }), ctx);
    const en = planReminders(on({ dailyEnabled: true }), { ...ctx, language: 'en', dailyCopy: { title: "Today's OYNO is ready", body: 'x' } });
    expect(kg[0].id).toBe(en[0].id);
    expect(kg[0].signature).not.toBe(en[0].signature);
  });
});

describe('diffSchedule', () => {
  it('keeps unchanged, cancels outdated, never duplicates', () => {
    const plan = planReminders(on({ dailyEnabled: true }), ctx);
    const existing = [
      { id: plan[0].id, signature: plan[0].signature },
      { id: plan[1].id, signature: 'old' },
      { id: 'oyno-journey-2026-09-20', signature: 'x' },
    ];
    const { toCancel, toSchedule } = diffSchedule(existing, plan);
    expect(toCancel.sort()).toEqual([plan[1].id, 'oyno-journey-2026-09-20'].sort());
    expect(toSchedule.map((r) => r.id)).not.toContain(plan[0].id);
    expect(toSchedule.map((r) => r.id)).toContain(plan[1].id);
    expect(toSchedule).toHaveLength(plan.length - 1);
  });
});
