import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

import { normalizeDraft, type ChallengeDraft } from '@/features/myCollections/museum/challengeModel';
import { safeJsonParse } from '@/services/storage/safeJson';

/**
 * The Curator Challenge draft in progress, one per owner, on this device -
 * so opening a source article or the Visitor Preview (or restarting) keeps
 * every edit. Cleared once the exhibition is saved.
 */
export const CHALLENGE_DRAFT_KEY = 'oyno.curatorChallenge.v1';
type Saved = Record<string, ChallengeDraft>;

type State = {
  isLoaded: boolean;
  saved: Saved;
  load: () => Promise<void>;
  put: (owner: string, draft: ChallengeDraft) => void;
  clear: (owner: string) => void;
};

/** This owner's draft only (never another account's). */
export const ownerDraft = (saved: Saved, owner: string): ChallengeDraft | null => normalizeDraft(saved[owner]);

export const useChallengeDraftStore = create<State>((set, get) => {
  const persist = () => void AsyncStorage.setItem(CHALLENGE_DRAFT_KEY, JSON.stringify(get().saved)).catch(() => undefined);
  return {
    isLoaded: false,
    saved: {},
    load: async () => {
      if (get().isLoaded) return;
      const raw = await AsyncStorage.getItem(CHALLENGE_DRAFT_KEY).catch(() => null);
      if (get().isLoaded) return;
      const parsed = safeJsonParse<Saved>(raw, {});
      set({ saved: parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}, isLoaded: true });
    },
    put: (owner, draft) => {
      set({ saved: { ...get().saved, [owner]: draft } });
      persist();
    },
    clear: (owner) => {
      if (!get().saved[owner]) return;
      const saved = { ...get().saved };
      delete saved[owner];
      set({ saved });
      persist();
    },
  };
});
