import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

import { parseStoredDraft, type DraftTarget, type EditorDraft } from '@/features/journal/editor/editorDraft';
import { deleteLocalPhoto, isDraftPhoto, isInOwnerFolder, keepDraftPhoto, keepLocalPhoto, sanitizeOwner } from '@/services/journal/journalPhotos';
import { deleteTempImage } from '@/services/media/normalizeImage';
import { safeJsonParse } from '@/services/storage/safeJson';
import { createUuid } from '@/services/storage/uuid';
import { registerAccountClearHandler } from '@/services/sync/accountScope';

import { registerEntryRemovedListener, useJournalStore } from './useJournalStore';

export const JOURNAL_DRAFTS_KEY = 'oyno.journal.drafts.v1';

type Saved = Record<string, Record<DraftTarget, EditorDraft>>;

type State = {
  isLoaded: boolean;
  saved: Saved;
  load: () => Promise<void>;
  /** The owner's draft for one target - never another owner's. */
  get: (owner: string, target: DraftTarget) => EditorDraft | null;
  /**
   * Writes (replaces) the owner's draft for `draft.target`. A temporary
   * photo is copied into the OWNER's journal folder first, so the draft
   * owns its picture (it survives the OS clearing temp files, and is
   * removed with that owner's files). False = not stored.
   */
  put: (owner: string, draft: EditorDraft) => Promise<boolean>;
  /** Removes one draft and its photo copy / temp file (unless something else still uses it). */
  remove: (owner: string, target: DraftTarget) => Promise<void>;
  /** Account cleared on this device: that owner's drafts (and their photos) go. */
  dropOwner: (owner: string) => Promise<void>;
  /** Guest signs in: the guest's drafts (and photo copies) become the account's; an account draft for the same target wins. */
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

/**
 * Bumped when an owner's drafts are dropped. A write that started before
 * (still copying a photo, still loading) sees the change and stores
 * NOTHING - so a cleared account's writing can't reappear afterwards.
 */
const dropGeneration = new Map<string, number>();
const generationOf = (owner: string) => dropGeneration.get(owner) ?? 0;

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
  return Object.values(saved).some((drafts) => Object.values(drafts).some((draft) => draft.fields.photoUri === uri || draft.photoSource === uri));
}

/**
 * Deletes an editor photo once nothing needs it: a temp file (cache only,
 * `deleteTempImage`) or a draft's own copy in `owner`'s folder. A saved
 * entry's photo is never touched here (it isn't a draft copy, and is referenced).
 */
export function releaseEditorPhoto(uri: string | null | undefined, saved?: Saved, owner?: string): void {
  if (!uri || isJournalPhotoReferenced(uri, saved)) return;
  if (owner && isDraftPhoto(uri, owner)) deleteLocalPhoto(uri, owner);
  else deleteTempImage(uri);
}

function releaseDraftPhotos(draft: EditorDraft | undefined, owner: string, saved: Saved) {
  if (!draft) return;
  releaseEditorPhoto(draft.fields.photoUri, saved, owner);
  releaseEditorPhoto(draft.photoSource, saved, owner);
}

/**
 * Unfinished Journal writing, on this device only, per owner and target.
 * Not an account-bound key that is wiped wholesale: each owner's drafts are
 * dropped exactly when that owner's journal files are (sign-out with
 * everything synced, account deleted, another account's leftovers) and kept
 * when the owner's unsynced state is set aside for them. Either way the
 * editor only ever reads the CURRENT owner's drafts.
 *
 * Photo ownership: a saved entry owns `<entry>-<version>.jpg`; a draft owns
 * `draft-<target>-<version>.jpg`; both in the owner's folder. Cleanup only
 * removes a file nothing (no entry, no draft) references.
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
      const generation = generationOf(safe);
      await ensureLoaded();
      if (generationOf(safe) !== generation) return false;

      // The draft owns its picture: a temp pick is copied into the owner's folder.
      let stored = draft;
      const pick = draft.fields.photoUri;
      if (pick && !isInOwnerFolder(pick, safe)) {
        const previous = get().saved[safe]?.[draft.target];
        if (previous?.photoSource === pick && previous.fields.photoUri && isDraftPhoto(previous.fields.photoUri, safe)) {
          stored = { ...draft, fields: { ...draft.fields, photoUri: previous.fields.photoUri }, photoSource: pick };
        } else {
          const copy = await keepDraftPhoto(pick, safe, draft.target, createUuid());
          if (generationOf(safe) !== generation) {
            // The owner was cleared while copying: leave nothing of theirs behind.
            deleteLocalPhoto(copy, safe);
            return false;
          }
          // Copy failed (or photos unsupported): keep the temp path; restore checks it still exists.
          stored = copy ? { ...draft, fields: { ...draft.fields, photoUri: copy }, photoSource: pick } : { ...draft, photoSource: null };
        }
      } else stored = { ...draft, photoSource: null };

      const previous = get().saved[safe]?.[stored.target];
      const saved = { ...get().saved, [safe]: { ...get().saved[safe], [stored.target]: stored } };
      set({ saved });
      const ok = await persist(saved);
      // Replaced photos that nothing points at any more go.
      if (previous && previous.fields.photoUri !== stored.fields.photoUri) releaseDraftPhotos(previous, safe, get().saved);
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
      releaseDraftPhotos(previous, safe, get().saved);
    },

    dropOwner: async (owner) => {
      const safe = sanitizeOwner(owner);
      if (!safe) return;
      dropGeneration.set(safe, generationOf(safe) + 1);
      await ensureLoaded();
      const drafts = get().saved[safe];
      if (!drafts) return;
      const saved = { ...get().saved };
      delete saved[safe];
      set({ saved });
      await persist(saved);
      for (const draft of Object.values(drafts)) releaseDraftPhotos(draft, safe, get().saved);
    },

    adoptGuest: async (userId) => {
      const safe = sanitizeOwner(userId);
      if (!safe || safe === 'guest') return;
      await ensureLoaded();
      const guest = get().saved.guest;
      if (!guest) return;
      const own = get().saved[safe] ?? {};
      const adopted: Record<DraftTarget, EditorDraft> = {};
      for (const [target, draft] of Object.entries(guest)) {
        if (own[target]) continue; // the account's own draft wins
        const photo = draft.fields.photoUri;
        if (photo && isDraftPhoto(photo, 'guest')) {
          // Moved into the account's folder (copy first, so nothing is lost).
          const moved = await keepLocalPhoto(photo, `draft-${target}`, safe, createUuid());
          if (moved) {
            deleteLocalPhoto(photo, 'guest');
            adopted[target] = { ...draft, fields: { ...draft.fields, photoUri: moved } };
            continue;
          }
        }
        adopted[target] = draft;
      }
      const saved = { ...get().saved, [safe]: { ...adopted, ...own } };
      delete saved.guest;
      set({ saved });
      await persist(saved);
      // Guest drafts the account already had one for: their photos go.
      for (const [target, draft] of Object.entries(guest)) if (own[target]) releaseDraftPhotos(draft, 'guest', get().saved);
    },
  };
});

let pendingDrop: Promise<void> = Promise.resolve();
registerAccountClearHandler((owner) => {
  // Marked dropped at once - before the queued clean-up runs - so no write can land in between.
  const safe = sanitizeOwner(owner);
  if (safe) dropGeneration.set(safe, generationOf(safe) + 1);
  pendingDrop = pendingDrop.then(() => useJournalDraftStore.getState().dropOwner(owner)).catch(() => undefined);
});

// A deleted entry's unfinished edit goes with it (whichever screen deleted it).
registerEntryRemovedListener((entryId, owner) => {
  void useJournalDraftStore.getState().remove(owner, entryId);
});

/** Tests / lifecycle: resolves once every queued owner clean-up has run. */
export function journalDraftCleanupSettled(): Promise<void> {
  return pendingDrop;
}
