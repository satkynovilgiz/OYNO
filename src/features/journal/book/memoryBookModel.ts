import type { JournalEntry } from '../journalModel';
import { visibleEntries } from '../journalModel';

/**
 * Journal Memory Book PDF - pure rules. The book is generated on demand
 * from the CURRENT owner's own, non-deleted memories, entirely on the
 * device. Nothing here stores a book, uploads anything, or rewrites,
 * summarizes or translates a note - a note is included exactly as written,
 * and only when "Include journal text" is switched on.
 */

export const MIN_BOOK_ENTRIES = 3;
export const MAX_BOOK_ENTRIES = 20;
export type BookSort = 'oldest' | 'newest';
export type BookLayout = 'classic' | 'photo';
export const BOOK_LAYOUTS: readonly BookLayout[] = ['classic', 'photo'];
export const TITLE_MAX = 80;

/** A4 portrait at 72 PPI - expo-print's page size unit. */
export const A4 = { width: 595, height: 842 } as const;

/** Only visible (non-deleted) memories can be chosen. */
export function bookCandidates(entries: readonly JournalEntry[]): JournalEntry[] {
  return visibleEntries([...entries]);
}

export function toggleBookSelection(selected: readonly string[], id: string): string[] {
  if (selected.includes(id)) return selected.filter((value) => value !== id);
  if (selected.length >= MAX_BOOK_ENTRIES) return [...selected];
  return [...selected, id];
}

/** Drops anything deleted (or no longer this owner's) since it was picked. */
export function validSelection(entries: readonly JournalEntry[], selected: readonly string[]): string[] {
  const visible = new Set(bookCandidates(entries).map((entry) => entry.id));
  return [...new Set(selected)].filter((id) => visible.has(id));
}

export function canGenerate(entries: readonly JournalEntry[], selected: readonly string[]): boolean {
  const count = validSelection(entries, selected).length;
  return count >= MIN_BOOK_ENTRIES && count <= MAX_BOOK_ENTRIES;
}

/** Ordered by the MEMORY date (JournalEntry.date), never createdAt; id breaks ties deterministically. */
export function sortForBook(entries: readonly JournalEntry[], sort: BookSort): JournalEntry[] {
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  return sort === 'oldest' ? sorted : sorted.reverse();
}

export function bookEntries(entries: readonly JournalEntry[], selected: readonly string[], sort: BookSort): JournalEntry[] {
  const ids = new Set(validSelection(entries, selected));
  return sortForBook(bookCandidates(entries).filter((entry) => ids.has(entry.id)), sort);
}

/** First and last memory date of the selection (for the optional subtitle). */
export function dateRange(entries: readonly JournalEntry[]): { from: string; to: string } | null {
  if (entries.length === 0) return null;
  const dates = entries.map((entry) => entry.date).sort();
  return { from: dates[0], to: dates[dates.length - 1] };
}

export function bookFileName(today: string): string {
  const day = /^\d{4}-\d{2}-\d{2}$/.test(today) ? today : 'book';
  return `OYNO-Memory-Book-${day}.pdf`;
}

export function cleanBookTitle(title: string, fallback: string): string {
  const clean = title.replace(/\s+/g, ' ').trim().slice(0, TITLE_MAX);
  return clean || fallback;
}

export function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/** Only inline image data may enter the document - never a file path or URL. */
export function isEmbeddableImage(value: string | null | undefined): value is string {
  return typeof value === 'string' && /^data:image\/(jpeg|png);base64,[A-Za-z0-9+/=]+$/.test(value);
}

export type BookPage = { title: string; dateLabel: string; note: string | null; image: string | null };

export type BookHtmlInput = {
  title: string;
  subtitle: string | null;
  layout: BookLayout;
  pages: BookPage[];
  labels: { untitled: string; madeWith: string };
  language: string;
};

const OYMO_DIVIDER = '<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2 L15 9 L22 12 L15 15 L12 22 L9 15 L2 12 L9 9 Z" fill="none" stroke="#C99A2E" stroke-width="1.6"/></svg>';

/**
 * Real text (selectable, searchable), not page screenshots. A4 portrait,
 * safe margins, one memory per page start; a long note simply flows on to
 * the next page (no truncation). Photos are inline data only.
 */
export function buildBookHtml(input: BookHtmlInput): string {
  const pages = input.pages
    .map((page) => {
      const image = isEmbeddableImage(page.image) ? `<div class="photo"><img src="${page.image}" alt=""/></div>` : '';
      const note = page.note ? `<p class="note">${escapeHtml(page.note)}</p>` : '';
      const title = `<h2>${escapeHtml(page.title.trim() || input.labels.untitled)}</h2>`;
      const date = `<div class="date">${escapeHtml(page.dateLabel)}</div>`;
      const body = input.layout === 'photo' ? `${image}${date}${title}${note}` : `${date}${title}${image}${note}`;
      return `<section class="memory ${input.layout}">${body}<div class="divider">${OYMO_DIVIDER}</div></section>`;
    })
    .join('\n');
  return `<!DOCTYPE html>
<html lang="${escapeHtml(input.language)}"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/>
<style>
@page { size: A4 portrait; margin: 18mm 16mm; }
* { box-sizing: border-box; }
body { margin: 0; background: #F3E5C9; color: #1F2A22; font-family: Georgia, 'Times New Roman', serif; }
.cover { min-height: 250mm; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; page-break-after: always; }
.cover h1 { font-size: 34pt; color: #1E4D3A; margin: 12pt 0 6pt; }
.cover .sub { font-size: 13pt; color: #5C4A36; }
.cover .made { margin-top: 28pt; font-size: 10pt; letter-spacing: 2pt; color: #8B6B3D; }
.memory { page-break-before: always; padding-top: 4mm; }
.memory .date { font-size: 10pt; letter-spacing: 1pt; text-transform: uppercase; color: #8B6B3D; }
.memory h2 { font-size: 20pt; color: #1E4D3A; margin: 4pt 0 10pt; }
.memory .photo { margin: 0 0 12pt; text-align: center; page-break-inside: avoid; }
.memory .photo img { max-width: 100%; max-height: 120mm; border: 4pt solid #FFFDF7; border-radius: 6pt; }
.memory.photo .photo img { max-height: 175mm; }
.memory .note { font-size: 12pt; line-height: 1.55; white-space: pre-wrap; margin: 0; }
.memory.photo .note { font-size: 11pt; }
.divider { text-align: center; margin-top: 14pt; }
</style></head><body>
<div class="cover">${OYMO_DIVIDER}<h1>${escapeHtml(input.title)}</h1>${input.subtitle ? `<div class="sub">${escapeHtml(input.subtitle)}</div>` : ''}<div class="made">${escapeHtml(input.labels.madeWith)}</div></div>
${pages}
</body></html>`;
}

/** Analytics payload: counts and switches only - never titles, notes, dates or paths. */
export function bookAnalytics(entryCount: number, layout: BookLayout, includedText: boolean): { entry_count: number; layout: BookLayout; included_text: boolean } {
  return { entry_count: entryCount, layout, included_text: includedText };
}

/**
 * What the review can honestly say about an entry's photo WITHOUT trying
 * to fetch it:
 *   local    a copy is on this device (thumbnail shown)
 *   account  only the signed-in account has it; it will be TRIED during
 *            preparation - not promised
 *   missing  referenced, but neither a local copy nor a way to restore it
 *   none     the memory has no photo
 */
export type ReviewPhotoState = 'local' | 'account' | 'missing' | 'none';

export function reviewPhotoState(entry: Pick<JournalEntry, 'photo'>, localExists: (uri: string) => boolean, signedIn: boolean): ReviewPhotoState {
  const photo = entry.photo;
  if (!photo) return 'none';
  if (photo.localUri && localExists(photo.localUri)) return 'local';
  if (signedIn && photo.remotePath) return 'account';
  return 'missing';
}

export type ReviewItem = { id: string; title: string; date: string; photo: ReviewPhotoState; thumbnailUri: string | null; notePreview: string | null };

export const NOTE_PREVIEW_MAX = 160;

/**
 * The review list, in the EXACT order the PDF will use (same bookEntries
 * call). With text OFF no note content is part of the review at all.
 */
export function reviewItems(entries: readonly JournalEntry[], selected: readonly string[], sort: BookSort, includeText: boolean, localExists: (uri: string) => boolean, signedIn: boolean): ReviewItem[] {
  return bookEntries(entries, selected, sort).map((entry) => {
    const photo = reviewPhotoState(entry, localExists, signedIn);
    const note = includeText ? entry.note.trim() : '';
    return {
      id: entry.id,
      title: entry.title,
      date: entry.date,
      photo,
      thumbnailUri: photo === 'local' ? entry.photo!.localUri : null,
      notePreview: note ? (note.length > NOTE_PREVIEW_MAX ? `${note.slice(0, NOTE_PREVIEW_MAX).trimEnd()}…` : note) : null,
    };
  });
}

/**
 * A photo's identity: its immutable cloud version when it has one; for
 * legacy photos without a versionId, the object path, else the device file
 * path. A replaced photo always gets a new versionId (and file), so a
 * cached image can never stand in for a different picture.
 */
export function photoIdentity(photo: JournalEntry['photo']): string | null {
  if (!photo) return null;
  return photo.versionId ? `v:${photo.versionId}` : photo.remotePath ? `r:${photo.remotePath}` : photo.localUri ? `l:${photo.localUri}` : null;
}

/** Cache key for one entry's CURRENT photo. */
export function photoCacheKey(entry: Pick<JournalEntry, 'id' | 'photo'>): string | null {
  const identity = photoIdentity(entry.photo);
  return identity ? `${entry.id}|${identity}` : null;
}

/** The version of an entry's content as it goes into a book (any edit bumps updatedAt). */
export function entryVersion(entry: Pick<JournalEntry, 'updatedAt' | 'photo' | 'deletedAt'>): string {
  return `${entry.updatedAt}|${photoIdentity(entry.photo) ?? '-'}|${entry.deletedAt ?? '-'}`;
}

export type BookFreshness = { status: 'fresh' } | { status: 'changed'; ids: string[] } | { status: 'deleted'; ids: string[] };

/**
 * Is a prepared book still what the person reviewed? Deleted (or missing)
 * memories win over edits: a deleted memory must never be exported.
 */
export function bookFreshness(sourceVersions: Readonly<Record<string, string>>, current: readonly JournalEntry[]): BookFreshness {
  const byId = new Map(current.map((entry) => [entry.id, entry]));
  const deleted: string[] = [];
  const changed: string[] = [];
  for (const [id, version] of Object.entries(sourceVersions)) {
    const entry = byId.get(id);
    if (!entry || entry.deletedAt) deleted.push(id);
    else if (entryVersion(entry) !== version) changed.push(id);
  }
  if (deleted.length) return { status: 'deleted', ids: deleted };
  if (changed.length) return { status: 'changed', ids: changed };
  return { status: 'fresh' };
}
