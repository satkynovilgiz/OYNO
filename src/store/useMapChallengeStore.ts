import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

import { MAP_QUESTIONS } from '@/features/explore/mapChallenge/mapChallengeData';
import { safeJsonParse } from '@/services/storage/safeJson';

export const MAP_CHALLENGE_KEY = 'oyno.mapChallenge.v1';

/** Map Challenge results - on this device, per owner. Never visits, the
 * Discovery Passport, region progress or official game records. */
export type MapChallengeRecord = { best: number; sessions: number; lastMissedIds: string[] };
export const EMPTY_MAP_RECORD: MapChallengeRecord = { best: 0, sessions: 0, lastMissedIds: [] };

type Saved = Record<string, MapChallengeRecord>;
const KNOWN = new Set(MAP_QUESTIONS.map((question) => question.id));

function parse(raw: string | null): Saved {
  const parsed = safeJsonParse<unknown>(raw, {});
  const saved: Saved = {};
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return saved;
  for (const [owner, value] of Object.entries(parsed as Record<string, Partial<MapChallengeRecord>>)) {
    if (!value || typeof value !== 'object') continue;
    saved[owner] = {
      best: Number.isInteger(value.best) && value.best! >= 0 ? value.best! : 0,
      sessions: Number.isInteger(value.sessions) && value.sessions! >= 0 ? value.sessions! : 0,
      lastMissedIds: Array.isArray(value.lastMissedIds) ? value.lastMissedIds.filter((id): id is string => typeof id === 'string' && KNOWN.has(id)) : [],
    };
  }
  return saved;
}

type State = {
  isLoaded: boolean;
  saved: Saved;
  load: () => Promise<void>;
  recordSession: (owner: string, result: { correct: number; missedIds: string[] }) => void;
};

export const useMapChallengeStore = create<State>((set, get) => {
  const persist = () => void AsyncStorage.setItem(MAP_CHALLENGE_KEY, JSON.stringify(get().saved)).catch(() => undefined);
  return {
    isLoaded: false,
    saved: {},
    load: async () => {
      if (get().isLoaded) return;
      const raw = await AsyncStorage.getItem(MAP_CHALLENGE_KEY).catch(() => null);
      if (get().isLoaded) return;
      set({ saved: parse(raw), isLoaded: true });
    },
    recordSession: (owner, result) => {
      const current = get().saved[owner] ?? EMPTY_MAP_RECORD;
      set({ saved: { ...get().saved, [owner]: { best: Math.max(current.best, result.correct), sessions: current.sessions + 1, lastMissedIds: result.missedIds.filter((id) => KNOWN.has(id)) } } });
      persist();
    },
  };
});

export const ownerMapChallenge = (saved: Saved, owner: string) => saved[owner] ?? EMPTY_MAP_RECORD;
