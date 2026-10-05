import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

import { addRecent, applySession, ruleFor, type GameSessionRecord, type GameRecordSummary, type RecordOutcome } from '@/features/games/records/gameRecords';
import { safeJsonParse } from '@/services/storage/safeJson';

export const GAME_RECORDS_KEY = 'oyno.gameRecords.v1';
/** The old device-wide best scores (games3d/core/gameBestScore). */
const LEGACY_BEST_PREFIX = 'games3d.bestScore.';
const LEGACY_GAMES = ['jaa_atuu', 'ordo', 'chuko'];

export type OwnerRecords = {
  recent: Record<string, GameSessionRecord[]>;
  best: Record<string, number>;
  /** All finished rounds, practice INCLUDED. */
  sessions: Record<string, number>;
  wins: Record<string, number>;
  /** Finished OFFICIAL (non-practice) rounds - durable, never trimmed like
   * `recent`. Optional: records saved before it existed are read through
   * officialRounds(), which infers only from reliable evidence. */
  official?: Record<string, number>;
};

/**
 * How many official rounds this owner has finished in `gameId` - the
 * durable "has really played it" signal (Learning Paths, Portfolio).
 * Stored count first; for older records without it, only RELIABLE
 * evidence counts: official rounds still in `recent`, a stored personal
 * best (only official, eligible rounds can set one) or official wins.
 * Practice rounds and launches never count.
 */
export function officialRounds(records: OwnerRecords, gameId: string): number {
  const recentOfficial = (records.recent[gameId] ?? []).filter((session) => !session.practice).length;
  const evidence = Math.max(recentOfficial, records.best[gameId] !== undefined ? 1 : 0, (records.wins[gameId] ?? 0) > 0 ? 1 : 0);
  return Math.max(records.official?.[gameId] ?? 0, evidence);
}

/** owner ('guest' or account id) -> that owner's records. */
type Saved = Record<string, OwnerRecords>;

export const EMPTY_RECORDS: OwnerRecords = { recent: {}, best: {}, sessions: {}, wins: {} };

/** Pure: one finished round into an owner's records. */
export function recordInto(records: OwnerRecords, session: GameSessionRecord): { records: OwnerRecords; outcome: RecordOutcome } {
  const rule = ruleFor(session.gameId);
  const currentBest = records.best[session.gameId] ?? null;
  const outcome: RecordOutcome = rule ? applySession(rule, currentBest, session) : { isNewBest: false, previousBest: currentBest, best: currentBest };
  return {
    outcome,
    records: {
      recent: { ...records.recent, [session.gameId]: addRecent(records.recent[session.gameId] ?? [], session) },
      best: outcome.best === null ? records.best : { ...records.best, [session.gameId]: outcome.best },
      sessions: { ...records.sessions, [session.gameId]: (records.sessions[session.gameId] ?? 0) + 1 },
      // Persisted on EVERY round (practice too) so the count survives the
      // official round later being trimmed out of `recent`.
      official: { ...(records.official ?? {}), [session.gameId]: officialRounds(records, session.gameId) + (session.practice ? 0 : 1) },
      wins: session.result === 'win' && !session.practice ? { ...records.wins, [session.gameId]: (records.wins[session.gameId] ?? 0) + 1 } : records.wins,
    },
  };
}

/** Pure: a guest's records joining an account (signing in never loses a
 * round): recent lists merged newest-first, best by each game's rule. */
export function mergeRecords(into: OwnerRecords, from: OwnerRecords): OwnerRecords {
  let merged = { ...into, recent: { ...into.recent }, best: { ...into.best }, sessions: { ...into.sessions }, wins: { ...into.wins } };
  for (const [gameId, list] of Object.entries(from.recent)) {
    const all = [...(merged.recent[gameId] ?? []), ...list].sort((a, b) => b.completedAt.localeCompare(a.completedAt));
    merged.recent[gameId] = all.filter((session, index) => all.findIndex((other) => other.id === session.id) === index).slice(0, 10);
  }
  for (const [gameId, value] of Object.entries(from.best)) {
    const rule = ruleFor(gameId);
    const current = merged.best[gameId];
    if (current === undefined || (rule && (rule.best === 'higher' ? value > current : rule.best === 'lower' ? value < current : false))) merged.best[gameId] = value;
  }
  for (const [gameId, count] of Object.entries(from.sessions)) merged.sessions[gameId] = (merged.sessions[gameId] ?? 0) + count;
  for (const [gameId, count] of Object.entries(from.wins)) merged.wins[gameId] = (merged.wins[gameId] ?? 0) + count;
  // Official rounds: guest's and account's are different rounds - add them.
  const official: Record<string, number> = {};
  for (const gameId of new Set([...Object.keys(into.official ?? {}), ...Object.keys(from.official ?? {}), ...Object.keys(into.recent), ...Object.keys(from.recent), ...Object.keys(into.best), ...Object.keys(from.best), ...Object.keys(into.wins), ...Object.keys(from.wins)])) {
    const total = officialRounds(into, gameId) + officialRounds(from, gameId);
    if (total > 0) official[gameId] = total;
  }
  merged.official = official;
  merged = { ...merged };
  return merged;
}

export function summaryOf(records: OwnerRecords, gameId: string): GameRecordSummary {
  return {
    gameId,
    sessions: records.sessions[gameId] ?? 0,
    best: records.best[gameId] ?? null,
    latest: records.recent[gameId]?.[0] ?? null,
    wins: records.wins[gameId] ?? 0,
  };
}

type State = {
  isLoaded: boolean;
  saved: Saved;
  load: () => Promise<void>;
  record: (owner: string, session: GameSessionRecord) => RecordOutcome;
  /** Guest -> signed in: the guest's rounds join the account. */
  /** Private Cloud Sync: the merged account state (null = forget this owner on this device). */
  applySynced: (owner: string, data: OwnerRecords | null) => void;
  adoptGuest: (userId: string) => void;
};

/**
 * Personal game records, kept ON THIS DEVICE per account owner. Selecting
 * by the current owner means an account switch shows the right person's
 * records immediately - never another account's, not even briefly. Not
 * synced across devices (the plays count on Game Detail is the synced
 * server count; recent rounds and bests are device-local and say so).
 */
export const useGameRecordsStore = create<State>((set, get) => {
  const persist = () => void AsyncStorage.setItem(GAME_RECORDS_KEY, JSON.stringify(get().saved)).catch(() => undefined);
  return {
    isLoaded: false,
    saved: {},

    load: async () => {
      if (get().isLoaded) return;
      const raw = await AsyncStorage.getItem(GAME_RECORDS_KEY).catch(() => null);
      let saved = safeJsonParse<Saved>(raw, {});
      if (!saved || typeof saved !== 'object' || Array.isArray(saved)) saved = {};
      if (raw === null) {
        // First run of Game Records: the old device-wide best scores become
        // the current owner's bests (never erased), then retire.
        const owner = (await AsyncStorage.getItem('oyno.account.owner').catch(() => null)) ?? 'guest';
        const best: Record<string, number> = {};
        for (const gameId of LEGACY_GAMES) {
          const value = Number(await AsyncStorage.getItem(`${LEGACY_BEST_PREFIX}${gameId}`).catch(() => null));
          if (Number.isFinite(value) && value > 0) best[gameId] = value;
        }
        if (Object.keys(best).length > 0) saved = { [owner]: { ...EMPTY_RECORDS, best } };
      }
      set({ saved, isLoaded: true });
      persist();
      if (raw === null) void AsyncStorage.multiRemove(LEGACY_GAMES.map((gameId) => `${LEGACY_BEST_PREFIX}${gameId}`)).catch(() => undefined);
    },

    record: (owner, session) => {
      const { records, outcome } = recordInto(get().saved[owner] ?? EMPTY_RECORDS, session);
      set({ saved: { ...get().saved, [owner]: records } });
      persist();
      return outcome;
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
      const saved = { ...get().saved, [userId]: mergeRecords(get().saved[userId] ?? EMPTY_RECORDS, guest) };
      delete saved.guest;
      set({ saved });
      persist();
    },
  };
});

/** The records the current person may see. */
export function ownerRecords(saved: Saved, owner: string): OwnerRecords {
  return saved[owner] ?? EMPTY_RECORDS;
}
