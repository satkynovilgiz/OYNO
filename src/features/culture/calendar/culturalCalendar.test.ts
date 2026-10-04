import * as fs from 'fs';
import * as path from 'path';

import en from '@/i18n/locales/en.json';
import kg from '@/i18n/locales/kg.json';
import ru from '@/i18n/locales/ru.json';

import { reminderDate } from './calendarReminders';
import { calendarList, CULTURAL_CALENDAR, homeEvent, isToday, nextOccurrence, occurrenceInYear, thisMonth, todayEvents, upcoming, validateCalendar, type CulturalCalendarEvent } from './culturalCalendar';

jest.mock('expo-notifications', () => ({ scheduleNotificationAsync: jest.fn(), cancelScheduledNotificationAsync: jest.fn(), SchedulableTriggerInputTypes: { DATE: 'date' } }));

const ev = (id: string, dateRule: CulturalCalendarEvent['dateRule']): CulturalCalendarEvent => ({ id, kind: 'observance', titleKey: id, description: { itemId: 'i', field: 'history' }, dateRule, cultureItemIds: [], sourceItemId: 'i', related: {} });

describe('Cultural Calendar', () => {
  it('fixed date (respecting the year it began)', () => {
    const rule = { type: 'fixed_date' as const, month: 3, day: 5, sinceYear: 2019 };
    expect(occurrenceInYear(rule, 2027)?.start).toEqual(new Date(2027, 2, 5));
    expect(occurrenceInYear(rule, 2018)).toBeNull();
    expect(occurrenceInYear({ type: 'fixed_date', month: 2, day: 30 }, 2027)).toBeNull();
  });

  it('explicit-year date = anniversary from that year on', () => {
    const rule = { type: 'explicit_year_date' as const, year: 2001, month: 11, day: 9 };
    expect(occurrenceInYear(rule, 2000)).toBeNull();
    expect(nextOccurrence(rule, new Date(2026, 9, 3))?.start).toEqual(new Date(2026, 10, 9));
  });

  it('ranges crossing a month boundary and the year end', () => {
    const range = { type: 'date_range' as const, start: { month: 3, day: 30 }, end: { month: 4, day: 2 } };
    const occurrence = occurrenceInYear(range, 2027)!;
    expect(occurrence.end).toEqual(new Date(2027, 3, 2));
    expect(isToday(occurrence, new Date(2027, 3, 1, 15))).toBe(true);
    const newYear = { type: 'date_range' as const, start: { month: 12, day: 30 }, end: { month: 1, day: 2 } };
    expect(nextOccurrence(newYear, new Date(2027, 0, 1))).toEqual({ start: new Date(2026, 11, 30), end: new Date(2027, 0, 2) });
    const list = calendarList([ev('april-span', range)], new Date(2027, 3, 1));
    expect(thisMonth(list, new Date(2027, 3, 1))).toHaveLength(1);
  });

  it('unconfirmed date: never a fake date, listed after dated events', () => {
    expect(occurrenceInYear(null, 2026)).toBeNull();
    const list = calendarList([ev('z-unconfirmed', null), ev('a-dated', { type: 'fixed_date', month: 12, day: 1 })], new Date(2026, 9, 3));
    expect(list.map((entry) => entry.event.id)).toEqual(['a-dated', 'z-unconfirmed']);
    expect(list[1].occurrence).toBeNull();
    expect(upcoming(list, new Date(2026, 9, 3)).map((entry) => entry.event.id)).toEqual(['a-dated']);
  });

  it('today / upcoming / home window; no fake daily content', () => {
    const list = calendarList(CULTURAL_CALENDAR, new Date(2027, 2, 5, 9));
    expect(todayEvents(list, new Date(2027, 2, 5, 9)).map((entry) => entry.event.id)).toEqual(['world-kalpak-day']);
    const quiet = calendarList(CULTURAL_CALENDAR, new Date(2026, 9, 3));
    expect(todayEvents(quiet, new Date(2026, 9, 3))).toEqual([]);
    expect(homeEvent(quiet, new Date(2026, 9, 3))).toBeNull();
    expect(homeEvent(calendarList(CULTURAL_CALENDAR, new Date(2026, 10, 7)), new Date(2026, 10, 7))?.event.id).toBe('kok-boru-federation');
    expect(homeEvent(calendarList(CULTURAL_CALENDAR, new Date(2026, 10, 5)), new Date(2026, 10, 5))).toBeNull();
  });

  it('sorted by next date; duplicates collapse', () => {
    const list = calendarList([...CULTURAL_CALENDAR, CULTURAL_CALENDAR[0]], new Date(2026, 9, 3));
    expect(list.map((entry) => entry.event.id)).toEqual(['kok-boru-federation', 'world-kalpak-day']);
  });

  it('every dated claim has an authored source item WITH sources and authored text (real fields)', () => {
    const items = [
      { id: 'clothing-ak-kalpak', sources: ['https://a', 'https://b'], modern_status: 'Кыргызстандын ... 2019-жылдан тартып 5-март "Дүйнөлүк калпак күнү" катары белгиленет.' },
      { id: 'horse-kok-boru', sources: ['https://a', 'https://b', 'https://c'], history: '... 2001-жылы 9-ноябрда Бишкекте Көк бөрү эл аралык федерациясы түзүлгөн.' },
    ];
    expect(validateCalendar(CULTURAL_CALENDAR, items)).toEqual([]);
    expect(validateCalendar(CULTURAL_CALENDAR, items.map((item) => ({ ...item, sources: [] })))).toEqual(['world-kalpak-day: dated claim without sources', 'kok-boru-federation: dated claim without sources']);
    expect(validateCalendar([...CULTURAL_CALENDAR, CULTURAL_CALENDAR[0]], items)).toContain('world-kalpak-day: duplicate');
  });

  it('offline: the calendar is bundled data (no network to list dates)', () => {
    const model = fs.readFileSync(path.join(__dirname, 'culturalCalendar.ts'), 'utf8');
    expect(model).not.toMatch(/fetch|supabase|useQuery/);
  });

  it('reminders: explicit opt-in only, a morning time, never auto-enrolled', () => {
    expect(reminderDate(new Date(2027, 2, 5))).toEqual(new Date(2027, 2, 5, 10, 0, 0));
    const screen = fs.readFileSync(path.join(__dirname, 'CulturalCalendarScreen.tsx'), 'utf8');
    expect(screen.match(/remindMe\(/g)).toHaveLength(1);
    expect(screen).toMatch(/onPress=\{\(\) => void onRemind\(\)\}/);
    const reminders = fs.readFileSync(path.join(__dirname, 'calendarReminders.ts'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    expect(reminders).toMatch(/oynoCalendar: true/);
    expect(reminders).not.toMatch(/oynoReminder/);
  });

  it('no countdown pressure', () => {
    for (const dict of [en, ru, kg]) expect(JSON.stringify((dict as unknown as { culturalCalendar: unknown }).culturalCalendar)).not.toMatch(/days left|countdown|осталось|калды/i);
  });

  it('KG / RU / EN', () => {
    for (const dict of [en, ru, kg]) {
      const block = (dict as unknown as { culturalCalendar: Record<string, unknown> }).culturalCalendar;
      for (const key of ['title', 'today', 'upcoming', 'thisMonth', 'related', 'dateNotConfirmed', 'remindMe']) expect(block[key]).toBeTruthy();
      for (const event of CULTURAL_CALENDAR) expect((block.events as Record<string, string>)[event.id]).toBeTruthy();
    }
  });
});
