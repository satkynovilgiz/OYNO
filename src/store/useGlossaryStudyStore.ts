import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

import { applyAnswer, mergeStudy, pruneStudy, type StudyAction, type StudyData } from '@/features/culture/glossary/study/glossaryStudy';
import { safeJsonParse } from '@/services/storage/safeJson';

export const GLOSSARY_STUDY_KEY = 'oyno.glossaryStudy.v1';

type Saved = Record<string, StudyData>;
const EMPTY: StudyData = {};

export function ownerStudy(saved: Saved, owner: string): StudyData {
  return saved[owner] ?? EMPTY;
}

type State = {
  isLoaded: boolean;
  saved: Saved;
  load: () => Promise<void>;
  answer: (owner: string, glossaryEntryId: string, action: StudyAction) => void;
  prune: (owner: string, validIds: readonly string[]) => void;
  adoptGuest: (userId: string) => void;
};

/** Flashcard review state - ON THIS DEVICE per account owner. Fully
 * separate from challenges, region progress, Daily and rewards. */
export const useGlossaryStudyStore = create<State>((set, get) => {
  const persist = () => void AsyncStorage.setItem(GLOSSARY_STUDY_KEY, JSON.stringify(get().saved)).catch(() => undefined);
  const update = (owner: string, next: StudyData) => {
    if (next === ownerStudy(get().saved, owner)) return;
    set({ saved: { ...get().saved, [owner]: next } });
    persist();
  };
  return {
    isLoaded: false,
    saved: {},
    load: async () => {
      if (get().isLoaded) return;
      const raw = await AsyncStorage.getItem(GLOSSARY_STUDY_KEY).catch(() => null);
      const parsed = safeJsonParse<Saved>(raw, {});
      set({ saved: parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}, isLoaded: true });
    },
    answer: (owner, id, action) => update(owner, applyAnswer(ownerStudy(get().saved, owner), id, action)),
    prune: (owner, validIds) => update(owner, pruneStudy(ownerStudy(get().saved, owner), validIds)),
    adoptGuest: (userId) => {
      const guest = get().saved.guest;
      if (!guest || userId === 'guest') return;
      const saved = { ...get().saved, [userId]: mergeStudy(ownerStudy(get().saved, userId), guest) };
      delete saved.guest;
      set({ saved });
      persist();
    },
  };
});
