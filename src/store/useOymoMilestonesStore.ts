import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

import { addMilestone, normalizeOwnerMilestones, removeAllFor, removeMilestone, type OwnerMilestones, type Snapshot } from '@/features/culture/oymo/milestones/milestonesModel';
import { createSerialQueue } from '@/services/storage/serialWrites';

/**
 * Oymo milestones, ON THIS DEVICE per owner and creation id - not synced,
 * not in the data export. Serialized, write-first: shown only after the
 * write succeeded. An unreadable load blocks writes (Retry).
 */
export const OYMO_MILESTONES_KEY = 'oyno.oymoMilestones.v1';
type Saved = Record<string, OwnerMilestones>;
const queue = createSerialQueue();
export type AddOutcome = 'saved' | 'failed' | 'limit' | 'size';

type State = {
  status: 'idle' | 'loading' | 'ready' | 'error';
  saved: Saved;
  load: () => Promise<void>;
  retryLoad: () => Promise<void>;
  add: (owner: string, creationId: string, snapshot: Snapshot, label: string, id: string) => Promise<AddOutcome>;
  remove: (owner: string, creationId: string, milestoneId: string) => Promise<boolean>;
  removeAll: (owner: string, creationId: string) => Promise<boolean>;
};

export const ownerMilestones = (saved: Saved, owner: string): OwnerMilestones => normalizeOwnerMilestones(saved[owner]);

export const useOymoMilestonesStore = create<State>((set, get) => {
  const write = async (owner: string, next: OwnerMilestones) => {
    try {
      await AsyncStorage.setItem(OYMO_MILESTONES_KEY, JSON.stringify({ ...get().saved, [owner]: next }));
    } catch {
      return false;
    }
    set({ saved: { ...get().saved, [owner]: next } });
    return true;
  };
  const mutate = (owner: string, change: (current: OwnerMilestones) => OwnerMilestones) =>
    queue(async () => {
      if (get().status !== 'ready') return false;
      const current = ownerMilestones(get().saved, owner);
      const next = change(current);
      if (next === current) return true;
      return write(owner, next);
    });
  return {
    status: 'idle',
    saved: {},
    load: async () => {
      if (get().status === 'ready' || get().status === 'loading') return;
      set({ status: 'loading' });
      let raw: string | null;
      try {
        raw = await AsyncStorage.getItem(OYMO_MILESTONES_KEY);
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
    add: (owner, creationId, snapshot, label, id) =>
      queue(async (): Promise<AddOutcome> => {
        if (get().status !== 'ready') return 'failed';
        const result = addMilestone(ownerMilestones(get().saved, owner), creationId, snapshot, label, new Date().toISOString(), id);
        if (!result.ok) return result.reason === 'invalid' ? 'failed' : result.reason;
        return (await write(owner, result.next)) ? 'saved' : 'failed';
      }),
    remove: (owner, creationId, milestoneId) => mutate(owner, (current) => removeMilestone(current, creationId, milestoneId)),
    removeAll: (owner, creationId) => mutate(owner, (current) => removeAllFor(current, creationId)),
  };
});
