import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

import { applyAnswer, mergeStudy, pruneStudy, type StudyAction, type StudyData } from '@/features/culture/glossary/study/glossaryStudy';
import { safeJsonParse } from '@/services/storage/safeJson';

export const GLOSSARY_STUDY_KEY = 'oyno.glossaryStudy.v1';
/** Completed study-session timestamps per owner (for Weekly Goals). */
export const GLOSSARY_SESSIONS_KEY = 'oyno.glossaryStudySessions.v1';
const MAX_SESSIONS = 100;

type Saved = Record<string, StudyData>;
const EMPTY: StudyData = {};

export function ownerStudy(saved: Saved, owner: string): StudyData {
  return saved[owner] ?? EMPTY;
}

type State = {
  isLoaded: boolean;
  saved: Saved;
  sessions: Record<string, string[]>;
  /** A study session reached its result screen (a real completion). */
  completeSession: (owner: string) => void;
  load: () => Promise<void>;
  answer: (owner: string, glossaryEntryId: string, action: StudyAction) => void;
  prune: (owner: string, validIds: readonly string[]) => void;
  /** Private Cloud Sync: the merged account state (null = forget this owner on this device). */
  applySynced: (owner: string, data: StudyData | null) => void;
  applySyncedSessions: (owner: string, sessions: string[] | null) => void;
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
    sessions: {},
    load: async () => {
      if (get().isLoaded) return;
      const [raw, rawSessions] = await Promise.all([AsyncStorage.getItem(GLOSSARY_STUDY_KEY).catch(() => null), AsyncStorage.getItem(GLOSSARY_SESSIONS_KEY).catch(() => null)]);
      // A load that finishes late never overwrites a store already loaded (and written) meanwhile.
      if (get().isLoaded) return;
      const parsed = safeJsonParse<Saved>(raw, {});
      const sessions = safeJsonParse<Record<string, string[]>>(rawSessions, {});
      set({ saved: parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}, sessions: sessions && typeof sessions === 'object' && !Array.isArray(sessions) ? sessions : {}, isLoaded: true });
    },
    completeSession: (owner) => {
      const list = [...(get().sessions[owner] ?? []), new Date().toISOString()].slice(-MAX_SESSIONS);
      set({ sessions: { ...get().sessions, [owner]: list } });
      void AsyncStorage.setItem(GLOSSARY_SESSIONS_KEY, JSON.stringify(get().sessions)).catch(() => undefined);
    },
    answer: (owner, id, action) => update(owner, applyAnswer(ownerStudy(get().saved, owner), id, action)),
    prune: (owner, validIds) => update(owner, pruneStudy(ownerStudy(get().saved, owner), validIds)),
    applySynced: (owner, data) => {
      const saved = { ...get().saved };
      if (data) saved[owner] = data;
      else delete saved[owner];
      set({ saved });
      persist();
    },
    applySyncedSessions: (owner, list) => {
      const sessions = { ...get().sessions };
      if (list) sessions[owner] = [...list].sort().slice(-MAX_SESSIONS);
      else delete sessions[owner];
      set({ sessions });
      void AsyncStorage.setItem(GLOSSARY_SESSIONS_KEY, JSON.stringify(sessions)).catch(() => undefined);
    },
    adoptGuest: (userId) => {
      const guest = get().saved.guest;
      if (!guest || userId === 'guest') return;
      const saved = { ...get().saved, [userId]: mergeStudy(ownerStudy(get().saved, userId), guest) };
      delete saved.guest;
      const sessions = { ...get().sessions, [userId]: [...(get().sessions[userId] ?? []), ...(get().sessions.guest ?? [])].sort().slice(-MAX_SESSIONS) };
      delete sessions.guest;
      set({ saved, sessions });
      persist();
      void AsyncStorage.setItem(GLOSSARY_SESSIONS_KEY, JSON.stringify(sessions)).catch(() => undefined);
    },
  };
});
