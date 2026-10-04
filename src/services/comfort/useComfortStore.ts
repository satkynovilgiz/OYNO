import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

import { safeJsonParse } from '@/services/storage/safeJson';

import { DEFAULT_COMFORT, LARGE_MIN_TARGET, sanitizeComfort, STANDARD_MIN_TARGET, type ComfortPrefs } from './comfort';
import { writeEarlyContrast } from './earlyContrast';

export const COMFORT_KEY = 'oyno.comfort.v1';

type State = { isLoaded: boolean; prefs: ComfortPrefs; load: () => Promise<void>; update: (patch: Partial<ComfortPrefs>) => void; reset: () => void };

/** Device-level comfort preferences (no account sync, no backend). */
export const useComfortStore = create<State>((set, get) => {
  const persist = () => {
    void AsyncStorage.setItem(COMFORT_KEY, JSON.stringify(get().prefs)).catch(() => undefined);
    // Mirrored synchronously so the palette can be chosen before any screen loads.
    writeEarlyContrast(get().prefs.highContrast);
  };
  return {
    isLoaded: false,
    prefs: DEFAULT_COMFORT,
    load: async () => {
      if (get().isLoaded) return;
      const raw = await AsyncStorage.getItem(COMFORT_KEY).catch(() => null);
      set({ prefs: sanitizeComfort(safeJsonParse<unknown>(raw, null)), isLoaded: true });
    },
    update: (patch) => {
      set({ prefs: sanitizeComfort({ ...get().prefs, ...patch }) });
      persist();
    },
    // Comfort settings only: age mode, language and Reader settings are untouched.
    reset: () => {
      set({ prefs: DEFAULT_COMFORT });
      persist();
    },
  };
});

/** Non-hook read for imperative code (haptics). */
export function comfortPrefs(): ComfortPrefs {
  return useComfortStore.getState().prefs;
}

/** Minimum touch target for the current comfort setting (44 or 56). */
export function useMinTarget(): number {
  return useComfortStore((state) => (state.prefs.largerControls ? LARGE_MIN_TARGET : STANDARD_MIN_TARGET));
}
