import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

import { MAX_CAPSULES, normalizeCapsule, type Capsule } from '@/features/capsules/capsuleModel';

/**
 * Culture Time Capsules, on this device, per owner ('guest' or account
 * id). Not synced, not in the learning-data export.
 *
 * Writes are explicit: the new list is written to storage FIRST and only
 * then shown; a failed write returns false and changes nothing (the screen
 * keeps the draft and offers Retry). A failed or unreadable load is an
 * error state - never treated as "no capsules", so it can't be saved over.
 */
export const CAPSULES_KEY = 'oyno.timeCapsules.v1';

type Saved = Record<string, Capsule[]>;
export type LoadStatus = 'idle' | 'loading' | 'ready' | 'error';

type State = {
  status: LoadStatus;
  saved: Saved;
  load: () => Promise<void>;
  /** Creates or replaces one of this owner's capsules. */
  save: (owner: string, capsule: Capsule) => Promise<boolean>;
  remove: (owner: string, id: string) => Promise<boolean>;
};

/** The owner's capsules (re-checked on read). Another owner's are never returned. */
export function ownerCapsules(saved: Saved, owner: string): Capsule[] {
  const list = saved[owner];
  return Array.isArray(list) ? list.flatMap((raw) => normalizeCapsule(raw) ?? []) : [];
}
export const ownerCapsule = (saved: Saved, owner: string, id: string) => ownerCapsules(saved, owner).find((capsule) => capsule.id === id) ?? null;

export const useCapsuleStore = create<State>((set, get) => {
  const write = async (next: Saved) => {
    if (get().status !== 'ready') return false;
    try {
      await AsyncStorage.setItem(CAPSULES_KEY, JSON.stringify(next));
    } catch {
      return false;
    }
    set({ saved: next });
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
        raw = await AsyncStorage.getItem(CAPSULES_KEY);
      } catch {
        set({ status: 'error' });
        return;
      }
      if (raw === null) {
        set({ saved: {}, status: 'ready' });
        return;
      }
      try {
        const parsed = JSON.parse(raw) as unknown;
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('shape');
        set({ saved: parsed as Saved, status: 'ready' });
      } catch {
        // Unreadable data stays on the device untouched; the screen explains and offers Retry.
        set({ status: 'error' });
      }
    },
    save: async (owner, capsule) => {
      const list = ownerCapsules(get().saved, owner);
      const exists = list.some((entry) => entry.id === capsule.id);
      if (!exists && list.length >= MAX_CAPSULES) return false;
      const nextList = exists ? list.map((entry) => (entry.id === capsule.id ? capsule : entry)) : [capsule, ...list];
      return write({ ...get().saved, [owner]: nextList });
    },
    remove: async (owner, id) => {
      const list = ownerCapsules(get().saved, owner);
      if (!list.some((entry) => entry.id === id)) return true;
      return write({ ...get().saved, [owner]: list.filter((entry) => entry.id !== id) });
    },
  };
});
