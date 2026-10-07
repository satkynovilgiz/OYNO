import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

import { DETECTIVE_QUESTIONS } from '@/features/detective/detectiveQuestions';
import { safeJsonParse } from '@/services/storage/safeJson';

export const DETECTIVE_KEY = 'oyno.detective.v1';

/** Culture Detective results - on this device, per owner. Deliberately NOT
 * official game records, progress, achievements or learning completion. */
export type DetectiveRecord = { bestScore: number; sessions: number; lastMissedIds: string[]; lastPlayedAt: string | null };
export const EMPTY_DETECTIVE: DetectiveRecord = { bestScore: 0, sessions: 0, lastMissedIds: [], lastPlayedAt: null };

type Saved = Record<string, DetectiveRecord>;

const KNOWN_IDS = new Set(DETECTIVE_QUESTIONS.map((question) => question.id));

function parse(raw: string | null): Saved {
  const parsed = safeJsonParse<unknown>(raw, {});
  const saved: Saved = {};
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return saved;
  for (const [owner, value] of Object.entries(parsed as Record<string, Partial<DetectiveRecord>>)) {
    if (!value || typeof value !== 'object') continue;
    saved[owner] = {
      bestScore: Number.isInteger(value.bestScore) && value.bestScore! >= 0 ? value.bestScore! : 0,
      sessions: Number.isInteger(value.sessions) && value.sessions! >= 0 ? value.sessions! : 0,
      lastMissedIds: Array.isArray(value.lastMissedIds) ? value.lastMissedIds.filter((id): id is string => typeof id === 'string' && KNOWN_IDS.has(id)) : [],
      lastPlayedAt: typeof value.lastPlayedAt === 'string' ? value.lastPlayedAt : null,
    };
  }
  return saved;
}

type State = {
  isLoaded: boolean;
  saved: Saved;
  load: () => Promise<void>;
  /** A finished session. A focus round only clears the questions it got right. */
  recordSession: (owner: string, result: { score: number; missedIds: string[]; askedIds: string[]; focus: boolean }) => void;
};

export const useDetectiveStore = create<State>((set, get) => {
  const persist = () => void AsyncStorage.setItem(DETECTIVE_KEY, JSON.stringify(get().saved)).catch(() => undefined);
  return {
    isLoaded: false,
    saved: {},
    load: async () => {
      if (get().isLoaded) return;
      const raw = await AsyncStorage.getItem(DETECTIVE_KEY).catch(() => null);
      if (get().isLoaded) return;
      set({ saved: parse(raw), isLoaded: true });
    },
    recordSession: (owner, result) => {
      const current = get().saved[owner] ?? EMPTY_DETECTIVE;
      // Still to practise: what was missed now, plus (after a focus round) earlier misses not asked this time.
      const carried = result.focus ? current.lastMissedIds.filter((id) => !result.askedIds.includes(id)) : [];
      const next: DetectiveRecord = {
        bestScore: Math.max(current.bestScore, result.score),
        sessions: current.sessions + 1,
        lastMissedIds: [...new Set([...result.missedIds, ...carried])].filter((id) => KNOWN_IDS.has(id)),
        lastPlayedAt: new Date().toISOString(),
      };
      set({ saved: { ...get().saved, [owner]: next } });
      persist();
    },
  };
});

export function ownerDetective(saved: Saved, owner: string): DetectiveRecord {
  return saved[owner] ?? EMPTY_DETECTIVE;
}
