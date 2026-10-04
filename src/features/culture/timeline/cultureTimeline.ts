import { foldSearchText } from '@/services/search/globalSearch';

/**
 * Kyrgyz Culture Historical Timeline - CURATED and bundled. Every event is a
 * date that an AUTHORED, sourced OYNO culture item field already states;
 * the excerpt shown is that field's own sentence (never new prose), and the
 * item's verification + sources travel with it. Precision is only what the
 * text states: an exact day, a single year, or an explicit year range - no
 * centuries, "about N years ago", decades or inferred days.
 *
 * Content audit 2026-10-03 (all 230 culture items, every text field).
 */

export type DatePrecision = 'exact_date' | 'year' | 'year_range';
export type TimelineField = 'history' | 'modern_status' | 'origin' | 'when_used' | 'cultural_meaning';

export type CultureTimelineEvent = {
  id: string;
  datePrecision: DatePrecision;
  /** Sort year (= startYear for ranges). */
  year: number;
  startYear?: number;
  endYear?: number;
  /** 'YYYY-MM-DD' for exact dates. */
  exactDate?: string;
  /** i18n key that formats the date at the right precision. */
  displayDateKey: string;
  /** The article the event opens. */
  contentItemId: string;
  /** Authored field on contentItemId that states the date. */
  sourceField: TimelineField;
  /** Items whose `sources` back the claim (shown via Source Explorer). */
  sourceIds: string[];
  titleKey: string;
};

const event = (e: Omit<CultureTimelineEvent, 'titleKey' | 'displayDateKey'>): CultureTimelineEvent => ({
  ...e,
  titleKey: `cultureTimeline.events.${e.id}`,
  displayDateKey: `cultureTimeline.date.${e.datePrecision}`,
});

export const CULTURE_TIMELINE: readonly CultureTimelineEvent[] = [
  // horse-jorgo-salysh.history: "1971-жылдан тартып ... жорго салыш расмий улуттук спорт түрү катары бекитилген."
  event({ id: 'jorgo-salysh-official-sport', datePrecision: 'year', year: 1971, contentItemId: 'horse-jorgo-salysh', sourceField: 'history', sourceIds: ['horse-jorgo-salysh'] }),
  // horse-tyiyn-enmei.history: "1993-жылкы бирдиктүү классификацияда улуттук спорт түрү катары бекитилген."
  event({ id: 'tyiyn-enmei-classification', datePrecision: 'year', year: 1993, contentItemId: 'horse-tyiyn-enmei', sourceField: 'history', sourceIds: ['horse-tyiyn-enmei'] }),
  // horse-kok-boru.history: "Азыркы бирдиктүү эрежелери 1996-жылы ... Болот Шамшиев тарабынан иштелип чыккан."
  event({ id: 'kok-boru-unified-rules', datePrecision: 'year', year: 1996, contentItemId: 'horse-kok-boru', sourceField: 'history', sourceIds: ['horse-kok-boru'] }),
  // horse-kok-boru.history: "2001-жылы 9-ноябрда Бишкекте Көк бөрү эл аралык федерациясы түзүлгөн."
  event({ id: 'kok-boru-federation', datePrecision: 'exact_date', year: 2001, exactDate: '2001-11-09', contentItemId: 'horse-kok-boru', sourceField: 'history', sourceIds: ['horse-kok-boru'] }),
  // shyrdak-craft.history: "2012-жылы ... шырдак жана ала кийиз тигүү өнөрү ЮНЕСКОнун ... тизмесине кирген."
  event({ id: 'shyrdak-ala-kiyiz-unesco', datePrecision: 'year', year: 2012, contentItemId: 'shyrdak-craft', sourceField: 'history', sourceIds: ['shyrdak-craft', 'shyrdak-ala-kiyiz'] }),
  // horse-kok-boru.history: "2017-жылы декабрда ЮНЕСКОнун ... тизмесине кирген." (month only -> shown as a year)
  event({ id: 'kok-boru-unesco', datePrecision: 'year', year: 2017, contentItemId: 'horse-kok-boru', sourceField: 'history', sourceIds: ['horse-kok-boru'] }),
  // clothing-ak-kalpak.modern_status: "2019-жылдан тартып 5-март «Дүйнөлүк калпак күнү» катары белгиленет."
  event({ id: 'world-kalpak-day-since', datePrecision: 'year', year: 2019, contentItemId: 'clothing-ak-kalpak', sourceField: 'modern_status', sourceIds: ['clothing-ak-kalpak'] }),
];

/**
 * Candidates found in the audit and deliberately NOT on the timeline
 * (documentation for content editors; tests keep them out).
 */
export const EXCLUDED_CANDIDATES: readonly { itemId: string; field: TimelineField | 'traditional_method'; reason: string }[] = [
  { itemId: 'komuz-overview', field: 'history', reason: 'century only ("XI кылымда") - not year precision' },
  { itemId: 'horse-jylky', field: 'history', reason: 'century ("XIX кылымдын аягында") and open decade ("1930-жылдардан тартып")' },
  { itemId: 'horse-eer', field: 'history', reason: 'century only (XIX кылым)' },
  { itemId: 'clothing-beshmant', field: 'history', reason: 'century only ("19-кылымдан тартып")' },
  { itemId: 'horse-overview', field: 'history', reason: '"about four thousand years ago" - approximate, attributed ("деп эсептелет")' },
  { itemId: 'boz-uy-overview', field: 'history', reason: '"кылымдар бою" - no date' },
  { itemId: 'horse-kok-boru', field: 'modern_status', reason: 'list of competition results (2014-2024), not one historical event' },
  { itemId: 'shyrdak-ala-kiyiz', field: 'modern_status', reason: 'same 2012 UNESCO event - merged as a second source' },
  { itemId: 'shyrdak-at-bashy', field: 'history', reason: 'same 2012 UNESCO event, single source - not duplicated' },
  { itemId: 'horse-at-chabysh', field: 'traditional_method', reason: '"1200 метр" is a distance, not a year' },
];

/** The authored sentence that states the year (verbatim), or null. */
export function excerptFor(text: string | null | undefined, year: number): string | null {
  if (!text) return null;
  const sentences = text.split(/(?<=[.!?])\s+/);
  return sentences.find((sentence) => sentence.includes(String(year)))?.trim() ?? null;
}

type ItemLike = { id: string; sources: string[] | null; [field: string]: unknown };

/** Problems that keep an event off the timeline (shown nowhere if any). */
export function validateTimeline(events: readonly CultureTimelineEvent[], items: readonly ItemLike[]): string[] {
  const problems: string[] = [];
  const ids = new Set<string>();
  for (const e of events) {
    if (ids.has(e.id)) problems.push(`${e.id}: duplicate`);
    ids.add(e.id);
    if (!['exact_date', 'year', 'year_range'].includes(e.datePrecision)) problems.push(`${e.id}: unsupported precision`);
    if (e.datePrecision === 'exact_date' && (!e.exactDate || !e.exactDate.startsWith(`${e.year}-`) || Number.isNaN(Date.parse(e.exactDate)))) problems.push(`${e.id}: bad exact date`);
    if (e.datePrecision === 'year_range' && !(e.startYear && e.endYear && e.startYear === e.year && e.endYear > e.startYear)) problems.push(`${e.id}: bad range`);
    if (e.datePrecision !== 'year_range' && (e.startYear || e.endYear)) problems.push(`${e.id}: range fields on a non-range`);
    const item = items.find((candidate) => candidate.id === e.contentItemId);
    if (!item) {
      problems.push(`${e.id}: item missing`);
      continue;
    }
    const text = item[e.sourceField];
    if (typeof text !== 'string' || !excerptFor(text, e.year)) problems.push(`${e.id}: year not stated in ${e.sourceField}`);
    if (e.datePrecision === 'year_range' && typeof text === 'string' && !text.includes(String(e.endYear))) problems.push(`${e.id}: end year not stated`);
    if (e.sourceIds.length === 0) problems.push(`${e.id}: no source ids`);
    for (const sourceId of e.sourceIds) {
      const source = items.find((candidate) => candidate.id === sourceId);
      if (!source || !source.sources || source.sources.length === 0) problems.push(`${e.id}: ${sourceId} has no sources`);
    }
  }
  return problems;
}

/** Events that pass validation against the loaded items. */
export function validEvents(events: readonly CultureTimelineEvent[], items: readonly ItemLike[]): CultureTimelineEvent[] {
  return events.filter((e) => validateTimeline([e], items).length === 0);
}

export type TimelineSort = 'oldest' | 'newest';

export function sortTimeline(events: readonly CultureTimelineEvent[], order: TimelineSort): CultureTimelineEvent[] {
  const key = (e: CultureTimelineEvent) => (e.exactDate ? Date.parse(e.exactDate) : Date.UTC(e.year, 0, 1));
  const sorted = [...events].sort((a, b) => key(a) - key(b) || a.id.localeCompare(b.id));
  return order === 'oldest' ? sorted : sorted.reverse();
}

/** Local search over title, excerpt and year (same fold as global search). */
export function filterTimeline<T extends { title: string; excerpt: string | null; event: CultureTimelineEvent }>(rows: readonly T[], query: string): T[] {
  const q = foldSearchText(query.trim()).replace(/\s+/g, ' ');
  if (!q) return [...rows];
  return rows.filter((row) => foldSearchText(`${row.title} ${row.excerpt ?? ''} ${row.event.year}`).includes(q));
}

export const CULTURE_TIMELINE_ROUTE = '/culture/timeline';
