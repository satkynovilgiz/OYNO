import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

import { MAX_SCRAPBOOKS, normalizeScrapbook, type Scrapbook } from '@/features/scrapbook/scrapbookModel';
import { createSerialQueue } from '@/services/storage/serialWrites';

/**
 * Cultural Scrapbooks - private METADATA only (title, ordered references,
 * captions), on this device per owner. Serialized + write-first: computed
 * from the latest state inside the queue, written, then published. A
 * failed write changes nothing (false). Load errors block writes (Retry).
 */
export const SCRAPBOOKS_KEY = 'oyno.scrapbooks.v1';
type Saved = Record<string, Scrapbook[]>;
const queue = createSerialQueue();

type State = {
  status: 'idle' | 'loading' | 'ready' | 'error';
  saved: Saved;
  load: () => Promise<void>;
  retryLoad: () => Promise<void>;
  save: (owner: string, book: Scrapbook) => Promise<boolean>;
  remove: (owner: string, id: string) => Promise<boolean>;
};

export const ownerScrapbooks = (saved: Saved, owner: string): Scrapbook[] => (Array.isArray(saved[owner]) ? saved[owner].flatMap((raw) => normalizeScrapbook(raw) ?? []) : []);
export const ownerScrapbook = (saved: Saved, owner: string, id: string) => ownerScrapbooks(saved, owner).find((book) => book.id === id) ?? null;

export const useScrapbookStore = create<State>((set, get) => {
  const mutate = (owner: string, change: (list: Scrapbook[]) => Scrapbook[] | null, unchanged: boolean) =>
    queue(async () => {
      if (get().status !== 'ready') return false;
      const next = change(ownerScrapbooks(get().saved, owner));
      if (next === null) return unchanged;
      try {
        await AsyncStorage.setItem(SCRAPBOOKS_KEY, JSON.stringify({ ...get().saved, [owner]: next }));
      } catch {
        return false;
      }
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
        raw = await AsyncStorage.getItem(SCRAPBOOKS_KEY);
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
    save: (owner, book) =>
      mutate(owner, (list) => {
        const exists = list.some((entry) => entry.id === book.id);
        if (!exists && list.length >= MAX_SCRAPBOOKS) return null;
        return exists ? list.map((entry) => (entry.id === book.id ? book : entry)) : [book, ...list];
      }, false),
    remove: (owner, id) => mutate(owner, (list) => (list.some((entry) => entry.id === id) ? list.filter((entry) => entry.id !== id) : null), true),
  };
});
