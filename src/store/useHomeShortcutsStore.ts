import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

import { applyPinChange, normalizeShortcuts, type OwnerShortcuts, type PinChange } from '@/features/home/shortcuts/shortcutsModel';
import { createSerialQueue } from '@/services/storage/serialWrites';

/**
 * Home shortcuts, on this device per owner (shortcutsModel.ts). Separate
 * from learning progress: no progress reset or sync touches this key.
 * Serialized, write-first: computed from the latest state, written, then
 * shown; false = not saved (the previous shortcuts stay). An unreadable
 * load blocks writes (Retry).
 */
export const HOME_SHORTCUTS_KEY = 'oyno.homeShortcuts.v1';
type Saved = Record<string, unknown>;
const queue = createSerialQueue();

type State = {
  status: 'idle' | 'loading' | 'ready' | 'error';
  saved: Saved;
  load: () => Promise<void>;
  retryLoad: () => Promise<void>;
  change: (owner: string, change: PinChange) => Promise<boolean>;
};

export const ownerShortcuts = (saved: Saved, owner: string): OwnerShortcuts => normalizeShortcuts(saved[owner]);

export const useHomeShortcutsStore = create<State>((set, get) => ({
  status: 'idle',
  saved: {},
  load: async () => {
    if (get().status === 'ready' || get().status === 'loading') return;
    set({ status: 'loading' });
    let raw: string | null;
    try {
      raw = await AsyncStorage.getItem(HOME_SHORTCUTS_KEY);
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
      // Keep the raw stored value for ids this version doesn't know - only `pins` is ever rewritten.
      const current = ownerShortcuts(get().saved, owner);
      const next = applyPinChange(current, change);
      if (next === current) return true;
      const saved = { ...get().saved };
      if (next === null) delete saved[owner];
      else saved[owner] = next;
      try {
        await AsyncStorage.setItem(HOME_SHORTCUTS_KEY, JSON.stringify(saved));
      } catch {
        return false;
      }
      set({ saved });
      return true;
    }),
}));
