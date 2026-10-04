import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

import { DEFAULT_LAYOUT, sanitizeLayout, type HomeLayoutPrefs } from '@/features/home/homeLayout';
import { safeJsonParse } from '@/services/storage/safeJson';

export const HOME_LAYOUT_KEY = 'oyno.homeLayout.v1';

type State = {
  isLoaded: boolean;
  prefs: HomeLayoutPrefs;
  load: () => Promise<void>;
  set: (prefs: HomeLayoutPrefs) => void;
  reset: () => void;
};

/** Customize Home - a device-level display preference (no account sync,
 * no backend), like Appearance. */
export const useHomeLayoutStore = create<State>((set, get) => {
  const persist = () => void AsyncStorage.setItem(HOME_LAYOUT_KEY, JSON.stringify(get().prefs)).catch(() => undefined);
  return {
    isLoaded: false,
    prefs: DEFAULT_LAYOUT,
    load: async () => {
      if (get().isLoaded) return;
      const raw = await AsyncStorage.getItem(HOME_LAYOUT_KEY).catch(() => null);
      set({ prefs: sanitizeLayout(safeJsonParse<unknown>(raw, null)), isLoaded: true });
    },
    set: (prefs) => {
      set({ prefs: sanitizeLayout(prefs) });
      persist();
    },
    reset: () => {
      set({ prefs: DEFAULT_LAYOUT });
      void AsyncStorage.removeItem(HOME_LAYOUT_KEY).catch(() => undefined);
    },
  };
});
