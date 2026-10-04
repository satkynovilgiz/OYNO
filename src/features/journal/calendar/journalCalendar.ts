import { visibleEntries, type JournalEntry, type JournalFilter } from '../journalModel';

/**
 * Journal Calendar + On This Day - derived from the person's own Journal
 * state (works offline, nothing stored). Placement uses ONLY
 * JournalEntry.date, the memory date the person chose - never createdAt or
 * updatedAt. Deleted entries (tombstones) never count.
 *
 * Filter rule (documented): calendar dots FOLLOW the active Journal filter,
 * so a dot always means "the selected-day list below will have memories".
 */

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export type MonthRef = { year: number; month: number }; // month 1-12

/** Lightweight date -> count map (no note/photo bodies touched). */
export function dateIndex(entries: JournalEntry[], filter: JournalFilter = 'all'): Map<string, number> {
  const index = new Map<string, number>();
  for (const entry of visibleEntries(entries, filter)) {
    if (!DATE_RE.test(entry.date)) continue;
    index.set(entry.date, (index.get(entry.date) ?? 0) + 1);
  }
  return index;
}

export function entriesOn(entries: JournalEntry[], dateKey: string, filter: JournalFilter = 'all'): JournalEntry[] {
  return visibleEntries(entries, filter).filter((entry) => entry.date === dateKey);
}

export function keyOf(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function monthOf(dateKey: string): MonthRef {
  const match = DATE_RE.exec(dateKey);
  return match ? { year: Number(match[1]), month: Number(match[2]) } : { year: 1970, month: 1 };
}

export function shiftMonth(ref: MonthRef, delta: number): MonthRef {
  const index = ref.year * 12 + (ref.month - 1) + delta;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

export function daysInMonth(ref: MonthRef): number {
  return new Date(ref.year, ref.month, 0).getDate();
}

/** 7-column grid, weeks start Monday (as in Kyrgyzstan); null = padding. */
export function monthGrid(ref: MonthRef): (string | null)[] {
  const first = new Date(ref.year, ref.month - 1, 1).getDay(); // 0 = Sunday
  const lead = (first + 6) % 7;
  const cells: (string | null)[] = Array.from({ length: lead }, () => null);
  for (let day = 1; day <= daysInMonth(ref); day += 1) cells.push(keyOf(ref.year, ref.month, day));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export type OnThisDayEntry = { entry: JournalEntry; yearsAgo: number };

/**
 * Same month + day, PREVIOUS calendar years only (the current year is
 * excluded). "Years ago" = calendar year difference, not ms / 365. A
 * 29 February memory matches only on 29 February.
 */
export function onThisDay(entries: JournalEntry[], todayKey: string): OnThisDayEntry[] {
  const today = DATE_RE.exec(todayKey);
  if (!today) return [];
  const [, year, month, day] = today;
  return visibleEntries(entries)
    .flatMap((entry) => {
      const match = DATE_RE.exec(entry.date);
      if (!match || match[2] !== month || match[3] !== day) return [];
      const yearsAgo = Number(year) - Number(match[1]);
      return yearsAgo >= 1 ? [{ entry, yearsAgo }] : [];
    })
    .sort((a, b) => a.yearsAgo - b.yearsAgo || b.entry.createdAt.localeCompare(a.entry.createdAt));
}
