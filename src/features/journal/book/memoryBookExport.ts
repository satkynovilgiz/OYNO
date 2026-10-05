import { track } from '@/services/analytics/analytics';
import { captureAccountGeneration, isAccountGenerationCurrent, type AccountGenerationToken } from '@/services/sync/accountGeneration';
import { currentPhotoOwner } from '@/store/useJournalStore';

import type { JournalEntry } from '../journalModel';
import { bookAnalytics, bookFreshness, entryVersion, photoCacheKey, type BookLayout, type BookPage } from './memoryBookModel';
import { ExportCancelledError, generateAndShareBook, photoDataUri, type ExportSession } from './memoryBookService';

export type ExportOutcome =
  | { status: 'shared'; missingPhotos: number }
  | { status: 'cancelled' }
  | { status: 'failed' }
  /** Memories were edited or deleted after preparation: review again (nothing shared). */
  | { status: 'stale'; reason: 'changed' | 'deleted' };

/**
 * Prepared photo data for ONE account session, keyed by entry AND photo
 * identity (photoCacheKey) - a replaced photo can never reuse the old
 * image. Lets "try again" after a missing photo fetch only what is still
 * missing. In memory only; any session change makes it unusable.
 */
export type PhotoCache = { token: AccountGenerationToken; images: Map<string, string> };

/** Drop cached images of an entry that no longer match its current photo (replaced or removed). */
export function prunePhotoCache(cache: PhotoCache, entries: readonly JournalEntry[]): void {
  const current = new Set(entries.map(photoCacheKey).filter((key): key is string => !!key));
  const ids = new Set(entries.map((entry) => entry.id));
  for (const key of [...cache.images.keys()]) {
    const id = key.slice(0, key.indexOf('|'));
    if (ids.has(id) && !current.has(key)) cache.images.delete(key);
  }
}

export function createPhotoCache(): PhotoCache {
  return { token: captureAccountGeneration(), images: new Map() };
}

export function photoCacheValid(cache: PhotoCache): boolean {
  return isAccountGenerationCurrent(cache.token);
}

/** A book ready to share: pages in final order + what could not be included. */
export type PreparedBook = {
  token: AccountGenerationToken;
  entries: readonly JournalEntry[];
  pages: BookPage[];
  /** Entries whose photo could not be obtained (shown BEFORE sharing). */
  missingPhotoIds: string[];
  /** entry id -> entryVersion at preparation: sharing refuses if any changed. */
  sourceVersions: Record<string, string>;
  includeText: boolean;
  layout: BookLayout;
};

export type PrepareOutcome = { status: 'ready'; book: PreparedBook } | { status: 'cancelled' };

/**
 * Step 1 - gather everything the PDF needs, bound to the account session
 * that started it. Photos already in `cache` (same session) are reused;
 * only the rest are read / downloaded. A session change at any point
 * returns 'cancelled' and nothing is kept.
 */
export async function prepareMemoryBook(input: { entries: readonly JournalEntry[]; includeText: boolean; layout: BookLayout; formatDate: (date: string) => string; cache?: PhotoCache }): Promise<PrepareOutcome> {
  const token = captureAccountGeneration();
  const session: ExportSession = { isValid: () => isAccountGenerationCurrent(token) };
  const cache = input.cache && photoCacheValid(input.cache) && input.cache.token.generation === token.generation ? input.cache : null;
  const photoOwner = currentPhotoOwner();
  const isOwnerCurrent = (owner: string) => currentPhotoOwner() === owner;

  if (cache) prunePhotoCache(cache, input.entries);
  const pages: BookPage[] = [];
  const missingPhotoIds: string[] = [];
  const sourceVersions: Record<string, string> = {};
  for (const entry of input.entries) {
    sourceVersions[entry.id] = entryVersion(entry);
    let image: string | null = null;
    const key = photoCacheKey(entry);
    if (entry.photo && key) {
      image = cache?.images.get(key) ?? (await photoDataUri(entry, photoOwner, token.userId !== null, session, isOwnerCurrent));
      if (!session.isValid()) return { status: 'cancelled' };
      if (image) cache?.images.set(key, image);
      else missingPhotoIds.push(entry.id);
    }
    pages.push({ title: entry.title, dateLabel: input.formatDate(entry.date), note: input.includeText && entry.note.trim() ? entry.note : null, image });
  }
  if (!session.isValid()) return { status: 'cancelled' };
  return { status: 'ready', book: { token, entries: input.entries, pages, missingPhotoIds, sourceVersions, includeText: input.includeText, layout: input.layout } };
}

/**
 * Step 2 - render and share a prepared book. Refuses a book prepared in
 * another session. generateAndShareBook re-checks the session after
 * printing and right before the share sheet; a stale session is a silent
 * 'cancelled' (temporary PDFs removed, no analytics).
 */
export async function shareMemoryBook(book: PreparedBook, buildHtml: (pages: BookPage[]) => string, today: string, currentEntries?: () => readonly JournalEntry[]): Promise<ExportOutcome> {
  const freshness = () => (currentEntries ? bookFreshness(book.sourceVersions, currentEntries()) : ({ status: 'fresh' } as const));
  // Valid only while the SAME session is active AND the memories are still
  // exactly what was prepared and reviewed - re-checked after printing and
  // right before the share sheet (generateAndShareBook).
  const session: ExportSession = { isValid: () => isAccountGenerationCurrent(book.token) && freshness().status === 'fresh' };
  if (!isAccountGenerationCurrent(book.token)) return { status: 'cancelled' };
  const before = freshness();
  if (before.status !== 'fresh') return { status: 'stale', reason: before.status };
  try {
    await generateAndShareBook(buildHtml(book.pages), today, session);
  } catch (error) {
    if (!(error instanceof ExportCancelledError)) return { status: 'failed' };
    const after = freshness();
    return isAccountGenerationCurrent(book.token) && after.status !== 'fresh' ? { status: 'stale', reason: after.status } : { status: 'cancelled' };
  }
  // The sheet closed (shared or dismissed). If the session changed while it
  // was open, the file was already handed to the OS - don't count a
  // successful export for the new session.
  if (!isAccountGenerationCurrent(book.token)) return { status: 'cancelled' };
  track('journal_memory_book_created', bookAnalytics(book.entries.length, book.layout, book.includeText));
  return { status: 'shared', missingPhotos: book.missingPhotoIds.length };
}

/**
 * Prepare + share in one go (continues without photos that could not be
 * obtained). The screen uses the two steps separately so the person can
 * decide about missing photos before anything is shared.
 */
export async function exportMemoryBook(input: {
  entries: readonly JournalEntry[];
  includeText: boolean;
  layout: BookLayout;
  formatDate: (date: string) => string;
  buildHtml: (pages: BookPage[]) => string;
  today: string;
}): Promise<ExportOutcome> {
  const prepared = await prepareMemoryBook(input);
  if (prepared.status !== 'ready') return prepared;
  return shareMemoryBook(prepared.book, input.buildHtml, input.today);
}
