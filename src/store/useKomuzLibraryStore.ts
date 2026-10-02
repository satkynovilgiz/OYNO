import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

import { addRecent, toggleId } from '@/features/culture/komuz/listening/komuzQueue';
import { safeJsonParse } from '@/services/storage/safeJson';

export const KOMUZ_LIBRARY_KEY = 'oyno.komuzLibrary.v1';

export type KomuzLibrary = { favorites: string[]; recent: string[] };
export const EMPTY_LIBRARY: KomuzLibrary = { favorites: [], recent: [] };

type Saved = Record<string, KomuzLibrary>;

export function ownerLibrary(saved: Saved, owner: string): KomuzLibrary {
  return saved[owner] ?? EMPTY_LIBRARY;
}

/** Pure: guest's favorites/recents joining an account (union; account's
 * recents first, capped). */
export function mergeLibrary(into: KomuzLibrary, from: KomuzLibrary): KomuzLibrary {
  let recent = [...into.recent];
  for (const id of [...from.recent].reverse()) if (!recent.includes(id)) recent = [...recent, id];
  return { favorites: [...new Set([...into.favorites, ...from.favorites])], recent: recent.slice(0, 5) };
}

type State = {
  isLoaded: boolean;
  saved: Saved;
  load: () => Promise<void>;
  toggleFavorite: (owner: string, trackId: string) => void;
  markListened: (owner: string, trackId: string) => void;
  adoptGuest: (userId: string) => void;
};

/** Komuz track favorites + recently listened - track-specific (not the
 * content Favorites), on this device, per account owner. */
export const useKomuzLibraryStore = create<State>((set, get) => {
  const persist = () => void AsyncStorage.setItem(KOMUZ_LIBRARY_KEY, JSON.stringify(get().saved)).catch(() => undefined);
  const update = (owner: string, change: (library: KomuzLibrary) => KomuzLibrary) => {
    set({ saved: { ...get().saved, [owner]: change(ownerLibrary(get().saved, owner)) } });
    persist();
  };
  return {
    isLoaded: false,
    saved: {},
    load: async () => {
      if (get().isLoaded) return;
      const raw = await AsyncStorage.getItem(KOMUZ_LIBRARY_KEY).catch(() => null);
      const parsed = safeJsonParse<Saved>(raw, {});
      set({ saved: parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}, isLoaded: true });
    },
    toggleFavorite: (owner, trackId) => update(owner, (library) => ({ ...library, favorites: toggleId(library.favorites, trackId) })),
    markListened: (owner, trackId) => update(owner, (library) => ({ ...library, recent: addRecent(library.recent, trackId) })),
    adoptGuest: (userId) => {
      const guest = get().saved.guest;
      if (!guest || userId === 'guest') return;
      const saved = { ...get().saved, [userId]: mergeLibrary(ownerLibrary(get().saved, userId), guest) };
      delete saved.guest;
      set({ saved });
      persist();
    },
  };
});
