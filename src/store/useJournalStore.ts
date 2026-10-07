import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

import { mergeJournalEntries, validateDraft, type JournalDraft, type JournalEntry } from '@/features/journal/journalModel';
import { deleteTempImage } from '@/services/media/normalizeImage';
import { adoptLocalPhoto, deleteAllLocalPhotos, deleteLocalPhoto, GUEST_PHOTO_OWNER, keepLocalPhoto } from '@/services/journal/journalPhotos';
import { safeJsonParse } from '@/services/storage/safeJson';
import { createUuid } from '@/services/storage/uuid';
import { captureAccountGeneration, isAccountGenerationCurrent, type AccountGenerationToken } from '@/services/sync/accountGeneration';
import { registerAccountBoundKeys, registerAccountClearHandler } from '@/services/sync/accountScope';
import { currentAccountId, currentEditOrigin, requestAccountSync } from '@/services/sync/syncTrigger';

export const JOURNAL_STORAGE_KEY = 'oyno.journal.v1';

// Private, account-bound: cleared (with THAT owner's photo folder only) on sign-out.
registerAccountBoundKeys([JOURNAL_STORAGE_KEY]);
registerAccountClearHandler((owner) => deleteAllLocalPhotos(owner));

type EntryRemovedListener = (entryId: string, owner: string) => void;
const entryRemovedListeners = new Set<EntryRemovedListener>();

/** Told when an entry is deleted - here, or by a sync tombstone (e.g. unfinished drafts of it go too). */
export function registerEntryRemovedListener(listener: EntryRemovedListener): () => void {
  entryRemovedListeners.add(listener);
  return () => entryRemovedListeners.delete(listener);
}

function notifyRemoved(entryIds: string[]) {
  if (entryIds.length === 0) return;
  const owner = currentPhotoOwner();
  for (const id of entryIds)
    for (const listener of entryRemovedListeners) {
      try {
        listener(id, owner);
      } catch {
        // A listener never blocks a delete.
      }
    }
}

/** Whose folder new local photos go into right now. */
export function currentPhotoOwner(): string {
  return currentAccountId() ?? GUEST_PHOTO_OWNER;
}

/** Why a save did not happen. Nothing was changed when this is thrown. */
export class JournalSaveError extends Error {
  constructor(readonly reason: 'photo' | 'storage' | 'account_changed') {
    super(`JOURNAL_SAVE_${reason.toUpperCase()}`);
    this.name = 'JournalSaveError';
  }
}

type JournalState = {
  isLoaded: boolean;
  /** Includes tombstones (deletedAt) - use `visibleEntries` for display. */
  entries: JournalEntry[];
  load: () => Promise<void>;
  /**
   * Returns the new entry, or null if the draft isn't valid. `id` lets the
   * editor pre-allocate the id: creating the same id again UPDATES that
   * entry, so a retried or restored draft can never make a duplicate.
   * Throws `JournalSaveError` (with nothing changed) if the photo can't be
   * kept, the device can't store the journal, or the account changed.
   */
  create: (draft: JournalDraft, options?: { id?: string }) => Promise<JournalEntry | null>;
  /** Same contract as `create`. */
  update: (id: string, draft: JournalDraft) => Promise<JournalEntry | null>;
  remove: (id: string) => Promise<void>;
  /** Sync layer only. */
  replaceAll: (entries: JournalEntry[]) => Promise<void>;
  /** Sign-out: forget the previous account's journal on this device. */
  reset: () => void;
  /** Moves every local photo into `owner`'s folder (guest -> account on
   * sign-in; files from before folders were per-owner). Nothing is lost:
   * a photo that can't be moved keeps its old path. */
  adoptPhotos: (owner: string) => Promise<void>;
};

async function persist(entries: JournalEntry[]): Promise<boolean> {
  return AsyncStorage.setItem(JOURNAL_STORAGE_KEY, JSON.stringify(entries)).then(
    () => true,
    () => false,
  );
}

const ENTRY_ID_RE = /^[A-Za-z0-9-]{1,80}$/;

/** "Newest version wins" needs every edit to be strictly newer than the
 * version it replaces - even two edits within the same millisecond. */
function nextTimestamp(previous: string): string {
  const now = Date.now();
  const before = Date.parse(previous);
  return new Date(Number.isFinite(before) && before >= now ? before + 1 : now).toISOString();
}

function isEntry(value: unknown): value is JournalEntry {
  const entry = value as JournalEntry;
  return !!entry && typeof entry.id === 'string' && typeof entry.date === 'string' && typeof entry.updatedAt === 'string';
}

/**
 * The private journal. Deliberately touches nothing but its own key: no
 * progress store, no favorites, no analytics, no search index.
 */
export const useJournalStore = create<JournalState>((set, get) => {
  async function commit(entries: JournalEntry[]) {
    set({ entries });
    await persist(entries);
    requestAccountSync('local_change');
  }

  /**
   * A user save. If the device can't store it, or the account changed
   * meanwhile, the journal is put back as it was and the save throws - the
   * editor then keeps the person's work. `cleanup` undoes a photo copy.
   */
  async function commitSave(token: AccountGenerationToken, saved: JournalEntry, previous: JournalEntry | undefined, cleanup: () => void) {
    if (!isAccountGenerationCurrent(token)) {
      cleanup();
      throw new JournalSaveError('account_changed');
    }
    const apply = (entries: JournalEntry[]) => (previous ? entries.map((entry) => (entry.id === saved.id ? saved : entry)) : [saved, ...entries]);
    const revert = (entries: JournalEntry[]) => (previous ? entries.map((entry) => (entry.id === saved.id && entry === saved ? previous : entry)) : entries.filter((entry) => entry !== saved));
    set({ entries: apply(get().entries) });
    const stored = await persist(get().entries);
    if (!isAccountGenerationCurrent(token)) {
      // The session ended while writing: the account clean-up has reset the
      // journal. Make sure storage holds the NEW session's journal, not this one.
      if (stored) await persist(get().entries);
      cleanup();
      throw new JournalSaveError('account_changed');
    }
    if (!stored) {
      set({ entries: revert(get().entries) });
      cleanup();
      throw new JournalSaveError('storage');
    }
    requestAccountSync('local_change');
  }

  /** The photo the saved version will reference. A new picture is copied
   * into the owner's folder; if that fails the save fails (never a silent
   * "saved" without the photo the person chose). */
  async function resolvePhoto(entryId: string, previous: JournalEntry['photo'], photoUri: string | null, owner: string): Promise<{ photo: JournalEntry['photo']; copied: string | null }> {
    if (!photoUri) return { photo: null, copied: null };
    if (previous?.localUri === photoUri) return { photo: previous, copied: null };
    // A new picture is a NEW immutable version: it gets its own cloud
    // object on the next sync; the previous version is never overwritten.
    const versionId = createUuid();
    const localUri = await keepLocalPhoto(photoUri, entryId, owner, versionId);
    if (!localUri) throw new JournalSaveError('photo');
    return { photo: { localUri, remotePath: null, versionId }, copied: localUri };
  }

  /** After a successful save: the replaced photo file and the temp copy go. */
  function finishPhoto(previous: JournalEntry['photo'], next: JournalEntry['photo'], photoUri: string | null, owner: string) {
    if (previous?.localUri && previous.localUri !== next?.localUri) deleteLocalPhoto(previous.localUri, owner);
    // The normalized temp file is now safely copied into the journal folder.
    if (photoUri && next?.localUri !== photoUri) deleteTempImage(photoUri);
  }

  async function save(id: string, existing: JournalEntry | undefined, draft: JournalDraft): Promise<JournalEntry> {
    const token = captureAccountGeneration();
    const owner = currentPhotoOwner();
    const { photo, copied } = await resolvePhoto(id, existing?.photo ?? null, draft.photoUri, owner);
    const now = new Date().toISOString();
    const saved: JournalEntry = existing
      ? { ...existing, title: draft.title.trim(), note: draft.note, date: draft.date, photo, link: draft.link, updatedAt: nextTimestamp(existing.updatedAt) }
      : { id, title: draft.title.trim(), note: draft.note, date: draft.date, photo, link: draft.link, createdAt: now, updatedAt: now, deletedAt: null };
    await commitSave(token, saved, existing, () => deleteLocalPhoto(copied, owner));
    finishPhoto(existing?.photo ?? null, photo, draft.photoUri, owner);
    return saved;
  }

  return {
    isLoaded: false,
    entries: [],

    load: async () => {
      const parsed = safeJsonParse<unknown>(await AsyncStorage.getItem(JOURNAL_STORAGE_KEY).catch(() => null), []);
      set({ entries: Array.isArray(parsed) ? parsed.filter(isEntry) : [], isLoaded: true });
    },

    create: async (draft, options) => {
      if (validateDraft(draft).length > 0) return null;
      const wanted = options?.id && ENTRY_ID_RE.test(options.id) ? options.id : null;
      if (wanted) {
        const existing = get().entries.find((entry) => entry.id === wanted);
        // Already saved (a retry, or a restored draft): this is an edit.
        if (existing && !existing.deletedAt) return get().update(wanted, draft);
        // Saved and since deleted: a fresh memory, never a resurrection.
        if (existing) return save(createUuid(), undefined, draft);
      }
      return save(wanted ?? createUuid(), undefined, draft);
    },

    update: async (id, draft) => {
      const existing = get().entries.find((entry) => entry.id === id && !entry.deletedAt);
      if (!existing || validateDraft(draft).length > 0) return null;
      return save(id, existing, draft);
    },

    remove: async (id) => {
      const existing = get().entries.find((entry) => entry.id === id);
      if (!existing) return;
      deleteLocalPhoto(existing.photo?.localUri, currentPhotoOwner());
      // A guest's entry never left the device: delete it outright. An
      // account's entry becomes an empty tombstone so the deletion reaches
      // the user's other phones (the private text is wiped immediately).
      const next =
        currentEditOrigin() === 'guest'
          ? get().entries.filter((entry) => entry.id !== id)
          : get().entries.map((entry) =>
              entry.id === id
                ? { ...entry, title: '', note: '', link: null, photo: existing.photo?.remotePath ? { localUri: null, remotePath: existing.photo.remotePath, versionId: existing.photo.versionId ?? null } : null, updatedAt: nextTimestamp(existing.updatedAt), deletedAt: new Date().toISOString() }
                : entry,
            );
      await commit(next);
      notifyRemoved([id]);
    },

    replaceAll: async (entries) => {
      const wasVisible = new Set(get().entries.filter((entry) => !entry.deletedAt).map((entry) => entry.id));
      set({ entries, isLoaded: true });
      await persist(entries);
      // Deleted on another device: the tombstone arrived with the sync.
      notifyRemoved(entries.filter((entry) => entry.deletedAt && wasVisible.has(entry.id)).map((entry) => entry.id));
    },

    reset: () => set({ entries: [], isLoaded: true }),

    adoptPhotos: async (owner) => {
      let changed = false;
      const next: JournalEntry[] = [];
      for (const entry of get().entries) {
        const photo = entry.photo;
        if (!photo?.localUri) {
          next.push(entry);
          continue;
        }
        // A local picture that never had a version (pre-versioning) gets one
        // now, unless it's the device copy of a legacy cloud object.
        const versionId = photo.versionId ?? (photo.remotePath ? null : createUuid());
        const localUri = await adoptLocalPhoto(photo.localUri, entry.id, versionId ?? 'legacy', owner);
        if (localUri !== photo.localUri || versionId !== (photo.versionId ?? null)) changed = true;
        next.push({ ...entry, photo: { ...photo, localUri, versionId } });
      }
      if (changed) {
        set({ entries: next });
        await persist(next);
      }
    },
  };
});

/** Merges set-aside entries (a signed-out account's stash) back in. */
export async function mergeJournalStash(raw: string | undefined): Promise<void> {
  if (!raw) return;
  const stashed = safeJsonParse<unknown>(raw, []);
  if (!Array.isArray(stashed)) return;
  const { merged } = mergeJournalEntries(useJournalStore.getState().entries, stashed.filter(isEntry));
  await useJournalStore.getState().replaceAll(merged);
}
