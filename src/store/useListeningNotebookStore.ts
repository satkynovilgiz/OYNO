import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

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

export const ownerNotebook = (saved: Saved, owner: string): Notebook => normalizeNotebook(saved[owner]);

export const useListeningNotebookStore = create<State>((set, get) => {
  const write = async (owner: string, next: Notebook) => {
    if (get().status !== 'ready') return false;
    try {
      await AsyncStorage.setItem(LISTENING_NOTEBOOK_KEY, JSON.stringify({ ...get().saved, [owner]: next }));
    } catch {
      return false;
    }
    set({ saved: { ...get().saved, [owner]: next } });
    return true;
  };
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
    capture: async (owner, input) => {
      const { notebook, moment } = captureMoment(ownerNotebook(get().saved, owner), input);
      if (!moment) return null;
      return (await write(owner, notebook)) ? moment : null;
    },
    setNote: async (owner, id, note) => {
      const current = ownerNotebook(get().saved, owner);
      if (!current[id]) return false;
      return write(owner, setMomentNote(current, id, note));
    },
    remove: async (owner, id) => {
      const current = ownerNotebook(get().saved, owner);
      const next = removeMoment(current, id);
      return next === current ? true : write(owner, next);
    },
  };
});
