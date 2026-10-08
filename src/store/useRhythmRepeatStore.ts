import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

import { DIFFICULTIES, type Difficulty } from '@/features/culture/komuz/rhythm/repeat/repeatModel';
import { safeJsonParse } from '@/services/storage/safeJson';

export const RHYTHM_REPEAT_KEY = 'oyno.rhythmRepeat.v1';

/** "Repeat the Rhythm" practice results - per owner, on this device. NOT
 * official game records, progress, achievements or streaks. */
export type RepeatBest = { bestPoints: number; maxPoints: number; sessions: number };
export type RepeatRecord = Partial<Record<Difficulty, RepeatBest>>;
type Saved = Record<string, RepeatRecord>;

const count = (value: unknown) => (Number.isInteger(value) && (value as number) >= 0 ? (value as number) : 0);

function parse(raw: string | null): Saved {
  const parsed = safeJsonParse<unknown>(raw, {});
  const saved: Saved = {};
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return saved;
  for (const [owner, value] of Object.entries(parsed as Record<string, Record<string, Partial<RepeatBest>>>)) {
    if (!value || typeof value !== 'object') continue;
    const record: RepeatRecord = {};
    for (const difficulty of DIFFICULTIES) {
      const entry = value[difficulty];
      if (entry && typeof entry === 'object') record[difficulty] = { bestPoints: count(entry.bestPoints), maxPoints: count(entry.maxPoints), sessions: count(entry.sessions) };
    }
    saved[owner] = record;
  }
  return saved;
}

type State = {
  isLoaded: boolean;
  saved: Saved;
  load: () => Promise<void>;
  /** A finished five-round session. */
  recordSession: (owner: string, difficulty: Difficulty, result: { points: number; maxPoints: number }) => void;
};

export const useRhythmRepeatStore = create<State>((set, get) => {
  const persist = () => void AsyncStorage.setItem(RHYTHM_REPEAT_KEY, JSON.stringify(get().saved)).catch(() => undefined);
  return {
    isLoaded: false,
    saved: {},
    load: async () => {
      if (get().isLoaded) return;
      const raw = await AsyncStorage.getItem(RHYTHM_REPEAT_KEY).catch(() => null);
      if (get().isLoaded) return;
      set({ saved: parse(raw), isLoaded: true });
    },
    recordSession: (owner, difficulty, result) => {
      const record = get().saved[owner] ?? {};
      const before = record[difficulty];
      const next: RepeatBest = { bestPoints: Math.max(before?.bestPoints ?? 0, count(result.points)), maxPoints: count(result.maxPoints), sessions: (before?.sessions ?? 0) + 1 };
      set({ saved: { ...get().saved, [owner]: { ...record, [difficulty]: next } } });
      persist();
    },
  };
});

/** Stable empty record: a selector must not return a new object each call. */
const EMPTY_REPEAT: RepeatRecord = Object.freeze({});
export function ownerRepeat(saved: Saved, owner: string): RepeatRecord {
  return saved[owner] ?? EMPTY_REPEAT;
}
