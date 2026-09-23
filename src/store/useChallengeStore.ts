import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

import { safeJsonParse } from '@/services/storage/safeJson';

const STORAGE_KEY = 'oyno.challenges.v1';

export type ChallengeResult = {
  startedAt: string;
  completedAt: string | null;
  lastCorrect: number;
  lastTotal: number;
  bestCorrect: number;
  attempts: number;
};

type ChallengeData = {
  /** Today's Daily Challenge identity, fixed once chosen for that date. */
  daily: { date: string; questionIds: string[] } | null;
  /** challenge id (`daily:YYYY-MM-DD`, `collection:<id>`, `journey`) -> result */
  results: Record<string, ChallengeResult>;
};

/** Pure: a finished attempt. Best score never goes down; a wrong answer
 * never removes anything - there's no XP here at all. */
export function recordCompletion(previous: ChallengeResult | undefined, correct: number, total: number, now: string): ChallengeResult {
  return {
    startedAt: previous?.startedAt ?? now,
    completedAt: now,
    lastCorrect: correct,
    lastTotal: total,
    bestCorrect: Math.max(previous?.bestCorrect ?? 0, correct),
    attempts: (previous?.attempts ?? 0) + 1,
  };
}

type ChallengeState = ChallengeData & {
  isLoaded: boolean;
  load: () => Promise<void>;
  dailyQuestionIds: (date: string, pick: () => string[]) => string[];
  /** Read-only lookup for render: stored ids for `date`, or null. */
  storedDailyIds: (date: string) => string[] | null;
  start: (challengeId: string) => void;
  complete: (challengeId: string, correct: number, total: number) => void;
};

/**
 * Knowledge Challenge progress, on this device, kept apart from
 * Culture/Explore discovery progress (useProgressStore) - challenges never
 * mark content as discovered.
 */
export const useChallengeStore = create<ChallengeState>((set, get) => {
  function persist() {
    const { daily, results } = get();
    void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ daily, results })).catch(() => {});
  }

  return {
    isLoaded: false,
    daily: null,
    results: {},
    load: async () => {
      const raw = await AsyncStorage.getItem(STORAGE_KEY).catch(() => null);
      const parsed = safeJsonParse<Partial<ChallengeData> | null>(raw, null);
      set({ daily: parsed?.daily ?? null, results: parsed?.results && typeof parsed.results === 'object' ? parsed.results : {}, isLoaded: true });
    },
    storedDailyIds: (date) => {
      const current = get().daily;
      return current?.date === date && current.questionIds.length > 0 ? current.questionIds : null;
    },
    dailyQuestionIds: (date, pick) => {
      const current = get().daily;
      if (current?.date === date && current.questionIds.length > 0) return current.questionIds;
      const questionIds = pick();
      set({ daily: { date, questionIds } });
      persist();
      return questionIds;
    },
    start: (challengeId) => {
      const existing = get().results[challengeId];
      if (existing) return;
      set({ results: { ...get().results, [challengeId]: { startedAt: new Date().toISOString(), completedAt: null, lastCorrect: 0, lastTotal: 0, bestCorrect: 0, attempts: 0 } } });
      persist();
    },
    complete: (challengeId, correct, total) => {
      set({ results: { ...get().results, [challengeId]: recordCompletion(get().results[challengeId], correct, total, new Date().toISOString()) } });
      persist();
    },
  };
});
