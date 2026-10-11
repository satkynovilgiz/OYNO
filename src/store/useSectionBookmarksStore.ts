import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

import { createSerialQueue } from '@/services/storage/serialWrites';
import { normalizeBookmarks, removeBookmark, upsertBookmark, type Bookmarks, type SectionBookmark } from '@/features/culture/reading/sectionBookmarks';

/**
 * Reading Companion section bookmarks + notes, on this device per owner.
 * Writes go to storage FIRST and are shown only after they succeed (false
 * = nothing changed, the screen keeps the note for Retry). A failed or
 * unreadable load is an error state - never "no bookmarks" - and blocks
 * writes so stored notes can't be overwritten.
 */
export const SECTION_BOOKMARKS_KEY = 'oyno.sectionBookmarks.v1';
type Saved = Record<string, Bookmarks>;
export type BookmarkLoadStatus = 'idle' | 'loading' | 'ready' | 'error';

type State = {
  status: BookmarkLoadStatus;
  saved: Saved;
  load: () => Promise<void>;
  retryLoad: () => Promise<void>;
  save: (owner: string, input: Parameters<typeof upsertBookmark>[1]) => Promise<boolean>;
  remove: (owner: string, key: string) => Promise<boolean>;
};

/** Serializes every write to SECTION_BOOKMARKS_KEY (all owners share that one object). */
const queue = createSerialQueue();

export const ownerBookmarks = (saved: Saved, owner: string): Bookmarks => normalizeBookmarks(saved[owner]);
export const ownerBookmark = (saved: Saved, owner: string, key: string): SectionBookmark | null => ownerBookmarks(saved, owner)[key] ?? null;

export const useSectionBookmarksStore = create<State>((set, get) => {
  /**
   * Every mutation goes through ONE queue for this storage key: the change
   * is computed from the LATEST state inside the queue, written, and only
   * then published. `change` returns null for "nothing to do".
   */
  const mutate = (owner: string, change: (current: Bookmarks) => Bookmarks | null, onNoChange: boolean) =>
    queue(async () => {
      if (get().status !== 'ready') return false;
      const current = ownerBookmarks(get().saved, owner);
      const next = change(current);
      if (next === null || next === current) return onNoChange;
      const saved = { ...get().saved, [owner]: next };
      try {
        await AsyncStorage.setItem(SECTION_BOOKMARKS_KEY, JSON.stringify(saved));
      } catch {
        return false;
      }
      // Publish only this owner's change on top of whatever is current now (other owners untouched).
      set({ saved: { ...get().saved, [owner]: next } });
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
        raw = await AsyncStorage.getItem(SECTION_BOOKMARKS_KEY);
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
    save: (owner, input) =>
      mutate(owner, (current) => {
        const next = upsertBookmark(current, input);
        return next === current ? null : next;
      }, false),
    remove: (owner, key) => mutate(owner, (current) => removeBookmark(current, key), true),
  };
});
