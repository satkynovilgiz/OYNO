import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

import { missionById } from '@/features/games/practice/practiceMissions';
import { safeJsonParse } from '@/services/storage/safeJson';

export const PRACTICE_MISSIONS_KEY = 'oyno.practiceMissions.v1';

/** missionId -> latest completion time. Nothing else (no session copies). */
export type CompletedMissions = Record<string, string>;
type Saved = Record<string, CompletedMissions>;
const EMPTY: CompletedMissions = {};

export function ownerMissions(saved: Saved, owner: string): CompletedMissions {
  return saved[owner] ?? EMPTY;
}

type State = {
  isLoaded: boolean;
  saved: Saved;
  load: () => Promise<void>;
  complete: (owner: string, missionId: string) => void;
  reset: (owner: string) => void;
  adoptGuest: (userId: string) => void;
};

/** Practice goal completions - device-level, per owner (not cloud-synced in v1). */
export const usePracticeMissionsStore = create<State>((set, get) => {
  const persist = () => void AsyncStorage.setItem(PRACTICE_MISSIONS_KEY, JSON.stringify(get().saved)).catch(() => undefined);
  return {
    isLoaded: false,
    saved: {},
    load: async () => {
      if (get().isLoaded) return;
      const parsed = safeJsonParse<Saved>(await AsyncStorage.getItem(PRACTICE_MISSIONS_KEY).catch(() => null), {});
      set({ saved: parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}, isLoaded: true });
    },
    complete: (owner, missionId) => {
      if (!missionById(missionId)) return;
      const mine = ownerMissions(get().saved, owner);
      set({ saved: { ...get().saved, [owner]: { ...mine, [missionId]: new Date().toISOString() } } });
      persist();
    },
    reset: (owner) => {
      const saved = { ...get().saved };
      delete saved[owner];
      set({ saved });
      persist();
    },
    adoptGuest: (userId) => {
      const guest = get().saved.guest;
      if (!guest || userId === 'guest') return;
      const mine = ownerMissions(get().saved, userId);
      const merged: CompletedMissions = { ...mine };
      for (const [id, at] of Object.entries(guest)) if (!merged[id] || at > merged[id]) merged[id] = at;
      const saved = { ...get().saved, [userId]: merged };
      delete saved.guest;
      set({ saved });
      persist();
    },
  };
});
