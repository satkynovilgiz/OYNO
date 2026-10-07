import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

import { EMPTY_MISTAKES, mergeMistakes, pruneStale, recordFinishedAttempt, recordReviewAnswer, type MistakesData } from '@/features/challenges/mistakes/mistakesModel';
import { safeJsonParse } from '@/services/storage/safeJson';

export const CHALLENGE_MISTAKES_KEY = 'oyno.challengeMistakes.v1';

/** owner ('guest' or account id) -> that owner's mistakes. */
type Saved = Record<string, MistakesData>;

export function ownerMistakes(saved: Saved, owner: string): MistakesData {
  return saved[owner] ?? EMPTY_MISTAKES;
}

type State = {
  isLoaded: boolean;
  saved: Saved;
  load: () => Promise<void>;
  recordAttempt: (owner: string, wrongQuestionIds: readonly string[]) => void;
  recordReview: (owner: string, questionId: string, correct: boolean) => void;
  prune: (owner: string, exists: (questionId: string) => boolean) => void;
  /** Private Cloud Sync: the merged account state (null = forget this owner on this device). */
  applySynced: (owner: string, data: MistakesData | null) => void;
  adoptGuest: (userId: string) => void;
};

/**
 * Private study data, ON THIS DEVICE per account owner (v1 - not synced).
 * Kept completely apart from useChallengeStore: nothing here can change a
 * challenge's best score, attempts or completion.
 */
export const useChallengeMistakesStore = create<State>((set, get) => {
  const persist = () => void AsyncStorage.setItem(CHALLENGE_MISTAKES_KEY, JSON.stringify(get().saved)).catch(() => undefined);
  const update = (owner: string, change: (data: MistakesData) => MistakesData) => {
    const current = ownerMistakes(get().saved, owner);
    const next = change(current);
    if (next === current) return;
    set({ saved: { ...get().saved, [owner]: next } });
    persist();
  };
  return {
    isLoaded: false,
    saved: {},
    load: async () => {
      if (get().isLoaded) return;
      const raw = await AsyncStorage.getItem(CHALLENGE_MISTAKES_KEY).catch(() => null);
      // A load that finishes late never overwrites a store already loaded (and written) meanwhile.
      if (get().isLoaded) return;
      const parsed = safeJsonParse<Saved>(raw, {});
      set({ saved: parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}, isLoaded: true });
    },
    recordAttempt: (owner, ids) => update(owner, (data) => recordFinishedAttempt(data, ids)),
    recordReview: (owner, questionId, correct) => update(owner, (data) => recordReviewAnswer(data, questionId, correct)),
    prune: (owner, exists) => update(owner, (data) => pruneStale(data, exists)),
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
      const saved = { ...get().saved, [userId]: mergeMistakes(ownerMistakes(get().saved, userId), guest) };
      delete saved.guest;
      set({ saved });
      persist();
    },
  };
});
