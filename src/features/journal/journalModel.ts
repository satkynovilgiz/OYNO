import { collections } from '@/features/collections/collectionsData';
import { cultureItemImages } from '@/features/culture/data';
import { natureSiteImages } from '@/features/explore/data';
import { trails } from '@/features/trails/trailsData';
import { isoTime } from '@/services/sync/mergeRules';

/**
 * "My Kyrgyzstan Journal" - one private model for every age mode (the
 * screens only change how it looks). Entries are personal content, kept
 * completely apart from progress: creating, editing or deleting one never
 * touches Passport, Explore visits, Favorites, Achievements, Challenges or
 * Trails, and journal text never enters search, analytics or diagnostics.
 */

export type JournalLinkType = 'nature_site' | 'culture_item' | 'collection' | 'trail';

export type JournalLink = {
  type: JournalLinkType;
  id: string;
  /** Name shown on the entry, captured when linked (KG/RU/EN as displayed). */
  label: string;
};

export type JournalPhoto = {
  /** On-device file (app documents folder) - never inside AsyncStorage. */
  localUri: string | null;
  /** Private cloud copy for a signed-in account: "<user id>/<entry id>.jpg". */
  remotePath: string | null;
};

export type JournalEntry = {
  id: string;
  title: string;
  /** Written by the user, kept exactly as written - never translated. */
  note: string;
  /** The day the memory is about (YYYY-MM-DD), chosen by the user. */
  date: string;
  photo: JournalPhoto | null;
  link: JournalLink | null;
  createdAt: string;
  updatedAt: string;
  /** Set when deleted: kept as a tombstone until the account has it, so a
   * delete syncs to the user's other phones instead of reappearing. */
  deletedAt: string | null;
};

export type JournalDraft = {
  title: string;
  note: string;
  date: string;
  photoUri: string | null;
  link: JournalLink | null;
};

export const JOURNAL_TITLE_MAX = 120;
export const JOURNAL_NOTE_MAX = 4000;
export const JOURNAL_EXCERPT_MAX = 140;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const ID_RE = /^[a-z0-9-]{1,80}$/;

// Culture items come from the database; ids opened on a detail screen this
// session are real by definition, the rest are checked against the ids the
// app ships with (bundled photos, trail steps).
const seenCultureItemIds = new Set<string>();

export function rememberCultureItemId(id: string): void {
  if (ID_RE.test(id)) seenCultureItemIds.add(id);
}

function knownCultureItem(id: string): boolean {
  if (seenCultureItemIds.has(id) || id in cultureItemImages) return true;
  return trails.some((trail) => trail.steps.some((step) => step.type === 'culture_item' && step.id === id));
}

/** A link must point at real OYNO content of a supported type. */
export function isValidJournalLink(link: { type: string; id: string } | null | undefined): link is JournalLink {
  if (!link || !ID_RE.test(link.id)) return false;
  switch (link.type) {
    case 'nature_site':
      return link.id in natureSiteImages;
    case 'collection':
      return collections.some((collection) => collection.id === link.id);
    case 'trail':
      return trails.some((trail) => trail.id === link.id);
    case 'culture_item':
      return knownCultureItem(link.id);
    default:
      return false;
  }
}

export type DraftProblem = 'empty' | 'title_too_long' | 'note_too_long' | 'bad_date' | 'bad_link';

/** An entry needs at least a title, a note, a photo or a linked place. */
export function validateDraft(draft: JournalDraft): DraftProblem[] {
  const problems: DraftProblem[] = [];
  if (!draft.title.trim() && !draft.note.trim() && !draft.photoUri && !draft.link) problems.push('empty');
  if (draft.title.length > JOURNAL_TITLE_MAX) problems.push('title_too_long');
  if (draft.note.length > JOURNAL_NOTE_MAX) problems.push('note_too_long');
  if (!DATE_RE.test(draft.date) || Number.isNaN(Date.parse(draft.date))) problems.push('bad_date');
  if (draft.link && !isValidJournalLink(draft.link)) problems.push('bad_link');
  return problems;
}

/** Newest real record wins per id; a tombstone wins unless an edit is newer. */
export function mergeJournalEntries(a: JournalEntry[], b: JournalEntry[]): { merged: JournalEntry[]; conflicts: number } {
  const byId = new Map<string, JournalEntry>();
  let conflicts = 0;
  for (const entry of [...a, ...b]) {
    const existing = byId.get(entry.id);
    if (!existing) {
      byId.set(entry.id, entry);
      continue;
    }
    if (existing.updatedAt !== entry.updatedAt) conflicts += 1;
    const winner = entry.updatedAt > existing.updatedAt ? entry : existing;
    // Keep a local photo file even when the other side's newer record only
    // knows the cloud path.
    const photo = winner.photo && !winner.photo.localUri && existing.photo?.localUri && existing.photo.remotePath === winner.photo.remotePath
      ? { ...winner.photo, localUri: existing.photo.localUri }
      : winner.photo;
    byId.set(entry.id, { ...winner, photo });
  }
  return { merged: Array.from(byId.values()), conflicts };
}

export type JournalFilter = 'all' | 'places' | 'culture' | 'trails';

export function visibleEntries(entries: JournalEntry[], filter: JournalFilter = 'all'): JournalEntry[] {
  return entries
    .filter((entry) => !entry.deletedAt)
    .filter((entry) => {
      if (filter === 'all') return true;
      const type = entry.link?.type;
      if (filter === 'places') return type === 'nature_site';
      if (filter === 'culture') return type === 'culture_item' || type === 'collection';
      return type === 'trail';
    })
    .sort((x, y) => (x.date === y.date ? y.createdAt.localeCompare(x.createdAt) : y.date.localeCompare(x.date)));
}

/** Timeline sections: one per calendar month, newest first. */
export function groupByMonth(entries: JournalEntry[]): { month: string; entries: JournalEntry[] }[] {
  const groups: { month: string; entries: JournalEntry[] }[] = [];
  for (const entry of entries) {
    const month = entry.date.slice(0, 7);
    const last = groups[groups.length - 1];
    if (last && last.month === month) last.entries.push(entry);
    else groups.push({ month, entries: [entry] });
  }
  return groups;
}

/** What may go on a share card: the user's own chosen excerpt, never the note. */
export function shareExcerpt(input: string): string {
  const trimmed = input.trim().replace(/\s+/g, ' ');
  return trimmed.length > JOURNAL_EXCERPT_MAX ? `${trimmed.slice(0, JOURNAL_EXCERPT_MAX - 1)}…` : trimmed;
}

// ---------------------------------------------------------------------
// Server row mapping (user_journal_entries)
// ---------------------------------------------------------------------

export type ServerJournalRow = {
  id: string;
  title: string;
  note: string;
  memory_date: string;
  link_type: JournalLinkType | null;
  link_id: string | null;
  link_label: string | null;
  photo_path: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export function entryToRow(entry: JournalEntry): ServerJournalRow {
  return {
    id: entry.id,
    title: entry.title,
    note: entry.note,
    memory_date: entry.date,
    link_type: entry.link?.type ?? null,
    link_id: entry.link?.id ?? null,
    link_label: entry.link?.label ?? null,
    photo_path: entry.photo?.remotePath ?? null,
    created_at: entry.createdAt,
    updated_at: entry.updatedAt,
    deleted_at: entry.deletedAt,
  };
}

export function rowToEntry(row: ServerJournalRow): JournalEntry {
  return {
    id: row.id,
    title: row.title,
    note: row.note,
    date: String(row.memory_date).slice(0, 10),
    photo: row.photo_path ? { localUri: null, remotePath: row.photo_path } : null,
    link: row.link_type && row.link_id ? { type: row.link_type, id: row.link_id, label: row.link_label ?? '' } : null,
    createdAt: isoTime(row.created_at),
    updatedAt: isoTime(row.updated_at),
    deletedAt: isoTime(row.deleted_at),
  };
}
