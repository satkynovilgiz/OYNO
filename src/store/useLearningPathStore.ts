import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

import { safeJsonParse } from '@/services/storage/safeJson';

export const LEARNING_PATH_KEY = 'oyno.learningPaths.v1';

/** pathId -> stepId -> completedAt (ISO). ONLY for steps without a real
 * completion signal ("Mark step complete"); everything else is derived. */
export type ManualSteps = Record<string, Record<string, string>>;
type Saved = Record<string, ManualSteps>;
const EMPTY: ManualSteps = {};

export function ownerManualSteps(saved: Saved, owner: string): ManualSteps {
  return saved[owner] ?? EMPTY;
}

/** Pure: guest -> account (union; earliest completion kept). */
export function mergeManualSteps(into: ManualSteps, from: ManualSteps): ManualSteps {
  const merged: ManualSteps = { ...into };
  for (const [pathId, steps] of Object.entries(from)) {
    const current = { ...(merged[pathId] ?? {}) };
    for (const [stepId, at] of Object.entries(steps)) if (!current[stepId] || at < current[stepId]) current[stepId] = at;
    merged[pathId] = current;
  }
  return merged;
}

type State = {
  isLoaded: boolean;
  saved: Saved;
  load: () => Promise<void>;
  setManual: (owner: string, pathId: string, stepId: string, completed: boolean) => void;
  /** Private Cloud Sync: the merged account state (null = forget this owner on this device). */
  applySynced: (owner: string, data: ManualSteps | null) => void;
  adoptGuest: (userId: string) => void;
};

/** Learning Path manual step completions - on this device, per owner. */
export const useLearningPathStore = create<State>((set, get) => {
  const persist = () => void AsyncStorage.setItem(LEARNING_PATH_KEY, JSON.stringify(get().saved)).catch(() => undefined);
  return {
    isLoaded: false,
    saved: {},
    load: async () => {
      if (get().isLoaded) return;
      const raw = await AsyncStorage.getItem(LEARNING_PATH_KEY).catch(() => null);
      const parsed = safeJsonParse<Saved>(raw, {});
      set({ saved: parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}, isLoaded: true });
    },
    setManual: (owner, pathId, stepId, completed) => {
      const mine = ownerManualSteps(get().saved, owner);
      const steps = { ...(mine[pathId] ?? {}) };
      if (completed) steps[stepId] = steps[stepId] ?? new Date().toISOString();
      else delete steps[stepId];
      set({ saved: { ...get().saved, [owner]: { ...mine, [pathId]: steps } } });
      persist();
    },
    applySynced: (owner, data) => {
      const saved = { ...get().saved };
      if (data) saved[owner] = data;
      else delete saved[owner];
      set({ saved });
      persist();
    },
    adoptGuest: (userId) => {
      const guest = get().saved.guest;
      if (!guest || userId === 'guest') return;
      const saved = { ...get().saved, [userId]: mergeManualSteps(ownerManualSteps(get().saved, userId), guest) };
      delete saved.guest;
      set({ saved });
      persist();
    },
  };
});
