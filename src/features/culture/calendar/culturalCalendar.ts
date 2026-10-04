/**
 * Kyrgyz Cultural Calendar - CURATED, bundled (works offline). Every dated
 * entry quotes a date that already exists in an AUTHORED OYNO culture item
 * field (the description shown IS that field's text, not new prose), and
 * the item's own sources + verification travel with it. No scraping, no
 * generated traditions, no guessed or lunar dates.
 *
 * Considered and NOT included (2026-10-03 content audit):
 *   - Nooruz (trad-fest-01): no authored date and no sources in OYNO yet.
 *   - Other trad-fest items: no authored dates.
 * A date can only be added here once an authored, sourced field states it.
 */

export type DateRule =
  | { type: 'fixed_date'; month: number; day: number; sinceYear?: number }
  | { type: 'date_range'; start: { month: number; day: number }; end: { month: number; day: number } }
  | { type: 'explicit_year_date'; year: number; month: number; day: number };

export type CulturalCalendarEvent = {
  id: string;
  kind: 'observance' | 'anniversary';
  titleKey: string;
  /** The authored text the date comes from (shown verbatim as the description). */
  description: { itemId: string; field: 'modern_status' | 'history' | 'when_used' | 'origin' | 'cultural_meaning' };
  /** null = the date isn't confirmed: shown as general information, never with a date. */
  dateRule: DateRule | null;
  cultureItemIds: string[];
  /** Sources travel with the authored item (its `sources`); this is that item id. */
  sourceItemId: string;
  related: { glossaryIds?: string[]; pathIds?: string[]; compareIds?: string[] };
};

export const CULTURAL_CALENDAR: readonly CulturalCalendarEvent[] = [
  {
    id: 'world-kalpak-day',
    kind: 'observance',
    titleKey: 'culturalCalendar.events.world-kalpak-day',
    // clothing-ak-kalpak.modern_status: "...2019-жылдан тартып 5-март «Дүйнөлүк калпак күнү» катары белгиленет."
    description: { itemId: 'clothing-ak-kalpak', field: 'modern_status' },
    dateRule: { type: 'fixed_date', month: 3, day: 5, sinceYear: 2019 },
    cultureItemIds: ['clothing-ak-kalpak'],
    sourceItemId: 'clothing-ak-kalpak',
    related: { glossaryIds: ['ak-kalpak'], compareIds: ['ak-kalpak-tebetey'] },
  },
  {
    id: 'kok-boru-federation',
    kind: 'anniversary',
    titleKey: 'culturalCalendar.events.kok-boru-federation',
    // horse-kok-boru.history: "2001-жылы 9-ноябрда Бишкекте Көк бөрү эл аралык федерациясы түзүлгөн."
    description: { itemId: 'horse-kok-boru', field: 'history' },
    dateRule: { type: 'explicit_year_date', year: 2001, month: 11, day: 9 },
    cultureItemIds: ['horse-kok-boru'],
    sourceItemId: 'horse-kok-boru',
    related: { glossaryIds: ['kok-boru'], pathIds: ['horse-games'], compareIds: ['kok-boru-kyz-kuumai'] },
  },
];

export type Occurrence = { start: Date; end: Date };

const day = (year: number, month: number, date: number) => new Date(year, month - 1, date);
const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

/**
 * The occurrence in `year` (local calendar), or null when there is none
 * that can be stated honestly (unconfirmed, before it began, or an
 * invalid date like 30 Feb).
 */
export function occurrenceInYear(rule: DateRule | null, year: number): Occurrence | null {
  if (!rule) return null;
  const valid = (d: Date, month: number, date: number) => d.getMonth() === month - 1 && d.getDate() === date;
  if (rule.type === 'fixed_date') {
    if (rule.sinceYear && year < rule.sinceYear) return null;
    const date = day(year, rule.month, rule.day);
    return valid(date, rule.month, rule.day) ? { start: date, end: date } : null;
  }
  if (rule.type === 'explicit_year_date') {
    // An anniversary of a dated historical event - shown from that year on.
    if (year < rule.year) return null;
    const date = day(year, rule.month, rule.day);
    return valid(date, rule.month, rule.day) ? { start: date, end: date } : null;
  }
  const start = day(year, rule.start.month, rule.start.day);
  // A range may cross the year end (e.g. 28 Dec - 3 Jan).
  const crossesYear = rule.end.month < rule.start.month || (rule.end.month === rule.start.month && rule.end.day < rule.start.day);
  const end = day(crossesYear ? year + 1 : year, rule.end.month, rule.end.day);
  if (!valid(start, rule.start.month, rule.start.day)) return null;
  return { start, end };
}

/** The current or next occurrence on/after `now` (looks at this and next year). */
export function nextOccurrence(rule: DateRule | null, now: Date): Occurrence | null {
  const today = startOfDay(now);
  for (const year of [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1]) {
    const occurrence = occurrenceInYear(rule, year);
    if (occurrence && occurrence.end.getTime() >= today.getTime()) return occurrence;
  }
  return null;
}

export function isToday(occurrence: Occurrence | null, now: Date): boolean {
  if (!occurrence) return false;
  const today = startOfDay(now).getTime();
  return occurrence.start.getTime() <= today && occurrence.end.getTime() >= today;
}

export type DatedEvent = { event: CulturalCalendarEvent; occurrence: Occurrence | null };

/** Every event with its next occurrence; dated ones by date, undated last (stable by id). */
export function calendarList(events: readonly CulturalCalendarEvent[], now: Date): DatedEvent[] {
  const seen = new Set<string>();
  return events
    .filter((event) => (seen.has(event.id) ? false : (seen.add(event.id), true)))
    .map((event) => ({ event, occurrence: nextOccurrence(event.dateRule, now) }))
    .sort((a, b) => {
      if (a.occurrence && b.occurrence) return a.occurrence.start.getTime() - b.occurrence.start.getTime() || a.event.id.localeCompare(b.event.id);
      if (a.occurrence) return -1;
      if (b.occurrence) return 1;
      return a.event.id.localeCompare(b.event.id);
    });
}

export function todayEvents(list: readonly DatedEvent[], now: Date): DatedEvent[] {
  return list.filter((entry) => isToday(entry.occurrence, now));
}

/** Overlaps the current local month. */
export function thisMonth(list: readonly DatedEvent[], now: Date): DatedEvent[] {
  const first = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0).getTime();
  return list.filter((entry) => entry.occurrence && entry.occurrence.start.getTime() <= last && entry.occurrence.end.getTime() >= first);
}

/** Starting after today, within `days` (default ~6 months). */
export function upcoming(list: readonly DatedEvent[], now: Date, days = 183): DatedEvent[] {
  const today = startOfDay(now).getTime();
  const until = today + days * 24 * 60 * 60 * 1000;
  return list.filter((entry) => entry.occurrence && entry.occurrence.start.getTime() > today && entry.occurrence.start.getTime() <= until);
}

/** Home shows a small card only on the day or within 3 days before it. */
export const HOME_WINDOW_DAYS = 3;
export function homeEvent(list: readonly DatedEvent[], now: Date): DatedEvent | null {
  const today = startOfDay(now).getTime();
  return (
    list.find((entry) => entry.occurrence && entry.occurrence.end.getTime() >= today && entry.occurrence.start.getTime() - today <= HOME_WINDOW_DAYS * 24 * 60 * 60 * 1000) ?? null
  );
}

/** A dated entry is only valid with an authored source item that has sources. */
export function validateCalendar(events: readonly CulturalCalendarEvent[], items: readonly { id: string; sources: string[] | null; [field: string]: unknown }[]): string[] {
  const problems: string[] = [];
  const ids = new Set<string>();
  for (const event of events) {
    if (ids.has(event.id)) problems.push(`${event.id}: duplicate`);
    ids.add(event.id);
    const source = items.find((item) => item.id === event.sourceItemId);
    if (!source) problems.push(`${event.id}: source item missing`);
    else {
      if (event.dateRule && (!source.sources || source.sources.length === 0)) problems.push(`${event.id}: dated claim without sources`);
      const text = source[event.description.field];
      if (typeof text !== 'string' || !text.trim()) problems.push(`${event.id}: no authored description`);
    }
  }
  return problems;
}
