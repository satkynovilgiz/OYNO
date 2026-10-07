import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

import { addBookmark, EMPTY_LISTENING, mergeListening, recordListening, removeBookmark, type AudioBookmark, type ListeningData, type ListeningRecord } from '@/features/listening/listeningModel';
import { safeJsonParse } from '@/services/storage/safeJson';

export const LISTENING_KEY = 'oyno.listening.v1';

type Saved = Record<string, ListeningData>;

export function ownerListening(saved: Saved, owner: string): ListeningData {
  return saved[owner] ?? EMPTY_LISTENING;
}

type State = {
  isLoaded: boolean;
  saved: Saved;
  load: () => Promise<void>;
  record: (owner: string, input: Omit<ListeningRecord, 'key' | 'lastListenedAt'> & { at: string }) => void;
  addBookmark: (owner: string, input: Omit<AudioBookmark, 'id' | 'createdAt'>) => AudioBookmark;
  removeBookmark: (owner: string, id: string) => void;
  /** Private Cloud Sync: the merged account state (null = forget this owner on this device). */
  applySynced: (owner: string, data: ListeningData | null) => void;
  adoptGuest: (userId: string) => void;
};

let persistTimer: ReturnType<typeof setTimeout> | null = null;

/** Private listening history + bookmarks - on this device, per owner. */
export const useListeningStore = create<State>((set, get) => {
  const persistSoon = () => {
    if (persistTimer) clearTimeout(persistTimer);
    persistTimer = setTimeout(() => {
      persistTimer = null;
      void AsyncStorage.setItem(LISTENING_KEY, JSON.stringify(get().saved)).catch(() => undefined);
    }, 500);
  };
  const update = (owner: string, next: ListeningData) => {
    if (next === ownerListening(get().saved, owner)) return;
    set({ saved: { ...get().saved, [owner]: next } });
    persistSoon();
  };
  return {
    isLoaded: false,
    saved: {},
    load: async () => {
      if (get().isLoaded) return;
      const raw = await AsyncStorage.getItem(LISTENING_KEY).catch(() => null);
      // A load that finishes late never overwrites a store already loaded (and written) meanwhile.
      if (get().isLoaded) return;
      const parsed = safeJsonParse<Saved>(raw, {});
      set({ saved: parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}, isLoaded: true });
    },
    record: (owner, input) => update(owner, recordListening(ownerListening(get().saved, owner), input)),
    addBookmark: (owner, input) => {
      const result = addBookmark(ownerListening(get().saved, owner), input);
      update(owner, result.data);
      return result.bookmark;
    },
    removeBookmark: (owner, id) => update(owner, removeBookmark(ownerListening(get().saved, owner), id)),
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
      const saved = { ...get().saved, [userId]: mergeListening(ownerListening(get().saved, userId), guest) };
      delete saved.guest;
      set({ saved });
      persistSoon();
    },
  };
});
