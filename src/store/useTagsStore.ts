import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

import { applyTagChange, normalizeTags, type OwnerTags, type TagChange } from '@/features/tags/tagsModel';
import { createSerialQueue } from '@/services/storage/serialWrites';

/**
 * Theme tags, on this device per owner (not synced, not in backups).
 * Serialized, write-first: a change is computed from the latest state,
 * written, then shown; false = not saved (or not allowed). An unreadable
 * load blocks writes (Retry).
 */
export const TAGS_KEY = 'oyno.tags.v1';
type Saved = Record<string, OwnerTags>;
const queue = createSerialQueue();

type State = {
  status: 'idle' | 'loading' | 'ready' | 'error';
  saved: Saved;
  load: () => Promise<void>;
  retryLoad: () => Promise<void>;
  change: (owner: string, change: TagChange) => Promise<boolean>;
};

export const ownerTags = (saved: Saved, owner: string): OwnerTags => normalizeTags(saved[owner]);

export const useTagsStore = create<State>((set, get) => ({
  status: 'idle',
  saved: {},
  load: async () => {
    if (get().status === 'ready' || get().status === 'loading') return;
    set({ status: 'loading' });
    let raw: string | null;
    try {
      raw = await AsyncStorage.getItem(TAGS_KEY);
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
      const current = ownerTags(get().saved, owner);
      const next = applyTagChange(current, change);
      if (next === current) return false;
      try {
        await AsyncStorage.setItem(TAGS_KEY, JSON.stringify({ ...get().saved, [owner]: next }));
      } catch {
        return false;
      }
      set({ saved: { ...get().saved, [owner]: next } });
      return true;
    }),
}));
