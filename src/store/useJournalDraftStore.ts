import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

import { parseStoredDraft, type DraftTarget, type EditorDraft } from '@/features/journal/editor/editorDraft';
import { sanitizeOwner } from '@/services/journal/journalPhotos';
import { deleteTempImage } from '@/services/media/normalizeImage';
import { safeJsonParse } from '@/services/storage/safeJson';
import { registerAccountClearHandler } from '@/services/sync/accountScope';

import { useJournalStore } from './useJournalStore';

export const JOURNAL_DRAFTS_KEY = 'oyno.journal.drafts.v1';

type Saved = Record<string, Record<DraftTarget, EditorDraft>>;

type State = {
  isLoaded: boolean;
  saved: Saved;
  load: () => Promise<void>;
  /** The owner's draft for one target - never another owner's. */
  get: (owner: string, target: DraftTarget) => EditorDraft | null;
  /** Writes (replaces) the owner's draft for `draft.target`. False = not stored. */
  put: (owner: string, draft: EditorDraft) => Promise<boolean>;
  /** Removes one draft and its temporary photo (unless something else still uses it). */
  remove: (owner: string, target: DraftTarget) => Promise<void>;
  /** Account cleared on this device: that owner's drafts (and their temp photos) go. */
  dropOwner: (owner: string) => Promise<void>;
  /** Guest signs in: the guest's drafts become the account's (an account draft for the same target wins). */
  adoptGuest: (userId: string) => Promise<void>;
};

let writes: Promise<unknown> = Promise.resolve();

/** Writes are queued so an older snapshot can never land after a newer one. */
function persist(saved: Saved): Promise<boolean> {
  const next = writes.then(() =>
    AsyncStorage.setItem(JOURNAL_DRAFTS_KEY, JSON.stringify(saved)).then(
      () => true,
      () => false,
    ),
  );
  writes = next;
  return next;
}

function parseSaved(raw: string | null): Saved {
  const parsed = safeJsonParse<unknown>(raw, {});
  const saved: Saved = {};
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return saved;
  for (const [owner, drafts] of Object.entries(parsed as Record<string, unknown>)) {
    if (!sanitizeOwner(owner) || !drafts || typeof drafts !== 'object' || Array.isArray(drafts)) continue;
    for (const [target, value] of Object.entries(drafts as Record<string, unknown>)) {
      const draft = parseStoredDraft(value, target);
      if (draft) (saved[owner] ??= {})[target] = draft;
    }
  }
  return saved;
}

/** True while a saved entry or ANY stored draft (any owner) points at `uri`. */
export function isJournalPhotoReferenced(uri: string, saved: Saved = useJournalDraftStore.getState().saved): boolean {
  if (useJournalStore.getState().entries.some((entry) => entry.photo?.localUri === uri)) return true;
  return Object.values(saved).some((drafts) => Object.values(drafts).some((draft) => draft.fields.photoUri === uri));
}

/**
 * Deletes a temporary editor photo once nothing needs it. Only files in the
 * app's temp cache can be deleted this way (`deleteTempImage`) - a photo in
 * a journal folder (a saved entry's) is never touched here.
 */
export function releaseEditorPhoto(uri: string | null | undefined, saved?: Saved): void {
  if (!uri || isJournalPhotoReferenced(uri, saved)) return;
  deleteTempImage(uri);
}

/**
 * Unfinished Journal writing, on this device only, per owner and target.
 * Not an account-bound key that is wiped wholesale: each owner's drafts are
 * dropped exactly when that owner's journal files are (sign-out with
 * everything synced, account deleted, another account's leftovers) and kept
 * when the owner's unsynced state is set aside for them. Either way the
 * editor only ever reads the CURRENT owner's drafts.
 */
export const useJournalDraftStore = create<State>((set, get) => {
  async function ensureLoaded() {
    if (!get().isLoaded) await get().load();
  }

  return {
    isLoaded: false,
    saved: {},

    load: async () => {
      if (get().isLoaded) return;
      const raw = await AsyncStorage.getItem(JOURNAL_DRAFTS_KEY).catch(() => null);
      if (get().isLoaded) return;
      set({ saved: parseSaved(raw), isLoaded: true });
    },

    get: (owner, target) => {
      const safe = sanitizeOwner(owner);
      return safe ? (get().saved[safe]?.[target] ?? null) : null;
    },

    put: async (owner, draft) => {
      const safe = sanitizeOwner(owner);
      if (!safe) return false;
      await ensureLoaded();
      const previous = get().saved[safe]?.[draft.target];
      const saved = { ...get().saved, [safe]: { ...get().saved[safe], [draft.target]: draft } };
      set({ saved });
      const ok = await persist(saved);
      // A replaced photo that nothing points at any more is just a temp file.
      if (ok && previous?.fields.photoUri && previous.fields.photoUri !== draft.fields.photoUri) releaseEditorPhoto(previous.fields.photoUri, get().saved);
      return ok;
    },

    remove: async (owner, target) => {
      const safe = sanitizeOwner(owner);
      if (!safe) return;
      await ensureLoaded();
      const previous = get().saved[safe]?.[target];
      if (!previous) return;
      const drafts = { ...get().saved[safe] };
      delete drafts[target];
      const saved = { ...get().saved, [safe]: drafts };
      if (Object.keys(drafts).length === 0) delete saved[safe];
      set({ saved });
      await persist(saved);
      releaseEditorPhoto(previous.fields.photoUri, get().saved);
    },

    dropOwner: async (owner) => {
      const safe = sanitizeOwner(owner);
      if (!safe) return;
      await ensureLoaded();
      const drafts = get().saved[safe];
      if (!drafts) return;
      const saved = { ...get().saved };
      delete saved[safe];
      set({ saved });
      await persist(saved);
      for (const draft of Object.values(drafts)) releaseEditorPhoto(draft.fields.photoUri, get().saved);
    },

    adoptGuest: async (userId) => {
      const safe = sanitizeOwner(userId);
      if (!safe || safe === 'guest') return;
      await ensureLoaded();
      const guest = get().saved.guest;
      if (!guest) return;
      const saved = { ...get().saved, [safe]: { ...guest, ...get().saved[safe] } };
      delete saved.guest;
      set({ saved });
      await persist(saved);
    },
  };
});

let pendingDrop: Promise<void> = Promise.resolve();
registerAccountClearHandler((owner) => {
  pendingDrop = pendingDrop.then(() => useJournalDraftStore.getState().dropOwner(owner)).catch(() => undefined);
});

/** Tests / lifecycle: resolves once every queued owner clean-up has run. */
export function journalDraftCleanupSettled(): Promise<void> {
  return pendingDrop;
}
