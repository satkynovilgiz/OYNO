import type { Moment } from '@/features/culture/komuz/listening/notebookModel';
import type { SectionBookmark } from '@/features/culture/reading/sectionBookmarks';
import type { ItemKind } from '@/features/nextVisit/nextVisitModel';
import type { Question } from '@/features/questions/questionsModel';
import type { Scrapbook } from '@/features/scrapbook/scrapbookModel';
import type { OymoCreationRow } from '@/services/content/oymoCreationsService';

/**
 * Discovery Recap - a PRIVATE look back over things the person explicitly
 * saved, read straight from the existing records (nothing copied, nothing
 * sent anywhere, no analytics). Each record type uses the timestamp it
 * actually stores for the save:
 *   reading notes (section bookmarks)  createdAt
 *   questions                          createdAt
 *   listening moments                  createdAt
 *   Oymo designs (account)             created_at
 *   scrapbooks                         createdAt
 * Time capsules are NOT included (sealed messages stay sealed). Saving or
 * opening something is never presented as learning or mastery; there are
 * no counts-as-scores, streaks or rankings.
 */
export type RecapType = 'note' | 'question' | 'moment' | 'design' | 'scrapbook';
export const RECAP_TYPES: RecapType[] = ['note', 'question', 'moment', 'design', 'scrapbook'];
export type PlanTarget = { kind: ItemKind; id: string; title: string } | null;
export type RecapItem = {
  key: string;
  type: RecapType;
  at: string;
  /** The saved title snapshot (or the record's own title). */
  title: string;
  /** The person's own words, when the record has them. */
  personal: string | null;
  route: string | null;
  /** What it can be added to My Next Visit as (articles / activities only). */
  plan: PlanTarget;
};

const valid = (iso: string | null | undefined): iso is string => typeof iso === 'string' && !Number.isNaN(Date.parse(iso));

export function noteItems(bookmarks: readonly SectionBookmark[]): RecapItem[] {
  return bookmarks.filter((b) => valid(b.createdAt)).map((b) => ({
    key: `note:${b.contentType}:${b.contentId}#${b.sectionKey}`,
    type: 'note',
    at: b.createdAt,
    title: `${b.articleTitle} - ${b.sectionLabel}`,
    personal: b.note.trim() || null,
    route: b.contentType === 'culture_item' ? `/culture/item/${encodeURIComponent(b.contentId)}?section=${encodeURIComponent(b.sectionKey)}` : null,
    plan: b.contentType === 'culture_item' ? { kind: 'article', id: b.contentId, title: b.articleTitle } : null,
  }));
}
export function questionItems(questions: readonly Question[]): RecapItem[] {
  return questions.filter((q) => valid(q.createdAt)).map((q) => ({ key: `question:${q.id}`, type: 'question', at: q.createdAt, title: q.origin ? `${q.origin.articleTitle} - ${q.origin.sectionLabel}` : '', personal: q.text, route: `/profile/questions/${encodeURIComponent(q.id)}`, plan: q.origin ? { kind: 'article', id: q.origin.articleId, title: q.origin.articleTitle } : null }));
}
export function momentItems(moments: readonly Moment[]): RecapItem[] {
  // A moment revisits the Listening Room (an existing activity) - not the exact second.
  return moments.filter((m) => valid(m.createdAt)).map((m) => ({ key: `moment:${m.id}`, type: 'moment', at: m.createdAt, title: m.titleSnapshot, personal: m.note.trim() || null, route: `/culture/komuz/listen?resumeTrack=${encodeURIComponent(m.trackId)}&at=${Math.floor(m.seconds)}`, plan: { kind: 'activity', id: 'komuzListen', title: m.titleSnapshot } }));
}
export function designItems(rows: readonly OymoCreationRow[]): RecapItem[] {
  return rows.filter((r) => valid(r.created_at)).map((r) => ({ key: `design:${r.id}`, type: 'design', at: r.created_at, title: r.name?.trim() || '', personal: null, route: `/culture/oymo/create?creation=${encodeURIComponent(r.id)}`, plan: null }));
}
export function scrapbookItems(books: readonly Scrapbook[]): RecapItem[] {
  return books.filter((b) => valid(b.createdAt)).map((b) => ({ key: `scrapbook:${b.id}`, type: 'scrapbook', at: b.createdAt, title: b.title, personal: null, route: `/profile/scrapbooks/${encodeURIComponent(b.id)}`, plan: null }));
}

/* ---------- date range (device local time) ---------- */

/** Offset in minutes as Date#getTimezoneOffset reports it (UTC - local). Injectable for tests. */
export type OffsetAt = (utcMs: number) => number;
export const deviceOffset: OffsetAt = (ms) => new Date(ms).getTimezoneOffset();

/** UTC ms of local midnight on YYYY-MM-DD (DST-safe: the offset is taken AT that local time). */
export function localMidnight(day: string, offsetAt: OffsetAt = deviceOffset): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!m) return null;
  const utcGuess = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (Number.isNaN(utcGuess) || new Date(utcGuess).getUTCDate() !== Number(m[3])) return null;
  const first = utcGuess + offsetAt(utcGuess) * 60_000;
  return utcGuess + offsetAt(first) * 60_000;
}

/** [from 00:00, to+1 00:00) in device local time, both days inclusive. */
export function rangeBounds(from: string, to: string, offsetAt: OffsetAt = deviceOffset): { start: number; end: number } | null {
  const start = localMidnight(from, offsetAt);
  const toStart = localMidnight(to, offsetAt);
  if (start === null || toStart === null || toStart < start) return null;
  const next = new Date(Date.UTC(Number(to.slice(0, 4)), Number(to.slice(5, 7)) - 1, Number(to.slice(8, 10)) + 1));
  const end = localMidnight(next.toISOString().slice(0, 10), offsetAt);
  return end === null ? null : { start, end };
}

/** YYYY-MM-DD of `ms` in device local time. */
export function localDay(ms: number, offsetAt: OffsetAt = deviceOffset): string {
  return new Date(ms - offsetAt(ms) * 60_000).toISOString().slice(0, 10);
}

export type Preset = 'last7' | 'last30' | 'thisMonth' | 'custom';
export function presetRange(preset: Exclude<Preset, 'custom'>, nowMs: number, offsetAt: OffsetAt = deviceOffset): { from: string; to: string } {
  const today = localDay(nowMs, offsetAt);
  const shift = (days: number) => new Date(Date.UTC(Number(today.slice(0, 4)), Number(today.slice(5, 7)) - 1, Number(today.slice(8, 10)) - days)).toISOString().slice(0, 10);
  if (preset === 'last7') return { from: shift(6), to: today };
  if (preset === 'last30') return { from: shift(29), to: today };
  return { from: `${today.slice(0, 8)}01`, to: today };
}

export function inRange(items: readonly RecapItem[], bounds: { start: number; end: number }): RecapItem[] {
  return items
    .filter((item) => {
      const t = Date.parse(item.at);
      return t >= bounds.start && t < bounds.end;
    })
    .sort((a, b) => b.at.localeCompare(a.at));
}

/** Private search: titles and the person's own words only. */
export function search(items: readonly RecapItem[], query: string): RecapItem[] {
  const q = query.trim().toLocaleLowerCase();
  if (!q) return [...items];
  return items.filter((item) => `${item.title}\n${item.personal ?? ''}`.toLocaleLowerCase().includes(q));
}

export const groupByType = (items: readonly RecapItem[]) => RECAP_TYPES.map((type) => ({ type, items: items.filter((item) => item.type === type) }));

/** Distinct plan targets of the selected items (one per article / activity). */
export function planTargets(items: readonly RecapItem[], selected: readonly string[]): { supported: NonNullable<PlanTarget>[]; unsupported: number } {
  const chosen = items.filter((item) => selected.includes(item.key));
  const seen = new Set<string>();
  const supported: NonNullable<PlanTarget>[] = [];
  for (const item of chosen) {
    if (!item.plan) continue;
    const k = `${item.plan.kind}:${item.plan.id}`;
    if (!seen.has(k)) {
      seen.add(k);
      supported.push(item.plan);
    }
  }
  return { supported, unsupported: chosen.filter((item) => !item.plan).length };
}
