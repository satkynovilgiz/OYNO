import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

import { mergePins, sanitizePins } from '@/features/profile/showcase/showcaseModel';
import { safeJsonParse } from '@/services/storage/safeJson';

export const SHOWCASE_KEY = 'oyno.achievementShowcase.v1';

/** owner -> pinned achievement ids (in order). Device-level (not cloud-synced in v1). */
type Saved = Record<string, string[]>;
const EMPTY: string[] = [];

export function ownerPins(saved: Saved, owner: string): string[] {
  return saved[owner] ?? EMPTY;
}

type State = {
  isLoaded: boolean;
  saved: Saved;
  load: () => Promise<void>;
  setPins: (owner: string, pins: string[]) => void;
  adoptGuest: (userId: string) => void;
};

export const useAchievementShowcaseStore = create<State>((set, get) => {
  const persist = () => void AsyncStorage.setItem(SHOWCASE_KEY, JSON.stringify(get().saved)).catch(() => undefined);
  return {
    isLoaded: false,
    saved: {},
    load: async () => {
      if (get().isLoaded) return;
      const parsed = safeJsonParse<Record<string, unknown>>(await AsyncStorage.getItem(SHOWCASE_KEY).catch(() => null), {});
      const saved: Saved = {};
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) for (const [owner, pins] of Object.entries(parsed)) saved[owner] = sanitizePins(pins);
      set({ saved, isLoaded: true });
    },
    setPins: (owner, pins) => {
      set({ saved: { ...get().saved, [owner]: sanitizePins(pins) } });
      persist();
    },
    // Guest pins join the account; ones the account hasn't earned simply
    // don't show (visiblePins) - nothing is ever shown unearned.
    adoptGuest: (userId) => {
      const guest = get().saved.guest;
      if (!guest || userId === 'guest') return;
      const saved = { ...get().saved, [userId]: mergePins(ownerPins(get().saved, userId), guest) };
      delete saved.guest;
      set({ saved });
      persist();
    },
  };
});
