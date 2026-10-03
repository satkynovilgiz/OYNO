import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

import { markRead, mergeReading, recordPosition, resetReading, type ReadingContentType, type ReadingData } from '@/features/culture/reading/readingModel';
import { safeJsonParse } from '@/services/storage/safeJson';

export const READING_KEY = 'oyno.reading.v1';

type Saved = Record<string, ReadingData>;
const EMPTY: ReadingData = {};

export function ownerReading(saved: Saved, owner: string): ReadingData {
  return saved[owner] ?? EMPTY;
}

type State = {
  isLoaded: boolean;
  saved: Saved;
  load: () => Promise<void>;
  record: (owner: string, contentType: ReadingContentType, contentId: string, ratio: number) => void;
  markRead: (owner: string, contentType: ReadingContentType, contentId: string) => void;
  reset: (owner: string, contentType: ReadingContentType, contentId: string) => void;
  /** Private Cloud Sync: the merged account state (null = forget this owner on this device). */
  applySynced: (owner: string, data: ReadingData | null) => void;
  adoptGuest: (userId: string) => void;
};

let persistTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Private reading progress - ON THIS DEVICE per account owner (v1, not
 * synced). Local writes only, so it keeps working offline. Scroll updates
 * are persisted with a short debounce (no write per frame).
 */
export const useReadingStore = create<State>((set, get) => {
  const persistSoon = () => {
    if (persistTimer) clearTimeout(persistTimer);
    persistTimer = setTimeout(() => {
      persistTimer = null;
      void AsyncStorage.setItem(READING_KEY, JSON.stringify(get().saved)).catch(() => undefined);
    }, 400);
  };
  const update = (owner: string, change: (data: ReadingData) => ReadingData) => {
    const current = ownerReading(get().saved, owner);
    const next = change(current);
    if (next === current) return;
    set({ saved: { ...get().saved, [owner]: next } });
    persistSoon();
  };
  return {
    isLoaded: false,
    saved: {},
    load: async () => {
      if (get().isLoaded) return;
      const raw = await AsyncStorage.getItem(READING_KEY).catch(() => null);
      const parsed = safeJsonParse<Saved>(raw, {});
      set({ saved: parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}, isLoaded: true });
    },
    record: (owner, contentType, contentId, ratio) => update(owner, (data) => recordPosition(data, contentType, contentId, ratio)),
    markRead: (owner, contentType, contentId) => update(owner, (data) => markRead(data, contentType, contentId)),
    reset: (owner, contentType, contentId) => update(owner, (data) => resetReading(data, contentType, contentId)),
    applySynced: (owner, data) => {
      const saved = { ...get().saved };
      if (data) saved[owner] = data;
      else delete saved[owner];
      set({ saved });
      persistSoon();
    },
    adoptGuest: (userId) => {
      const guest = get().saved.guest;
      if (!guest || userId === 'guest') return;
      const saved = { ...get().saved, [userId]: mergeReading(ownerReading(get().saved, userId), guest) };
      delete saved.guest;
      set({ saved });
      persistSoon();
    },
  };
});
