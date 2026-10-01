import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

import { safeJsonParse } from '@/services/storage/safeJson';

import type { JourneyProgress } from './regionAudioJourney';

const STORAGE_KEY = 'oyno.regionAudioJourneys.v1';

/** owner ('guest' or account id) -> region id -> progress. */
type Saved = Record<string, Record<string, JourneyProgress>>;

type State = {
  isLoaded: boolean;
  saved: Saved;
  load: () => Promise<void>;
  /** The stop the listener is on (stop-level resume). */
  setCurrent: (owner: string, regionId: string, stopKey: string) => void;
  /** A stop's narration played to the end. */
  markListened: (owner: string, regionId: string, stopKey: string) => void;
};

/**
 * Listening position for Regional Audio Journeys - on this device only,
 * kept per account so one person's listening never shows for another.
 * Deliberately NOT region progress: listening completes nothing, grants
 * nothing and is never synced.
 */
export const useRegionAudioJourneyStore = create<State>((set, get) => {
  const persist = () => void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(get().saved)).catch(() => undefined);
  const update = (owner: string, regionId: string, change: (progress: JourneyProgress) => JourneyProgress) => {
    const mine = get().saved[owner] ?? {};
    const next = change(mine[regionId] ?? { current: null, listened: [] });
    set({ saved: { ...get().saved, [owner]: { ...mine, [regionId]: next } } });
    persist();
  };
  return {
    isLoaded: false,
    saved: {},
    load: async () => {
      if (get().isLoaded) return;
      const raw = await AsyncStorage.getItem(STORAGE_KEY).catch(() => null);
      const parsed = safeJsonParse<unknown>(raw, {});
      set({ saved: parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Saved) : {}, isLoaded: true });
    },
    setCurrent: (owner, regionId, stopKey) => {
      if (get().saved[owner]?.[regionId]?.current === stopKey) return;
      update(owner, regionId, (progress) => ({ ...progress, current: stopKey }));
    },
    markListened: (owner, regionId, stopKey) => {
      if (get().saved[owner]?.[regionId]?.listened.includes(stopKey)) return;
      update(owner, regionId, (progress) => ({ ...progress, listened: [...progress.listened, stopKey] }));
    },
  };
});
