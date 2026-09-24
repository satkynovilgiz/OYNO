/**
 * Pure merge rules for cross-device sync - one function per kind of state,
 * no I/O. Every rule is monotonic for progress: merging can add, complete
 * or raise, but never removes a visit, un-completes a day or lowers a best
 * score. The same rules run server-side for the tables that store them
 * (supabase/migrations/20260923000001_account_sync.sql), so a merge is
 * safe whichever side sees the data first.
 *
 *   visited set             -> union; earliest visit date kept
 *   Daily completion        -> completed wins; if both sides completed the
 *                              same date with different items, the server
 *                              (first stored) item is kept
 *   Challenge best score    -> highest legitimate score (never above the
 *                              run's own total)
 *   Challenge completion    -> completed wins; earliest completion kept
 *   Challenge "last" result -> the most recently updated record
 *   Favorites               -> server set + this device's pending edits;
 *                              a pending edit wins unless the server row
 *                              is newer; edits made as a guest only ever
 *                              ADD to an account (never remove)
 *   Achievements            -> server-only unlocks (insert-only table), so
 *                              an unlock is never lost
 */

import type { ChallengeResult } from '@/store/useChallengeStore';
import type { DailyCompletions } from '@/store/useDailyDiscoveryStore';

// ---------------------------------------------------------------------
// Visits
// ---------------------------------------------------------------------

export type VisitSet = { ids: string[]; dates: Record<string, string> };

export function mergeVisits(a: VisitSet, b: VisitSet): VisitSet {
  const ids = Array.from(new Set([...a.ids, ...b.ids]));
  const dates: Record<string, string> = {};
  for (const id of ids) {
    const candidates = [a.dates[id], b.dates[id]].filter((value): value is string => !!value).sort();
    if (candidates[0]) dates[id] = candidates[0];
  }
  return { ids, dates };
}

// ---------------------------------------------------------------------
// Daily OYNO
// ---------------------------------------------------------------------

export type ServerDailyRow = { date_key: string; item_id: string; completed_at?: string };

export type MergeOutcome<T> = { merged: T; conflicts: number };

/** Completed wins; the server's (first stored) item wins a same-date clash. */
export function mergeDailyCompletions(local: DailyCompletions, server: ServerDailyRow[]): MergeOutcome<DailyCompletions> {
  const merged: DailyCompletions = { ...local };
  let conflicts = 0;
  for (const row of server) {
    if (merged[row.date_key] && merged[row.date_key] !== row.item_id) conflicts += 1;
    merged[row.date_key] = row.item_id;
  }
  return { merged, conflicts };
}

/** Local completions the server doesn't have yet - the only ones to send. */
export function dailyToPush(local: DailyCompletions, server: ServerDailyRow[]): ServerDailyRow[] {
  const known = new Set(server.map((row) => row.date_key));
  return Object.entries(local)
    .filter(([dateKey]) => !known.has(dateKey))
    .map(([date_key, item_id]) => ({ date_key, item_id }));
}

// ---------------------------------------------------------------------
// Knowledge Challenges
// ---------------------------------------------------------------------

export type ServerChallengeRow = {
  challenge_key: string;
  best_correct: number;
  last_correct: number;
  last_total: number;
  attempts: number;
  started_at: string | null;
  completed_at: string | null;
  updated_at: string;
};

function earliest(a: string | null | undefined, b: string | null | undefined): string | null {
  if (!a) return b ?? null;
  if (!b) return a;
  return a < b ? a : b;
}

function updatedAtOf(result: ChallengeResult): string {
  return result.updatedAt ?? result.completedAt ?? result.startedAt;
}

/**
 * Postgres returns "2026-09-23T10:00:00+00:00", the app writes
 * "2026-09-23T10:00:00.000Z" - normalize before any comparison so string
 * ordering is also time ordering.
 */
export function isoTime(value: string): string;
export function isoTime(value: string | null | undefined): string | null;
export function isoTime(value: string | null | undefined): string | null {
  if (!value) return null;
  const time = Date.parse(value);
  return Number.isNaN(time) ? value : new Date(time).toISOString();
}

export function challengeFromRow(row: ServerChallengeRow): ChallengeResult {
  const updatedAt = isoTime(row.updated_at);
  return {
    startedAt: isoTime(row.started_at) ?? isoTime(row.completed_at) ?? updatedAt,
    completedAt: isoTime(row.completed_at),
    lastCorrect: row.last_correct,
    lastTotal: row.last_total,
    bestCorrect: row.best_correct,
    attempts: row.attempts,
    updatedAt,
  };
}

export function challengeToRow(key: string, result: ChallengeResult): ServerChallengeRow {
  return {
    challenge_key: key,
    best_correct: result.bestCorrect,
    last_correct: result.lastCorrect,
    last_total: result.lastTotal,
    attempts: result.attempts,
    started_at: result.startedAt,
    completed_at: result.completedAt,
    updated_at: updatedAtOf(result),
  };
}

/** The highest score a record can legitimately claim. */
function legitimateBest(result: ChallengeResult): number {
  return Math.max(0, Math.min(result.bestCorrect, 50));
}

export function mergeChallengeResult(a: ChallengeResult | undefined, b: ChallengeResult | undefined): ChallengeResult | undefined {
  if (!a) return b;
  if (!b) return a;
  const newer = updatedAtOf(a) >= updatedAtOf(b) ? a : b;
  return {
    startedAt: earliest(a.startedAt, b.startedAt) ?? newer.startedAt,
    completedAt: earliest(a.completedAt, b.completedAt),
    lastCorrect: newer.lastCorrect,
    lastTotal: newer.lastTotal,
    bestCorrect: Math.max(legitimateBest(a), legitimateBest(b)),
    attempts: Math.max(a.attempts, b.attempts),
    updatedAt: updatedAtOf(a) >= updatedAtOf(b) ? updatedAtOf(a) : updatedAtOf(b),
  };
}

function sameResult(a: ChallengeResult | undefined, b: ChallengeResult | undefined): boolean {
  if (!a || !b) return a === b;
  return (
    a.bestCorrect === b.bestCorrect &&
    a.lastCorrect === b.lastCorrect &&
    a.lastTotal === b.lastTotal &&
    a.attempts === b.attempts &&
    a.completedAt === b.completedAt
  );
}

export function mergeChallengeResults(
  local: Record<string, ChallengeResult>,
  server: ServerChallengeRow[],
): MergeOutcome<Record<string, ChallengeResult>> & { toPush: ServerChallengeRow[] } {
  const serverByKey = new Map(server.map((row) => [row.challenge_key, challengeFromRow(row)]));
  const merged: Record<string, ChallengeResult> = { ...local };
  const toPush: ServerChallengeRow[] = [];
  let conflicts = 0;

  for (const [key, remote] of serverByKey) {
    const localResult = local[key];
    const next = mergeChallengeResult(localResult, remote)!;
    if (localResult && !sameResult(localResult, remote)) conflicts += 1;
    merged[key] = next;
  }
  for (const [key, result] of Object.entries(merged)) {
    // Only finished runs are account progress; a run merely opened stays
    // on this device.
    if (!result.completedAt) continue;
    if (!sameResult(result, serverByKey.get(key))) toPush.push(challengeToRow(key, result));
  }
  return { merged, conflicts, toPush };
}

// ---------------------------------------------------------------------
// Favorites (main favorites and wallpaper favorites share one table)
// ---------------------------------------------------------------------

/** One not-yet-synced favorite edit made on this device. */
export type PendingFavoriteOp = { favorited: boolean; at: string; origin: 'guest' | 'account' };

export type ServerFavoriteRow = { key: string; createdAt: string | null };

/**
 * The favorites an account should end up with: the server set with this
 * device's pending edits applied. Returns the desired set and exactly the
 * keys whose server state must change (nothing else is written).
 */
export function mergeFavorites(
  server: ServerFavoriteRow[],
  pending: Record<string, PendingFavoriteOp>,
): { desired: string[]; toAdd: string[]; toRemove: string[]; conflicts: number } {
  const serverMap = new Map(server.map((row) => [row.key, isoTime(row.createdAt)]));
  const desired = new Set(serverMap.keys());
  const toAdd: string[] = [];
  const toRemove: string[] = [];
  let conflicts = 0;

  for (const [key, op] of Object.entries(pending)) {
    const onServer = serverMap.has(key);
    if (op.favorited && !onServer) {
      desired.add(key);
      toAdd.push(key);
    } else if (!op.favorited && onServer) {
      const serverCreatedAt = serverMap.get(key);
      // Guest edits never remove an account's favorite, and a favorite
      // re-added on another device after this removal wins.
      if (op.origin === 'guest' || (serverCreatedAt && serverCreatedAt > op.at)) {
        conflicts += 1;
        continue;
      }
      desired.delete(key);
      toRemove.push(key);
    }
  }
  return { desired: Array.from(desired), toAdd, toRemove, conflicts };
}
