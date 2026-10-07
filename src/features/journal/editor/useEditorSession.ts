import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { localPhotoExists } from '@/services/journal/journalPhotos';
import { createUuid } from '@/services/storage/uuid';
import { useAuthStore } from '@/store/useAuthStore';
import { releaseEditorPhoto, useJournalDraftStore } from '@/store/useJournalDraftStore';

import type { JournalEntry } from '../journalModel';
import { baselineForEntry, isDirty, makeDraft, restoredFields, restoreOffer, type EditorFields, type RestoreOffer } from './editorDraft';

/** How long typing pauses before the draft is written to the device. */
export const DRAFT_DEBOUNCE_MS = 600;

type AuthSlice = { status: string; user: { id?: string } | null };
/** Same owner rule as the journal's photo folders: the signed-in user, else 'guest'. */
export const selectDraftOwner = (state: AuthSlice): string => (state.status === 'authenticated' && state.user?.id ? state.user.id : 'guest');

type Options = {
  entryId?: string;
  /** The saved entry being edited (undefined while loading / for a new memory). */
  entry: JournalEntry | undefined;
  journalLoaded: boolean;
  /** The form a NEW memory starts from (date / link pre-filled by the caller). */
  newBaseline: EditorFields;
};

/**
 * One editor visit's unsaved-writing state:
 *  - `dirty`: the form differs from the saved entry (or the blank form);
 *  - the draft is written DRAFT_DEBOUNCE_MS after typing pauses, at once
 *    when the app goes to the background, and when the screen unmounts;
 *  - drafts are read and written only for the owner the visit started
 *    with; once the signed-in account changes, `ownerChanged` is true and
 *    nothing more is written or shown.
 */
export function useEditorSession({ entryId, entry, journalLoaded, newBaseline }: Options) {
  const liveOwner = useAuthStore(selectDraftOwner as (state: unknown) => string);
  const [owner] = useState(liveOwner);
  const ownerChanged = liveOwner !== owner;
  const target = entryId ?? 'new';
  const draftsLoaded = useJournalDraftStore((state) => state.isLoaded);

  const [fields, setFields] = useState<EditorFields>(newBaseline);
  const [newEntryId, setNewEntryId] = useState(() => createUuid());
  const [phase, setPhase] = useState<'checking' | 'offer' | 'ready'>('checking');
  const [offer, setOffer] = useState<RestoreOffer | null>(null);

  const baseline = useMemo(() => (entry ? baselineForEntry(entry) : newBaseline), [entry, newBaseline]);
  const dirty = isDirty(fields, baseline);

  const hydratedFrom = useRef<JournalEntry | null>(null);
  const baseVersion = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const blocked = useRef(false);
  const temps = useRef(new Set<string>());
  const latest = useRef({ fields, baseline, newEntryId, ownerChanged });
  latest.current = { fields, baseline, newEntryId, ownerChanged };

  useEffect(() => {
    void useJournalDraftStore.getState().load();
  }, []);

  // Show the saved entry - and follow it (e.g. a sync) while nothing is edited.
  useEffect(() => {
    if (!entry || entry === hydratedFrom.current) return;
    const previous = hydratedFrom.current;
    // Unsaved edits are never overwritten (unless they now equal what's saved).
    if (previous && isDirty(latest.current.fields, baselineForEntry(previous)) && isDirty(latest.current.fields, baselineForEntry(entry))) return;
    hydratedFrom.current = entry;
    baseVersion.current = entry.updatedAt;
    setFields(baselineForEntry(entry));
  }, [entry]);

  // Once everything is loaded: is there unfinished writing to offer?
  useEffect(() => {
    if (phase !== 'checking' || !journalLoaded || !draftsLoaded || ownerChanged) return;
    if (entryId && entry && hydratedFrom.current !== entry) return;
    const store = useJournalDraftStore.getState();
    const draft = store.get(owner, target);
    const found = restoreOffer(draft, baseline, entry ?? null);
    if (found) {
      setOffer(found);
      setPhase('offer');
      return;
    }
    // Identical to what's saved: nothing to keep. (A draft whose entry isn't
    // here - not synced yet, or deleted - is left alone, still private.)
    if (draft && (entry || !entryId)) void store.remove(owner, target);
    setPhase('ready');
  }, [phase, journalLoaded, draftsLoaded, ownerChanged, entryId, entry, owner, target, baseline]);

  const write = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    // Never under another account - even if this screen is still mounted.
    if (blocked.current || latest.current.ownerChanged || selectDraftOwner(useAuthStore.getState() as AuthSlice) !== owner) return;
    const store = useJournalDraftStore.getState();
    const { fields: current, baseline: base, newEntryId: id } = latest.current;
    if (isDirty(current, base)) await store.put(owner, makeDraft(target, entryId ?? id, current, entryId ? baseVersion.current : null));
    else if (store.get(owner, target)) await store.remove(owner, target);
  }, [owner, target, entryId]);

  // Debounced autosave while the visit is "ready" (not while a restore is undecided).
  useEffect(() => {
    if (phase !== 'ready' || blocked.current || ownerChanged) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void write(), DRAFT_DEBOUNCE_MS);
  }, [fields, baseline, phase, ownerChanged, write]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active' && timer.current) void write();
    });
    return () => subscription.remove();
  }, [write]);

  // Leaving by any path: the pending write lands first, then unused temp photos go.
  useEffect(
    () => () => {
      const pending = timer.current ? write() : Promise.resolve();
      void pending.finally(() => temps.current.forEach((uri) => releaseEditorPhoto(uri)));
    },
    [write],
  );

  useEffect(() => {
    if (!ownerChanged) return;
    blocked.current = true;
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }, [ownerChanged]);

  return {
    owner,
    ownerChanged,
    fields,
    setFields,
    baseline,
    dirty,
    /** Pre-allocated id for a new memory (a restored draft keeps its own). */
    newEntryId,
    phase,
    offer,
    /** A picture the editor made in the temp cache - released when nothing references it. */
    trackTemp: (uri: string | null) => {
      if (uri) temps.current.add(uri);
    },
    restore: (): { photoLost: boolean } => {
      if (!offer) return { photoLost: false };
      const result = restoredFields(offer.draft, baseline, localPhotoExists);
      if (!entryId) setNewEntryId(offer.draft.entryId);
      baseVersion.current = offer.draft.baseUpdatedAt;
      if (offer.draft.fields.photoUri) temps.current.add(offer.draft.fields.photoUri);
      setFields(result.fields);
      setOffer(null);
      setPhase('ready');
      return result;
    },
    discardOffer: async () => {
      setOffer(null);
      setPhase('ready');
      await useJournalDraftStore.getState().remove(owner, target);
    },
    /** Writes the draft now (e.g. right after a failed save). */
    flush: () => write(),
    /** While saving: no autosave may race the save. */
    pause: () => {
      blocked.current = true;
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
    },
    resume: () => {
      if (!latest.current.ownerChanged) blocked.current = false;
    },
    /** Saved or discarded: the draft and its temp photos go. Pass `keepEditing`
     * to continue in the same visit (an edit saved, then edited again). */
    finish: async ({ resetTo, keepEditing = false }: { resetTo?: EditorFields; keepEditing?: boolean } = {}) => {
      blocked.current = true;
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
      if (resetTo) setFields(resetTo);
      await useJournalDraftStore.getState().remove(owner, target);
      temps.current.forEach((uri) => releaseEditorPhoto(uri));
      temps.current.clear();
      if (keepEditing && !latest.current.ownerChanged) blocked.current = false;
    },
  };
}
