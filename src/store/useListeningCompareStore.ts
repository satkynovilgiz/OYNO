import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

import { MAX_COMPARISONS, newComparison, normalizeComparisons, setMoment, setNote, type Comparison, type Comparisons, type SavedMoment, type Side } from '@/features/culture/komuz/listening/compareModel';
import { createSerialQueue } from '@/services/storage/serialWrites';

/**
 * Listening comparisons, on this device per owner. Serialized, write-first
 * (shown only after the write succeeds; false = not saved). An unreadable
 * load blocks writes. Not synced, not in the data export.
 */
export const LISTENING_COMPARE_KEY = 'oyno.listeningCompare.v1';
type Saved = Record<string, Comparisons>;
const queue = createSerialQueue();

type State = {
  status: 'idle' | 'loading' | 'ready' | 'error';
  saved: Saved;
  load: () => Promise<void>;
  retryLoad: () => Promise<void>;
  create: (owner: string, id: string, a: { trackId: string; title: string }, b: { trackId: string; title: string }) => Promise<boolean>;
  saveMoment: (owner: string, id: string, side: Side, moment: SavedMoment) => Promise<boolean>;
  saveNote: (owner: string, id: string, note: string) => Promise<boolean>;
  remove: (owner: string, id: string) => Promise<boolean>;
};

export const ownerComparisons = (saved: Saved, owner: string): Comparisons => normalizeComparisons(saved[owner]);

export const useListeningCompareStore = create<State>((set, get) => {
  const mutate = (owner: string, change: (current: Comparisons) => Comparisons | null | 'missing', onNoChange: boolean) =>
    queue(async () => {
      if (get().status !== 'ready') return false;
      const next = change(ownerComparisons(get().saved, owner));
      if (next === 'missing') return false;
      if (next === null) return onNoChange;
      try {
        await AsyncStorage.setItem(LISTENING_COMPARE_KEY, JSON.stringify({ ...get().saved, [owner]: next }));
      } catch {
        return false;
      }
      set({ saved: { ...get().saved, [owner]: next } });
      return true;
    });
  const update = (owner: string, id: string, fn: (c: Comparison, now: string) => Comparison) =>
    mutate(owner, (current) => {
      const comparison = current[id];
      if (!comparison) return 'missing';
      const next = fn(comparison, new Date().toISOString());
      return next === comparison ? null : { ...current, [id]: next };
    }, true);
  return {
    status: 'idle',
    saved: {},
    load: async () => {
      if (get().status === 'ready' || get().status === 'loading') return;
      set({ status: 'loading' });
      let raw: string | null;
      try {
        raw = await AsyncStorage.getItem(LISTENING_COMPARE_KEY);
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
    create: (owner, id, a, b) => mutate(owner, (current) => (current[id] || Object.keys(current).length >= MAX_COMPARISONS ? 'missing' : { ...current, [id]: newComparison(id, a, b, new Date().toISOString()) }), false),
    saveMoment: (owner, id, side, moment) => update(owner, id, (c, now) => setMoment(c, side, moment, now)),
    saveNote: (owner, id, note) => update(owner, id, (c, now) => setNote(c, note, now)),
    remove: (owner, id) =>
      mutate(owner, (current) => {
        if (!current[id]) return null;
        const next = { ...current };
        delete next[id];
        return next;
      }, true),
  };
});
