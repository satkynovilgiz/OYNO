import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

import { DEFAULT_READER_SETTINGS, sanitizeSettings, type ReaderSettings } from '@/features/culture/reader/readerSettings';
import { safeJsonParse } from '@/services/storage/safeJson';

export const READER_SETTINGS_KEY = 'oyno.readerSettings.v1';

type State = ReaderSettings & {
  isLoaded: boolean;
  load: () => Promise<void>;
  update: (patch: Partial<ReaderSettings>) => void;
  reset: () => void;
};

/** Device display preferences for long-form reading - one set for every
 * supported article (not per article, not per account). */
export const useReaderSettingsStore = create<State>((set, get) => {
  const persist = () => {
    const { textSize, lineSpacing, focusMode } = get();
    void AsyncStorage.setItem(READER_SETTINGS_KEY, JSON.stringify({ textSize, lineSpacing, focusMode })).catch(() => undefined);
  };
  return {
    ...DEFAULT_READER_SETTINGS,
    isLoaded: false,
    load: async () => {
      if (get().isLoaded) return;
      const raw = await AsyncStorage.getItem(READER_SETTINGS_KEY).catch(() => null);
      set({ ...sanitizeSettings(safeJsonParse<unknown>(raw, {})), isLoaded: true });
    },
    update: (patch) => {
      set(sanitizeSettings({ ...get(), ...patch }));
      persist();
    },
    reset: () => {
      set({ ...DEFAULT_READER_SETTINGS });
      persist();
    },
  };
});
