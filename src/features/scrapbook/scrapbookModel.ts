/**
 * Cultural Scrapbook - a private sequence of the owner's EXISTING things:
 * an article, a journal reflection, a saved Oymo design, a listening moment.
 *
 * One rule for every entry: a LIVE REFERENCE. The scrapbook stores which
 * record it points at (+ the owner's caption); what is shown comes from the
 * source record now. A short title snapshot is kept ONLY to label the entry
 * if its source disappears - the entry stays, as a placeholder, with the
 * caption. Rearranging or editing a scrapbook never writes a source record.
 *
 * Time capsules are not offered: a sealed capsule's contents never enter a
 * scrapbook.
 */
export const MAX_ENTRIES = 20;
export const TITLE_MAX = 60;
export const CAPTION_MAX = 200;
export const MAX_SCRAPBOOKS = 30;

export type EntryRef =
  | { kind: 'article'; contentType: 'culture_item' | 'culture_material'; id: string }
  | { kind: 'journal'; id: string }
  | { kind: 'design'; id: string }
  | { kind: 'moment'; id: string };
export type EntryKind = EntryRef['kind'];
export const ENTRY_KINDS: EntryKind[] = ['article', 'journal', 'design', 'moment'];
export type ScrapEntry = { key: string; ref: EntryRef; titleSnapshot: string; caption: string };
export type Scrapbook = { id: string; title: string; entries: ScrapEntry[]; createdAt: string; updatedAt: string };

const ID = /^[A-Za-z0-9_.:-]{1,100}$/;
const clean = (value: unknown, max: number) => (typeof value === 'string' ? value.replace(/[<>{}]/g, '').slice(0, max) : '');
export const refKey = (ref: EntryRef) => (ref.kind === 'article' ? `article:${ref.contentType}:${ref.id}` : `${ref.kind}:${ref.id}`);
const touch = (book: Scrapbook, patch: Partial<Scrapbook>): Scrapbook => ({ ...book, ...patch, updatedAt: new Date().toISOString() });

export function newScrapbook(title: string, now = new Date()): Scrapbook {
  return { id: `sb${now.getTime().toString(36)}${Math.random().toString(36).slice(2, 7)}`, title: clean(title, TITLE_MAX).trim(), entries: [], createdAt: now.toISOString(), updatedAt: now.toISOString() };
}
export const rename = (book: Scrapbook, title: string) => touch(book, { title: clean(title, TITLE_MAX) });

export function addEntry(book: Scrapbook, ref: EntryRef, titleSnapshot: string): Scrapbook {
  if (!ID.test(ref.id) || book.entries.length >= MAX_ENTRIES) return book;
  const key = refKey(ref);
  if (book.entries.some((entry) => entry.key === key)) return book;
  return touch(book, { entries: [...book.entries, { key, ref, titleSnapshot: clean(titleSnapshot, 120), caption: '' }] });
}
export const removeEntry = (book: Scrapbook, key: string) => touch(book, { entries: book.entries.filter((entry) => entry.key !== key) });
export function moveEntry(book: Scrapbook, index: number, delta: -1 | 1): Scrapbook {
  const target = index + delta;
  if (index < 0 || target < 0 || target >= book.entries.length) return book;
  const entries = [...book.entries];
  [entries[index], entries[target]] = [entries[target], entries[index]];
  return touch(book, { entries });
}
export function setCaption(book: Scrapbook, key: string, caption: string): Scrapbook {
  if (!book.entries.some((entry) => entry.key === key)) return book;
  return touch(book, { entries: book.entries.map((entry) => (entry.key === key ? { ...entry, caption: clean(caption, CAPTION_MAX) } : entry)) });
}

/** What a live source looks like now (null = gone / not available; undefined = not known yet). */
export type SourceView = { title: string; detail: string | null; route: string } | null | undefined;
export type ResolvedScrap = ScrapEntry & { position: number; status: 'ok' | 'missing' | 'loading'; source: Exclude<SourceView, null | undefined> | null };
export function resolveEntries(book: Scrapbook, resolve: (ref: EntryRef) => SourceView): ResolvedScrap[] {
  return book.entries.map((entry, position) => {
    const source = resolve(entry.ref);
    if (source === undefined) return { ...entry, position, status: 'loading', source: null };
    return source ? { ...entry, position, status: 'ok', source } : { ...entry, position, status: 'missing', source: null };
  });
}

export function normalizeScrapbook(raw: unknown): Scrapbook | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const value = raw as Partial<Scrapbook>;
  if (typeof value.id !== 'string' || !/^sb[a-z0-9]{4,40}$/.test(value.id)) return null;
  const entries: ScrapEntry[] = [];
  for (const entry of Array.isArray(value.entries) ? value.entries : []) {
    const ref = entry?.ref as EntryRef | undefined;
    if (!ref || typeof ref.id !== 'string' || !ID.test(ref.id) || !ENTRY_KINDS.includes(ref.kind)) continue;
    if (ref.kind === 'article' && ref.contentType !== 'culture_item' && ref.contentType !== 'culture_material') continue;
    const key = refKey(ref);
    if (entries.some((existing) => existing.key === key) || entries.length >= MAX_ENTRIES) continue;
    entries.push({ key, ref: ref.kind === 'article' ? { kind: 'article', contentType: ref.contentType, id: ref.id } : { kind: ref.kind, id: ref.id }, titleSnapshot: clean(entry.titleSnapshot, 120), caption: clean(entry.caption, CAPTION_MAX) });
  }
  return { id: value.id, title: clean(value.title, TITLE_MAX), entries, createdAt: typeof value.createdAt === 'string' ? value.createdAt : '', updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : '' };
}
