import { track } from '@/services/analytics/analytics';
import { captureAccountGeneration, isAccountGenerationCurrent, type AccountGenerationToken } from '@/services/sync/accountGeneration';
import { currentPhotoOwner } from '@/store/useJournalStore';

import type { JournalEntry } from '../journalModel';
import { bookAnalytics, type BookLayout, type BookPage } from './memoryBookModel';
import { ExportCancelledError, generateAndShareBook, photoDataUri, type ExportSession } from './memoryBookService';

export type ExportOutcome = { status: 'shared'; missingPhotos: number } | { status: 'cancelled' } | { status: 'failed' };

/**
 * Prepared photo data for ONE account session. Lets "try again" after a
 * missing photo fetch only what is still missing - nothing is downloaded
 * twice. Never persisted; any session change makes it unusable.
 */
export type PhotoCache = { token: AccountGenerationToken; images: Map<string, string> };

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

  const pages: BookPage[] = [];
  const missingPhotoIds: string[] = [];
  for (const entry of input.entries) {
    let image: string | null = null;
    if (entry.photo) {
      image = cache?.images.get(entry.id) ?? (await photoDataUri(entry, photoOwner, token.userId !== null, session, isOwnerCurrent));
      if (!session.isValid()) return { status: 'cancelled' };
      if (image) cache?.images.set(entry.id, image);
      else missingPhotoIds.push(entry.id);
    }
    pages.push({ title: entry.title, dateLabel: input.formatDate(entry.date), note: input.includeText && entry.note.trim() ? entry.note : null, image });
  }
  if (!session.isValid()) return { status: 'cancelled' };
  return { status: 'ready', book: { token, entries: input.entries, pages, missingPhotoIds, includeText: input.includeText, layout: input.layout } };
}

/**
 * Step 2 - render and share a prepared book. Refuses a book prepared in
 * another session. generateAndShareBook re-checks the session after
 * printing and right before the share sheet; a stale session is a silent
 * 'cancelled' (temporary PDFs removed, no analytics).
 */
export async function shareMemoryBook(book: PreparedBook, buildHtml: (pages: BookPage[]) => string, today: string): Promise<ExportOutcome> {
  const session: ExportSession = { isValid: () => isAccountGenerationCurrent(book.token) };
  if (!session.isValid()) return { status: 'cancelled' };
  try {
    await generateAndShareBook(buildHtml(book.pages), today, session);
  } catch (error) {
    return error instanceof ExportCancelledError ? { status: 'cancelled' } : { status: 'failed' };
  }
  // The sheet closed (shared or dismissed). If the session changed while it
  // was open, the file was already handed to the OS - don't count a
  // successful export for the new session.
  if (!session.isValid()) return { status: 'cancelled' };
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
