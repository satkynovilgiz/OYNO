import { isValidJournalLink, JOURNAL_NOTE_MAX, JOURNAL_TITLE_MAX, type JournalDraft, type JournalEntry, type JournalLink } from '../journalModel';

/**
 * Unfinished writing in the Journal editor.
 *
 * The editor compares what is on screen with a BASELINE (the saved entry,
 * or the blank/pre-filled form of a new memory). Only a real difference is
 * "dirty": opening an entry, or retyping the same text, is not.
 *
 * A dirty editor is kept as a local DRAFT, per owner ('guest' or a user id)
 * and per target (an entry id, or 'new'). A draft never leaves the device,
 * never syncs, and is never read for another owner.
 */

export type EditorFields = JournalDraft;

/** 'new' = an unsaved new memory; otherwise the id of the entry being edited. */
export type DraftTarget = 'new' | string;

export type EditorDraft = {
  v: 1;
  target: DraftTarget;
  /** The id the entry gets (new) / has (edit). Pre-allocated for a new
   * memory so saving a restored draft twice can never create two entries. */
  entryId: string;
  fields: EditorFields;
  /** The saved entry's version when editing began (null for a new memory):
   * tells the restore prompt that the memory changed since. */
  baseUpdatedAt: string | null;
  savedAt: string;
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const ID_RE = /^[A-Za-z0-9-]{1,80}$/;
/** Draft photos are local files the app made itself - never remote URLs. */
const LOCAL_URI_RE = /^file:\/\//;

export function baselineForEntry(entry: Pick<JournalEntry, 'title' | 'note' | 'date' | 'photo' | 'link'>): EditorFields {
  return { title: entry.title, note: entry.note, date: entry.date, photoUri: entry.photo?.localUri ?? null, link: entry.link };
}

export function baselineForNew(date: string, link: JournalLink | null): EditorFields {
  return { title: '', note: '', date, photoUri: null, link };
}

function sameLink(a: JournalLink | null, b: JournalLink | null): boolean {
  if (!a || !b) return a === b;
  return a.type === b.type && a.id === b.id;
}

/** Which fields differ from the baseline (empty = clean). The title is
 * saved trimmed, so surrounding spaces alone change nothing. */
export function changedFields(fields: EditorFields, baseline: EditorFields): (keyof EditorFields)[] {
  const changed: (keyof EditorFields)[] = [];
  if (fields.title.trim() !== baseline.title.trim()) changed.push('title');
  if (fields.note !== baseline.note) changed.push('note');
  if (fields.date !== baseline.date) changed.push('date');
  if ((fields.photoUri ?? null) !== (baseline.photoUri ?? null)) changed.push('photoUri');
  if (!sameLink(fields.link, baseline.link)) changed.push('link');
  return changed;
}

export function isDirty(fields: EditorFields, baseline: EditorFields): boolean {
  return changedFields(fields, baseline).length > 0;
}

export function makeDraft(target: DraftTarget, entryId: string, fields: EditorFields, baseUpdatedAt: string | null, now = new Date()): EditorDraft {
  return { v: 1, target, entryId, fields: { ...fields }, baseUpdatedAt, savedAt: now.toISOString() };
}

/**
 * Re-checks a draft read back from storage: anything malformed is dropped
 * (null), never half-applied. Text is clipped to the editor's limits and a
 * link to content that no longer exists is removed.
 */
export function parseStoredDraft(value: unknown, expectedTarget: string): EditorDraft | null {
  const raw = value as Partial<EditorDraft> | null;
  if (!raw || typeof raw !== 'object' || raw.v !== 1) return null;
  if (raw.target !== expectedTarget || typeof raw.entryId !== 'string' || !ID_RE.test(raw.entryId)) return null;
  if (raw.target !== 'new' && raw.target !== raw.entryId) return null;
  if (typeof raw.savedAt !== 'string' || Number.isNaN(Date.parse(raw.savedAt))) return null;
  const fields = raw.fields as Partial<EditorFields> | undefined;
  if (!fields || typeof fields !== 'object') return null;
  if (typeof fields.title !== 'string' || typeof fields.note !== 'string' || typeof fields.date !== 'string' || !DATE_RE.test(fields.date)) return null;
  const photoUri = typeof fields.photoUri === 'string' && LOCAL_URI_RE.test(fields.photoUri) && !fields.photoUri.includes('..') ? fields.photoUri : null;
  const link = fields.link && isValidJournalLink(fields.link) ? { type: fields.link.type, id: fields.link.id, label: String(fields.link.label ?? '').slice(0, 160) } : null;
  return {
    v: 1,
    target: raw.target,
    entryId: raw.entryId,
    fields: { title: fields.title.slice(0, JOURNAL_TITLE_MAX), note: fields.note.slice(0, JOURNAL_NOTE_MAX), date: fields.date, photoUri, link },
    baseUpdatedAt: typeof raw.baseUpdatedAt === 'string' ? raw.baseUpdatedAt : null,
    savedAt: raw.savedAt,
  };
}

export type RestoreOffer = {
  draft: EditorDraft;
  /** The saved memory was changed (e.g. on another phone) after this draft began. */
  entryChangedSince: boolean;
};

/**
 * Whether reopening the editor should offer Restore / Discard. A draft that
 * equals the current baseline holds nothing to restore. An edit draft whose
 * entry is gone offers nothing (the editor shows "not found").
 */
export function restoreOffer(draft: EditorDraft | null, baseline: EditorFields, entry: Pick<JournalEntry, 'updatedAt'> | null): RestoreOffer | null {
  if (!draft) return null;
  if (draft.target !== 'new' && !entry) return null;
  if (!isDirty(draft.fields, baseline)) return null;
  return { draft, entryChangedSince: !!entry && !!draft.baseUpdatedAt && draft.baseUpdatedAt !== entry.updatedAt };
}

/** The fields a restore puts back. A draft photo whose file is gone (the OS
 * clears temporary files) comes back as "no new photo": the baseline's. */
export function restoredFields(draft: EditorDraft, baseline: EditorFields, photoExists: (uri: string) => boolean): { fields: EditorFields; photoLost: boolean } {
  const uri = draft.fields.photoUri;
  if (uri && uri !== baseline.photoUri && !photoExists(uri)) {
    return { fields: { ...draft.fields, photoUri: baseline.photoUri }, photoLost: true };
  }
  return { fields: { ...draft.fields }, photoLost: false };
}
