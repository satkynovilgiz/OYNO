import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

import { DETECTIVE_QUESTIONS } from '@/features/detective/detectiveQuestions';
import { EXPEDITIONS, type ExpeditionId } from '@/features/detective/expeditions';
import { safeJsonParse } from '@/services/storage/safeJson';

export const DETECTIVE_KEY = 'oyno.detective.v1';

/** Culture Detective results - on this device, per owner. Deliberately NOT
 * official game records, progress, achievements or learning completion. */
/**
 * One expedition's history. Learning (all clues shown) and Challenge (clue
 * points) are DIFFERENT score categories and never mixed: learning counts
 * correct answers, challenge counts points. `missedIds` = what is left to
 * practise in this expedition.
 */
export type ExpeditionRecord = {
  learning: { bestCorrect: number; total: number; rounds: number } | null;
  challenge: { bestScore: number; maxScore: number; rounds: number } | null;
  missedIds: string[];
};
export type DetectiveRecord = {
  bestScore: number;
  sessions: number;
  lastMissedIds: string[];
  lastPlayedAt: string | null;
  /** Added with Expeditions; records saved before it simply have none yet. */
  expeditions: Partial<Record<ExpeditionId, ExpeditionRecord>>;
};
export const EMPTY_DETECTIVE: DetectiveRecord = { bestScore: 0, sessions: 0, lastMissedIds: [], lastPlayedAt: null, expeditions: {} };
const EXPEDITION_IDS = new Set<string>(EXPEDITIONS.map((item) => item.id));
const count = (value: unknown) => (Number.isInteger(value) && (value as number) >= 0 ? (value as number) : 0);

function parseExpeditions(raw: unknown): DetectiveRecord['expeditions'] {
  const out: DetectiveRecord['expeditions'] = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const [id, value] of Object.entries(raw as Record<string, Partial<ExpeditionRecord>>)) {
    if (!EXPEDITION_IDS.has(id) || !value || typeof value !== 'object') continue;
    const allowed = new Set(EXPEDITIONS.find((item) => item.id === id)!.questionIds);
    out[id as ExpeditionId] = {
      learning: value.learning && typeof value.learning === 'object' ? { bestCorrect: count(value.learning.bestCorrect), total: count(value.learning.total), rounds: count(value.learning.rounds) } : null,
      challenge: value.challenge && typeof value.challenge === 'object' ? { bestScore: count(value.challenge.bestScore), maxScore: count(value.challenge.maxScore), rounds: count(value.challenge.rounds) } : null,
      missedIds: Array.isArray(value.missedIds) ? value.missedIds.filter((qid): qid is string => typeof qid === 'string' && allowed.has(qid)) : [],
    };
  }
  return out;
}

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
      expeditions: parseExpeditions((value as { expeditions?: unknown }).expeditions),
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
  /**
   * A finished expedition round. learning -> learning category only;
   * challenge -> challenge category only; practice -> neither (it only
   * clears practised questions answered right). Quick-play history is untouched.
   */
  recordExpedition: (owner: string, id: ExpeditionId, result: { round: 'learning' | 'challenge' | 'practice'; correct: number; total: number; score: number; maxScore: number; missedIds: string[]; askedIds: string[] }) => void;
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
        expeditions: current.expeditions ?? {},
      };
      set({ saved: { ...get().saved, [owner]: next } });
      persist();
    },
    recordExpedition: (owner, id, result) => {
      const current = get().saved[owner] ?? EMPTY_DETECTIVE;
      const before: ExpeditionRecord = current.expeditions?.[id] ?? { learning: null, challenge: null, missedIds: [] };
      const allowed = new Set(EXPEDITIONS.find((item) => item.id === id)?.questionIds ?? []);
      // Still to practise: missed now, plus earlier misses this round didn't ask.
      const carried = before.missedIds.filter((qid) => !result.askedIds.includes(qid));
      const missedIds = [...new Set([...result.missedIds, ...carried])].filter((qid) => allowed.has(qid));
      const next: ExpeditionRecord = {
        learning: result.round === 'learning' ? { bestCorrect: Math.max(before.learning?.bestCorrect ?? 0, result.correct), total: result.total, rounds: (before.learning?.rounds ?? 0) + 1 } : before.learning,
        challenge: result.round === 'challenge' ? { bestScore: Math.max(before.challenge?.bestScore ?? 0, result.score), maxScore: result.maxScore, rounds: (before.challenge?.rounds ?? 0) + 1 } : before.challenge,
        missedIds,
      };
      set({ saved: { ...get().saved, [owner]: { ...current, expeditions: { ...current.expeditions, [id]: next } } } });
      persist();
    },
  };
});

export function ownerDetective(saved: Saved, owner: string): DetectiveRecord {
  return saved[owner] ?? EMPTY_DETECTIVE;
}
