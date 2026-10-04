/**
 * Continue Reading + Reading History - pure rules. Private reading state
 * for long-form Culture content only (culture_item, culture_material).
 * Only references and RATIOS are kept - never article text, never pixel
 * offsets (a language change or a different screen relays the text).
 */

export type ReadingContentType = 'culture_item' | 'culture_material';

export type ReadingProgress = {
  contentType: ReadingContentType;
  contentId: string;
  /** Where the reader is now, 0..1 of the scrollable range (resume point). */
  progress: number;
  /** The furthest point reached, 0..1 (what "62% read" shows). */
  furthest: number;
  lastReadAt: string;
  completedAt: string | null;
  /** The authored section last read by scrolling (Reader Navigator). A
   * section KEY only - never text or pixels; ignored when the article no
   * longer has that section. Optional: older records don't carry it. */
  lastSectionKey?: string | null;
};

export type ReadingData = Record<string, ReadingProgress>;

/** Below this nothing is saved (an accidental open or a nudge). */
export const MIN_MEANINGFUL_PROGRESS = 0.05;
/** At or past this the article counts as read - no need for exactly 100%. */
export const COMPLETION_THRESHOLD = 0.9;
export const RECENT_LIMIT = 8;

export function readingKey(contentType: ReadingContentType, contentId: string): string {
  return `${contentType}:${contentId}`;
}

/**
 * Real measurement only: how far through the SCROLLABLE range the reader
 * is. Null when the article can't scroll (fits on screen) - opening it is
 * not reading it, so nothing is inferred (Mark as read covers that case).
 */
export function scrollRatio(offsetY: number, contentHeight: number, viewportHeight: number): number | null {
  const range = contentHeight - viewportHeight;
  if (!(range > 1) || !Number.isFinite(offsetY)) return null;
  return Math.min(1, Math.max(0, offsetY / range));
}

/** Resume: the saved RATIO mapped onto the CURRENT layout (never a stale
 * pixel offset). Null until the layout is measurable. */
export function resumeOffset(ratio: number, contentHeight: number, viewportHeight: number): number | null {
  const range = contentHeight - viewportHeight;
  if (!(range > 1)) return null;
  return Math.round(Math.min(1, Math.max(0, ratio)) * range);
}

/** One measured position. Tiny positions never create a record; a
 * completed article stays completed (re-reading it doesn't undo that). */
export function recordPosition(data: ReadingData, contentType: ReadingContentType, contentId: string, ratio: number, now = new Date()): ReadingData {
  const key = readingKey(contentType, contentId);
  const existing = data[key];
  if (ratio < MIN_MEANINGFUL_PROGRESS && !existing) return data;
  const at = now.toISOString();
  const furthest = Math.max(existing?.furthest ?? 0, ratio);
  const next: ReadingProgress = {
    contentType,
    contentId,
    progress: ratio,
    furthest,
    lastReadAt: at,
    completedAt: existing?.completedAt ?? (ratio >= COMPLETION_THRESHOLD ? at : null),
    ...(existing?.lastSectionKey ? { lastSectionKey: existing.lastSectionKey } : {}),
  };
  if (existing && existing.progress === next.progress && existing.furthest === next.furthest && existing.completedAt === next.completedAt) return data;
  return { ...data, [key]: next };
}

/**
 * Remember the section being read. Only updates an EXISTING record (a
 * section alone never creates reading history) and never touches
 * progress, furthest or completion - a Table of Contents jump can't make
 * an article "read".
 */
export function recordSection(data: ReadingData, contentType: ReadingContentType, contentId: string, sectionKey: string | null): ReadingData {
  const key = readingKey(contentType, contentId);
  const existing = data[key];
  if (!existing || (existing.lastSectionKey ?? null) === sectionKey) return data;
  if (sectionKey !== null && !/^[a-z][a-z0-9_]{0,59}$/.test(sectionKey)) return data;
  return { ...data, [key]: { ...existing, lastSectionKey: sectionKey } };
}

/** Explicit "Mark as read". */
export function markRead(data: ReadingData, contentType: ReadingContentType, contentId: string, now = new Date()): ReadingData {
  const key = readingKey(contentType, contentId);
  const at = now.toISOString();
  const existing = data[key];
  return { ...data, [key]: { contentType, contentId, progress: existing?.progress ?? 0, furthest: Math.max(existing?.furthest ?? 0, COMPLETION_THRESHOLD), lastReadAt: at, completedAt: existing?.completedAt ?? at } };
}

/** "Start over": clears this article's progress/completion only. */
export function resetReading(data: ReadingData, contentType: ReadingContentType, contentId: string): ReadingData {
  const key = readingKey(contentType, contentId);
  if (!data[key]) return data;
  const next = { ...data };
  delete next[key];
  return next;
}

/** Should opening this article offer "Continue where you left off?" -
 * only for an unfinished, meaningfully started article. A completed one
 * simply opens at the top. */
export function shouldOfferResume(record: ReadingProgress | undefined): boolean {
  return !!record && !record.completedAt && record.progress >= MIN_MEANINGFUL_PROGRESS;
}

/** Newest first; ties by key (deterministic). Stale references (content
 * that no longer exists) are skipped. */
export function recentlyRead(data: ReadingData, exists: (record: ReadingProgress) => boolean, limit = RECENT_LIMIT): ReadingProgress[] {
  return Object.values(data)
    .filter(exists)
    .sort((a, b) => b.lastReadAt.localeCompare(a.lastReadAt) || readingKey(a.contentType, a.contentId).localeCompare(readingKey(b.contentType, b.contentId)))
    .slice(0, limit);
}

/** The ONE item for the Continue reading card: most recent unfinished. */
export function continueReading(data: ReadingData, exists: (record: ReadingProgress) => boolean): ReadingProgress | null {
  return recentlyRead(data, exists, Number.MAX_SAFE_INTEGER).find((record) => !record.completedAt) ?? null;
}

/** "62%" - from the furthest point; completed shows as Completed. */
export function percentRead(record: ReadingProgress): number {
  return Math.round(Math.min(1, record.furthest) * 100);
}

/** Guest -> account: per article, furthest progress, newest lastReadAt
 * (and its resume point), completed wins. */
export function mergeReading(into: ReadingData, from: ReadingData): ReadingData {
  const merged: ReadingData = { ...into };
  for (const [key, record] of Object.entries(from)) {
    const existing = merged[key];
    if (!existing) {
      merged[key] = record;
      continue;
    }
    const newer = record.lastReadAt > existing.lastReadAt ? record : existing;
    const completions = [existing.completedAt, record.completedAt].filter((value): value is string => !!value).sort();
    merged[key] = { ...newer, furthest: Math.max(existing.furthest, record.furthest), completedAt: completions[0] ?? null };
  }
  return merged;
}
