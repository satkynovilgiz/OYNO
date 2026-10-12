import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

import { markDone, NEW_RECORD, normalizeRecord, type FirstUseRecord, type FirstUseStep } from '@/features/firstUse/firstUseModel';
import { createSerialQueue } from '@/services/storage/serialWrites';

/**
 * First-use guide progress, per owner, on this device (firstUseModel.ts).
 * Serialized, write-first: computed from the latest state in the queue,
 * written, then shown. A failed or unreadable load blocks writes (Retry).
 */
export const FIRST_USE_KEY = 'oyno.firstUse.v1';
type Saved = Record<string, FirstUseRecord>;
const queue = createSerialQueue();

type State = {
  status: 'idle' | 'loading' | 'ready' | 'error';
  saved: Saved;
  load: () => Promise<void>;
  retryLoad: () => Promise<void>;
  /** After onboarding / a new profile: offer the guide on Home - only to an owner who never had it. */
  offer: (owner: string) => Promise<boolean>;
  start: (owner: string) => Promise<boolean>;
  skip: (owner: string) => Promise<boolean>;
  done: (owner: string, step: FirstUseStep, extra?: Partial<Pick<FirstUseRecord, 'saveChoice' | 'savedName'>>) => Promise<boolean>;
  /** The guest's progress continues in the account they signed in with (auth handoff). */
  adopt: (from: string, to: string) => Promise<boolean>;
};

export const recordFor = (saved: Saved, owner: string): FirstUseRecord | null => normalizeRecord(saved[owner]);

export const useFirstUseStore = create<State>((set, get) => {
  const mutate = (owner: string, change: (record: FirstUseRecord | null, saved: Saved) => FirstUseRecord | null) =>
    queue(async () => {
      if (get().status !== 'ready') return false;
      const current = recordFor(get().saved, owner);
      const next = change(current, get().saved);
      if (next === current) return true;
      const saved = { ...get().saved };
      if (next === null) delete saved[owner];
      else saved[owner] = next;
      try {
        await AsyncStorage.setItem(FIRST_USE_KEY, JSON.stringify(saved));
      } catch {
        return false;
      }
      set({ saved });
      return true;
    });
  return {
    status: 'idle',
    saved: {},
    load: async () => {
      if (get().status === 'ready' || get().status === 'loading') return;
      set({ status: 'loading' });
      let raw: string | null;
      try {
        raw = await AsyncStorage.getItem(FIRST_USE_KEY);
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
    offer: async (owner) => {
      await get().load();
      return mutate(owner, (record) => record ?? { ...NEW_RECORD, status: 'offered' });
    },
    // Start (or replay from Help): always a fresh run.
    start: (owner) => mutate(owner, () => ({ ...NEW_RECORD })),
    skip: (owner) => mutate(owner, (record) => ({ ...(record ?? NEW_RECORD), status: 'skipped' })),
    done: (owner, step, extra) => mutate(owner, (record) => (record ? markDone(record, step, new Date().toISOString(), extra) : record)),
    adopt: (from, to) =>
      mutate(to, (record, saved) => {
        const source = recordFor(saved, from);
        // Only an unfinished guest run, and never over the account's own active run.
        if (!source || source.status !== 'active' || record?.status === 'active') return record;
        return source;
      }),
  };
});
