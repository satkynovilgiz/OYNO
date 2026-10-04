/**
 * My Study Queue - ONE private list over learning that is already
 * unfinished in the EXISTING systems. It stores nothing and copies no
 * question, definition or article: every item is a reference + a route,
 * recomputed from the current owner's stores on every render. When a
 * mistake is corrected (mistake queue) or a term gets "Got it" (glossary
 * study), the source changes and the item simply disappears.
 *
 * Priority (deterministic; inside a source its own ordering is reused):
 *   1. challenge mistakes    - reviewQueue() order
 *   2. glossary review terms - glossary reviewQueue() order
 *   3. unfinished Learning Paths - pathProgress() first unfinished step
 *   4. unfinished reading    - recentlyRead() order (newest first)
 */

export type StudyItemType = 'mistakes' | 'glossary' | 'path' | 'reading';
export type StudyFilter = 'all' | 'review' | 'reading' | 'paths';

export type StudyQueueItem = {
  type: StudyItemType;
  /** Reference id: 'mistakes' / 'glossary' (one card per review source), a path id or a reading key. */
  id: string;
  priority: 1 | 2 | 3 | 4;
  route: string;
  /** Count for review cards (questions / terms waiting). */
  count: number | null;
};

export type StudyQueueInput = {
  /** questionIds in the mistake queue's own order. */
  mistakeIds: readonly string[];
  /** glossary entry ids in the glossary review queue's own order. */
  glossaryIds: readonly string[];
  /** Started, unfinished paths with their next step route (from pathProgress). */
  activePaths: readonly { id: string; nextStepRoute: string | null; nextIndex?: number | null }[];
  /** Unfinished readings, newest first (from recentlyRead / continue reading). */
  unfinishedReading: readonly { key: string; route: string }[];
};

export const MISTAKES_ROUTE = '/challenges/review';
export const GLOSSARY_REVIEW_ROUTE = '/culture/glossary/study?mode=review';
export const QUICK_REVIEW_ROUTE = '/study/quick';
export const QUICK_REVIEW_PER_SOURCE = 3;

export function buildStudyQueue(input: StudyQueueInput, limits: { paths: number; reading: number }): StudyQueueItem[] {
  const items: StudyQueueItem[] = [];
  if (input.mistakeIds.length > 0) items.push({ type: 'mistakes', id: 'mistakes', priority: 1, route: MISTAKES_ROUTE, count: input.mistakeIds.length });
  if (input.glossaryIds.length > 0) items.push({ type: 'glossary', id: 'glossary', priority: 2, route: GLOSSARY_REVIEW_ROUTE, count: input.glossaryIds.length });
  for (const path of input.activePaths.slice(0, limits.paths)) items.push({ type: 'path', id: path.id, priority: 3, route: `/learn/${path.id}`, count: null });
  for (const reading of input.unfinishedReading.slice(0, limits.reading)) items.push({ type: 'reading', id: reading.key, priority: 4, route: reading.route, count: null });
  return items;
}

export function filterQueue(items: readonly StudyQueueItem[], filter: StudyFilter): StudyQueueItem[] {
  if (filter === 'all') return [...items];
  if (filter === 'review') return items.filter((item) => item.type === 'mistakes' || item.type === 'glossary');
  if (filter === 'reading') return items.filter((item) => item.type === 'reading');
  return items.filter((item) => item.type === 'path');
}

/** Quick review: up to 3 mistakes, then up to 3 glossary cards - ids
 * only, in each source's own order. Articles are never part of it. */
export function quickReviewPlan(input: Pick<StudyQueueInput, 'mistakeIds' | 'glossaryIds'>): { mistakeIds: string[]; glossaryIds: string[] } {
  return { mistakeIds: input.mistakeIds.slice(0, QUICK_REVIEW_PER_SOURCE), glossaryIds: input.glossaryIds.slice(0, QUICK_REVIEW_PER_SOURCE) };
}

export type AgeGroup = 'child' | 'preteen' | 'teen' | 'adult';

/** Same items for everyone; only how many and how they are drawn differ. */
export function studyPresentation(age: AgeGroup): { paths: number; reading: number; largeActions: boolean; compact: boolean; reviewFirstEmphasis: boolean } {
  switch (age) {
    case 'child':
      return { paths: 1, reading: 1, largeActions: true, compact: false, reviewFirstEmphasis: false };
    case 'preteen':
      return { paths: 1, reading: 2, largeActions: true, compact: false, reviewFirstEmphasis: true };
    case 'adult':
      return { paths: 3, reading: 5, largeActions: false, compact: true, reviewFirstEmphasis: false };
    default:
      return { paths: 2, reading: 3, largeActions: false, compact: false, reviewFirstEmphasis: false };
  }
}
