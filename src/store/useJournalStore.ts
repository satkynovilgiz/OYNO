import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

import { mergeJournalEntries, validateDraft, type JournalDraft, type JournalEntry } from '@/features/journal/journalModel';
import { deleteTempImage } from '@/services/media/normalizeImage';
import { adoptLocalPhoto, deleteAllLocalPhotos, deleteLocalPhoto, GUEST_PHOTO_OWNER, keepLocalPhoto } from '@/services/journal/journalPhotos';
import { safeJsonParse } from '@/services/storage/safeJson';
import { createUuid } from '@/services/storage/uuid';
import { registerAccountBoundKeys, registerAccountClearHandler } from '@/services/sync/accountScope';
import { currentAccountId, currentEditOrigin, requestAccountSync } from '@/services/sync/syncTrigger';

export const JOURNAL_STORAGE_KEY = 'oyno.journal.v1';

// Private, account-bound: cleared (with THAT owner's photo folder only) on sign-out.
registerAccountBoundKeys([JOURNAL_STORAGE_KEY]);
registerAccountClearHandler((owner) => deleteAllLocalPhotos(owner));

/** Whose folder new local photos go into right now. */
export function currentPhotoOwner(): string {
  return currentAccountId() ?? GUEST_PHOTO_OWNER;
}

type JournalState = {
  isLoaded: boolean;
  /** Includes tombstones (deletedAt) - use `visibleEntries` for display. */
  entries: JournalEntry[];
  load: () => Promise<void>;
  /** Returns the new entry, or null if the draft isn't valid. */
  create: (draft: JournalDraft) => Promise<JournalEntry | null>;
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

async function persist(entries: JournalEntry[]) {
  await AsyncStorage.setItem(JOURNAL_STORAGE_KEY, JSON.stringify(entries)).catch(() => {});
}

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

  async function resolvePhoto(entryId: string, previous: JournalEntry['photo'], photoUri: string | null): Promise<JournalEntry['photo']> {
    const owner = currentPhotoOwner();
    if (!photoUri) {
      deleteLocalPhoto(previous?.localUri, owner);
      return null;
    }
    if (previous?.localUri === photoUri) return previous;
    // A new picture is a NEW immutable version: it gets its own cloud
    // object on the next sync; the previous version is never overwritten.
    const versionId = createUuid();
    const localUri = await keepLocalPhoto(photoUri, entryId, owner, versionId);
    // Copy failed: the previous photo (and its file) stay exactly as they were.
    if (!localUri) return previous;
    deleteLocalPhoto(previous?.localUri, owner);
    // The normalized temp file is now safely copied into the journal folder.
    deleteTempImage(photoUri);
    return { localUri, remotePath: null, versionId };
  }

  return {
    isLoaded: false,
    entries: [],

    load: async () => {
      const parsed = safeJsonParse<unknown>(await AsyncStorage.getItem(JOURNAL_STORAGE_KEY).catch(() => null), []);
      set({ entries: Array.isArray(parsed) ? parsed.filter(isEntry) : [], isLoaded: true });
    },

    create: async (draft) => {
      if (validateDraft(draft).length > 0) return null;
      const now = new Date().toISOString();
      const id = createUuid();
      const entry: JournalEntry = {
        id,
        title: draft.title.trim(),
        note: draft.note,
        date: draft.date,
        photo: await resolvePhoto(id, null, draft.photoUri),
        link: draft.link,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      };
      await commit([entry, ...get().entries]);
      return entry;
    },

    update: async (id, draft) => {
      const existing = get().entries.find((entry) => entry.id === id && !entry.deletedAt);
      if (!existing || validateDraft(draft).length > 0) return null;
      const updated: JournalEntry = {
        ...existing,
        title: draft.title.trim(),
        note: draft.note,
        date: draft.date,
        photo: await resolvePhoto(id, existing.photo, draft.photoUri),
        link: draft.link,
        updatedAt: nextTimestamp(existing.updatedAt),
      };
      await commit(get().entries.map((entry) => (entry.id === id ? updated : entry)));
      return updated;
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
    },

    replaceAll: async (entries) => {
      set({ entries, isLoaded: true });
      await persist(entries);
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
