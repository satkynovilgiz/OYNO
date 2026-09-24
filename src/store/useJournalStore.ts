import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

import { mergeJournalEntries, validateDraft, type JournalDraft, type JournalEntry } from '@/features/journal/journalModel';
import { deleteAllLocalPhotos, deleteLocalPhoto, keepLocalPhoto } from '@/services/journal/journalPhotos';
import { safeJsonParse } from '@/services/storage/safeJson';
import { createUuid } from '@/services/storage/uuid';
import { registerAccountBoundKeys, registerAccountClearHandler } from '@/services/sync/accountScope';
import { currentEditOrigin, requestAccountSync } from '@/services/sync/syncTrigger';

export const JOURNAL_STORAGE_KEY = 'oyno.journal.v1';

// Private, account-bound: cleared (with its photo files) on sign-out.
registerAccountBoundKeys([JOURNAL_STORAGE_KEY]);
registerAccountClearHandler(deleteAllLocalPhotos);

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
};

async function persist(entries: JournalEntry[]) {
  await AsyncStorage.setItem(JOURNAL_STORAGE_KEY, JSON.stringify(entries)).catch(() => {});
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
    if (!photoUri) {
      deleteLocalPhoto(previous?.localUri);
      return null;
    }
    if (previous?.localUri === photoUri) return previous;
    const localUri = await keepLocalPhoto(photoUri, entryId);
    if (!localUri) return previous;
    deleteLocalPhoto(previous?.localUri);
    // A new picture: the cloud copy (same path) is replaced on next sync.
    return { localUri, remotePath: null };
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
        updatedAt: new Date().toISOString(),
      };
      await commit(get().entries.map((entry) => (entry.id === id ? updated : entry)));
      return updated;
    },

    remove: async (id) => {
      const existing = get().entries.find((entry) => entry.id === id);
      if (!existing) return;
      deleteLocalPhoto(existing.photo?.localUri);
      // A guest's entry never left the device: delete it outright. An
      // account's entry becomes an empty tombstone so the deletion reaches
      // the user's other phones (the private text is wiped immediately).
      const next =
        currentEditOrigin() === 'guest'
          ? get().entries.filter((entry) => entry.id !== id)
          : get().entries.map((entry) =>
              entry.id === id
                ? { ...entry, title: '', note: '', link: null, photo: existing.photo?.remotePath ? { localUri: null, remotePath: existing.photo.remotePath } : null, updatedAt: new Date().toISOString(), deletedAt: new Date().toISOString() }
                : entry,
            );
      await commit(next);
    },

    replaceAll: async (entries) => {
      set({ entries, isLoaded: true });
      await persist(entries);
    },

    reset: () => set({ entries: [], isLoaded: true }),
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
