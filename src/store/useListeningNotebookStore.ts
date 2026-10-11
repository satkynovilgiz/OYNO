import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

import { createSerialQueue } from '@/services/storage/serialWrites';
import { captureMoment, normalizeNotebook, removeMoment, setMomentNote, type Moment, type Notebook } from '@/features/culture/komuz/listening/notebookModel';

/**
 * Listening Notebook, on this device per owner. Writes go to storage FIRST
 * and are shown only after they succeed (false = nothing changed; the
 * screen keeps the text for Retry). An unreadable/failed load is an error
 * state that blocks writes. Not synced, not in the learning-data export.
 */
export const LISTENING_NOTEBOOK_KEY = 'oyno.listeningNotebook.v1';
type Saved = Record<string, Notebook>;

type State = {
  status: 'idle' | 'loading' | 'ready' | 'error';
  saved: Saved;
  load: () => Promise<void>;
  retryLoad: () => Promise<void>;
  capture: (owner: string, input: Parameters<typeof captureMoment>[1]) => Promise<Moment | null>;
  setNote: (owner: string, id: string, note: string) => Promise<boolean>;
  remove: (owner: string, id: string) => Promise<boolean>;
};

/** Serializes every write to LISTENING_NOTEBOOK_KEY (all owners share that one object). */
const queue = createSerialQueue();

export const ownerNotebook = (saved: Saved, owner: string): Notebook => normalizeNotebook(saved[owner]);

export const useListeningNotebookStore = create<State>((set, get) => {
  /** One queue for this key: computed from the LATEST state inside the queue, written, then published. */
  const mutate = <T,>(owner: string, change: (current: Notebook) => { next: Notebook; result: T } | null, failed: T, unchanged: T) =>
    queue(async () => {
      if (get().status !== 'ready') return failed;
      const current = ownerNotebook(get().saved, owner);
      const outcome = change(current);
      if (!outcome || outcome.next === current) return outcome ? outcome.result : unchanged;
      try {
        await AsyncStorage.setItem(LISTENING_NOTEBOOK_KEY, JSON.stringify({ ...get().saved, [owner]: outcome.next }));
      } catch {
        return failed;
      }
      set({ saved: { ...get().saved, [owner]: outcome.next } });
      return outcome.result;
    });
  return {
    status: 'idle',
    saved: {},
    load: async () => {
      if (get().status === 'ready' || get().status === 'loading') return;
      set({ status: 'loading' });
      let raw: string | null;
      try {
        raw = await AsyncStorage.getItem(LISTENING_NOTEBOOK_KEY);
      } catch {
        set({ status: 'error' });
        return;
      }
      if (raw === null) return set({ saved: {}, status: 'ready' });
      try {
        const parsed = JSON.parse(raw) as unknown;
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('shape');
        set({ saved: parsed as Saved, status: 'ready' });
      } catch {
        set({ status: 'error' });
      }
    },
    retryLoad: async () => {
      if (get().status !== 'error') return;
      set({ status: 'idle' });
      await get().load();
    },
    capture: (owner, input) =>
      mutate<Moment | null>(owner, (current) => {
        const { notebook, moment } = captureMoment(current, input);
        return moment ? { next: notebook, result: moment } : null;
      }, null, null),
    setNote: (owner, id, note) => mutate(owner, (current) => (current[id] ? { next: setMomentNote(current, id, note), result: true } : null), false, false),
    remove: (owner, id) => mutate(owner, (current) => ({ next: removeMoment(current, id), result: true }), false, true),
  };
});
