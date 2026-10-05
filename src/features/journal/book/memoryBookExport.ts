import { track } from '@/services/analytics/analytics';
import { captureAccountGeneration, isAccountGenerationCurrent } from '@/services/sync/accountGeneration';
import { currentPhotoOwner } from '@/store/useJournalStore';

import type { JournalEntry } from '../journalModel';
import { bookAnalytics, type BookLayout, type BookPage } from './memoryBookModel';
import { ExportCancelledError, generateAndShareBook, photoDataUri, type ExportSession } from './memoryBookService';

export type ExportOutcome = { status: 'shared'; missingPhotos: number } | { status: 'cancelled' } | { status: 'failed' };

/**
 * One Memory Book export, bound to the account SESSION that started it.
 *
 * The account-generation token is captured first thing; it is checked
 * after photo preparation, and handed to generateAndShareBook, which
 * checks it again after printing and right before the share sheet opens.
 * Any account change - including signing out and back into the SAME
 * account - stops the export:
 *   - nothing is shared, temporary PDFs are deleted,
 *   - no "created" analytics event, no failure toast ('cancelled').
 * Guests export too (their session is the guest one).
 */
export async function exportMemoryBook(input: {
  /** Already validated and ordered (bookEntries). */
  entries: readonly JournalEntry[];
  includeText: boolean;
  layout: BookLayout;
  formatDate: (date: string) => string;
  buildHtml: (pages: BookPage[]) => string;
  today: string;
}): Promise<ExportOutcome> {
  const token = captureAccountGeneration();
  const session: ExportSession = { isValid: () => isAccountGenerationCurrent(token) };
  const photoOwner = currentPhotoOwner();
  const isOwnerCurrent = (owner: string) => currentPhotoOwner() === owner;

  let missingPhotos = 0;
  const pages: BookPage[] = [];
  for (const entry of input.entries) {
    const image = entry.photo ? await photoDataUri(entry, photoOwner, token.userId !== null, session, isOwnerCurrent) : null;
    if (!session.isValid()) return { status: 'cancelled' };
    if (entry.photo && !image) missingPhotos += 1;
    pages.push({ title: entry.title, dateLabel: input.formatDate(entry.date), note: input.includeText && entry.note.trim() ? entry.note : null, image });
  }
  if (!session.isValid()) return { status: 'cancelled' };

  try {
    await generateAndShareBook(input.buildHtml(pages), input.today, session);
  } catch (error) {
    return error instanceof ExportCancelledError ? { status: 'cancelled' } : { status: 'failed' };
  }
  // The sheet closed (shared or dismissed). If the session changed while it
  // was open, the file was already handed to the OS - don't count a
  // successful export for the new session.
  if (!session.isValid()) return { status: 'cancelled' };
  track('journal_memory_book_created', bookAnalytics(input.entries.length, input.layout, input.includeText));
  return { status: 'shared', missingPhotos };
}
