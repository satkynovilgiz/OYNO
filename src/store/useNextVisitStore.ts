import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

import { applyQueueChange, normalizeQueue, type Queue, type QueueChange } from '@/features/nextVisit/nextVisitModel';
import { createSerialQueue } from '@/services/storage/serialWrites';

/**
 * My Next Visit, on this device per owner. Serialized, write-first: a change
 * is computed from the latest state inside the queue, written, then shown;
 * false = not saved (nothing changes on screen). An unreadable load is an
 * error state that blocks writes until Retry.
 */
export const NEXT_VISIT_KEY = 'oyno.nextVisit.v1';
type Saved = Record<string, Queue>;
const queue = createSerialQueue();

type State = {
  status: 'idle' | 'loading' | 'ready' | 'error';
  saved: Saved;
  load: () => Promise<void>;
  retryLoad: () => Promise<void>;
  /** true = saved (or nothing to change); false = not saved. */
  change: (owner: string, change: QueueChange) => Promise<boolean>;
};

export const ownerQueue = (saved: Saved, owner: string): Queue => normalizeQueue(saved[owner]);

export const useNextVisitStore = create<State>((set, get) => ({
  status: 'idle',
  saved: {},
  load: async () => {
    if (get().status === 'ready' || get().status === 'loading') return;
    set({ status: 'loading' });
    let raw: string | null;
    try {
      raw = await AsyncStorage.getItem(NEXT_VISIT_KEY);
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
  change: (owner, change) =>
    queue(async () => {
      if (get().status !== 'ready') return false;
      const current = ownerQueue(get().saved, owner);
      const next = applyQueueChange(current, change);
      if (next === current) return change.type !== 'add'; // an add that couldn't happen is "not added"
      try {
        await AsyncStorage.setItem(NEXT_VISIT_KEY, JSON.stringify({ ...get().saved, [owner]: next }));
      } catch {
        return false;
      }
      set({ saved: { ...get().saved, [owner]: next } });
      return true;
    }),
}));
