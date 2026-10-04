import * as fs from 'fs';
import * as path from 'path';

import en from '@/i18n/locales/en.json';
import kg from '@/i18n/locales/kg.json';
import ru from '@/i18n/locales/ru.json';

import type { JournalEntry } from '../journalModel';
import { dateIndex, entriesOn, monthGrid, monthOf, onThisDay, shiftMonth } from './journalCalendar';

const entry = (id: string, date: string, fields: Partial<JournalEntry> = {}): JournalEntry => ({
  id, title: `Memory ${id}`, note: 'private note', date, photo: null, link: null, createdAt: '2026-10-04T08:00:00.000Z', updatedAt: '2026-10-04T08:00:00.000Z', deletedAt: null, ...fields,
});

describe('Journal Calendar + On This Day', () => {
  it('places memories by JournalEntry.date - createdAt/updatedAt are ignored', () => {
    const index = dateIndex([entry('a', '2024-03-10', { createdAt: '2026-10-04T00:00:00Z', updatedAt: '2026-10-05T00:00:00Z' })]);
    expect([...index.keys()]).toEqual(['2024-03-10']);
  });

  it('multiple memories on one date are all counted and listed', () => {
    const entries = [entry('a', '2026-10-04'), entry('b', '2026-10-04'), entry('c', '2026-10-04'), entry('d', '2026-10-05')];
    expect(dateIndex(entries).get('2026-10-04')).toBe(3);
    expect(entriesOn(entries, '2026-10-04').map((e) => e.id).sort()).toEqual(['a', 'b', 'c']);
  });

  it('deleted entries never mark a day, appear on a day or in On This Day', () => {
    const entries = [entry('gone', '2025-10-04', { deletedAt: '2026-01-01T00:00:00Z' })];
    expect(dateIndex(entries).size).toBe(0);
    expect(entriesOn(entries, '2025-10-04')).toEqual([]);
    expect(onThisDay(entries, '2026-10-04')).toEqual([]);
  });

  it('month boundaries and previous / next month (Monday-first grid)', () => {
    expect(shiftMonth({ year: 2026, month: 1 }, -1)).toEqual({ year: 2025, month: 12 });
    expect(shiftMonth({ year: 2026, month: 12 }, 1)).toEqual({ year: 2027, month: 1 });
    const october = monthGrid({ year: 2026, month: 10 }); // 1 Oct 2026 is a Thursday
    expect(october.slice(0, 4)).toEqual([null, null, null, '2026-10-01']);
    expect(october.filter(Boolean)).toHaveLength(31);
    expect(october.length % 7).toBe(0);
    expect(monthGrid({ year: 2024, month: 2 }).filter(Boolean)).toHaveLength(29);
    expect(monthOf('2026-10-04')).toEqual({ year: 2026, month: 10 });
  });

  it('On This Day: same month and day, previous years only; truthful "years ago"', () => {
    const entries = [entry('this-year', '2026-10-04'), entry('last', '2025-10-04'), entry('older', '2023-10-04'), entry('other-day', '2025-10-05')];
    const result = onThisDay(entries, '2026-10-04');
    expect(result.map((r) => [r.entry.id, r.yearsAgo])).toEqual([
      ['last', 1],
      ['older', 3],
    ]);
  });

  it('leap day: a 29 February memory appears only on 29 February', () => {
    const entries = [entry('leap', '2024-02-29')];
    expect(onThisDay(entries, '2025-02-28')).toEqual([]);
    expect(onThisDay(entries, '2025-03-01')).toEqual([]);
    expect(onThisDay(entries, '2028-02-29').map((r) => r.yearsAgo)).toEqual([4]);
  });

  it('filters: dots follow the active filter (same rule as the day list)', () => {
    const entries = [entry('place', '2026-10-04', { link: { type: 'nature_site', id: 'son-kol', label: 'Son-Kol' } }), entry('plain', '2026-10-04')];
    expect(dateIndex(entries, 'places').get('2026-10-04')).toBe(1);
    expect(entriesOn(entries, '2026-10-04', 'places').map((e) => e.id)).toEqual(['place']);
  });

  it('account isolation + offline: derived only from the account-bound Journal store, nothing fetched or stored', () => {
    const screen = fs.readFileSync(path.join(__dirname, 'JournalCalendarScreen.tsx'), 'utf8');
    const model = fs.readFileSync(path.join(__dirname, 'journalCalendar.ts'), 'utf8');
    expect(screen).toMatch(/useJournalStore\(\(state\) => state\.entries\)/);
    expect(model + screen).not.toMatch(/supabase|fetch\(|AsyncStorage/);
  });

  it('analytics carry no private Journal data', () => {
    for (const file of ['JournalCalendarScreen.tsx', 'OnThisDayCard.tsx']) {
      const source = fs.readFileSync(path.join(__dirname, file), 'utf8');
      for (const call of source.match(/track\([^)]*\)/g) ?? []) expect(call).toMatch(/^track\('(journal_calendar_opened|journal_on_this_day_opened)'\)$/);
    }
  });

  it('Add memory reuses the existing editor with the selected date (never in the future)', () => {
    const screen = fs.readFileSync(path.join(__dirname, 'JournalCalendarScreen.tsx'), 'utf8');
    expect(screen).toMatch(/router\.push\(`\/journal\/new\?date=\$\{selected\}`/);
    expect(screen).toMatch(/selected <= today \?/);
    const editor = fs.readFileSync(path.join(__dirname, '../JournalEntryScreen.tsx'), 'utf8');
    expect(editor).toMatch(/initialDate <= localDateKey\(\)/);
  });

  it('KG / RU / EN', () => {
    for (const dict of [en, ru, kg]) {
      const block = (dict as unknown as { journalCalendar: Record<string, string> }).journalCalendar;
      for (const key of ['title', 'today', 'previousMonth', 'nextMonth', 'memories_other', 'noMemories', 'addMemory', 'onThisDay', 'yearsAgo_one', 'yearsAgo_other']) expect(block[key]).toBeTruthy();
    }
  });
});
