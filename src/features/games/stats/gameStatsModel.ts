import type { OwnerRecords } from '@/store/useGameRecordsStore';

import { GAME_RECORD_RULES, MAX_RECENT_SESSIONS, type GameRecordRule, type GameSessionRecord } from '../records/gameRecords';

/**
 * Game Performance Lab - pure views over the EXISTING Game Records
 * (GameSessionRecord + GAME_RECORD_RULES + OwnerRecords). No new store, no
 * cross-game score, no rating, no coaching. The records keep only the last
 * MAX_RECENT_SESSIONS rounds per game, so everything "recent" is labelled
 * as such - never "all-time history".
 */

export const STATS_GAME_ORDER = ['jaa_atuu', 'ordo', 'chuko', 'kyz_kuumai', 'kok_boru'] as const;
export const RECENT_LIMIT = MAX_RECENT_SESSIONS;

export type SessionFilter = 'official' | 'practice' | 'all';

/** Newest-first records -> filtered, CHRONOLOGICAL (oldest -> newest). */
export function recentSessions(records: OwnerRecords, gameId: string, filter: SessionFilter): GameSessionRecord[] {
  const list = (records.recent[gameId] ?? []).filter((session) => (filter === 'all' ? true : filter === 'practice' ? session.practice : !session.practice));
  return [...list].sort((a, b) => a.completedAt.localeCompare(b.completedAt) || a.id.localeCompare(b.id));
}

/**
 * Whether a round's primary value is a comparable measurement under the
 * game's rule: a finite number, and for Kyz Kuumai only a catch (an escape
 * has no comparable time). Kok Boru goals are real counts but never a
 * "best" (see GAME_RECORD_RULES).
 */
export function hasMetric(rule: GameRecordRule, session: GameSessionRecord): boolean {
  if (!Number.isFinite(session.primary) || session.primary < 0) return false;
  if (rule.best === 'lower') return session.result === 'win';
  return true;
}

export type ChartPoint = { index: number; sessionId: string; value: number; practice: boolean; isPb: boolean };

/** Real values only, in session order - no smoothing, no interpolation, no filler. */
export function chartPoints(rule: GameRecordRule, sessions: readonly GameSessionRecord[], best: number | null): ChartPoint[] {
  if (rule.best === 'completion') return [];
  const pbId = pbSessionId(rule, sessions, best);
  return sessions.filter((session) => hasMetric(rule, session)).map((session, index) => ({ index, sessionId: session.id, value: session.primary, practice: session.practice, isPb: session.id === pbId }));
}

/**
 * The recent round that holds the stored personal best: the EARLIEST
 * official, eligible round whose value equals it (an equal later result is
 * not a new best under isBetter). Practice never; Kok Boru never; and
 * nothing when the best was set before the recent window.
 */
export function pbSessionId(rule: GameRecordRule, sessions: readonly GameSessionRecord[], best: number | null): string | null {
  if (best === null || rule.best === 'completion') return null;
  const holder = [...sessions].sort((a, b) => a.completedAt.localeCompare(b.completedAt)).find((session) => !session.practice && rule.eligibleForBest(session) && hasMetric(rule, session) && session.primary === best);
  return holder?.id ?? null;
}

export type GameStatsSummary = {
  rounds: number;
  /** Mean of the real primary values in view (null when none). */
  average: number | null;
  /** Best value IN VIEW by the game's rule (null for Kok Boru). */
  bestInView: number | null;
  wins: number;
  draws: number;
  losses: number;
  /** Kok Boru: goals in the recent rounds shown, oldest -> newest. */
  goals: number[];
};

/**
 * Deterministic: plain mean rounded to one decimal; best by the rule's
 * direction. Pass ONE round type at a time (see roundGroups): official and
 * practice rounds are not comparable (Jaa Atuu: 5 vs 15 arrows; Kyz Kuumai
 * practice is a solo course; Kok Boru practice records "scored" 1/0).
 */
export function summarize(rule: GameRecordRule, sessions: readonly GameSessionRecord[]): GameStatsSummary {
  const values = sessions.filter((session) => hasMetric(rule, session)).map((session) => session.primary);
  const average = values.length && rule.best !== 'completion' ? Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10 : null;
  const bestInView = rule.best === 'completion' || values.length === 0 ? null : rule.best === 'higher' ? Math.max(...values) : Math.min(...values);
  return {
    rounds: sessions.length,
    average,
    bestInView,
    wins: sessions.filter((session) => session.result === 'win').length,
    draws: sessions.filter((session) => session.result === 'draw').length,
    losses: sessions.filter((session) => session.result === 'loss').length,
    // Kok Boru practice records "scored or not" (1/0), not a goal count - never mixed into goals.
    goals: rule.gameId === 'kok_boru' ? sessions.filter((session) => !session.practice && Number.isFinite(session.primary)).map((session) => session.primary) : [],
  };
}

export type GameOverview = { gameId: string; listId: string; official: number; practice: number; wins: number | null; best: number | null };

/** Per-game overview from the recent rounds + stored best/wins. Only games with any record. */
export function gamesOverview(records: OwnerRecords): GameOverview[] {
  return STATS_GAME_ORDER.flatMap((gameId) => {
    const rule = GAME_RECORD_RULES[gameId];
    const recent = records.recent[gameId] ?? [];
    if (recent.length === 0 && !(records.sessions[gameId] > 0)) return [];
    const best = rule.best === 'completion' ? null : (records.best[gameId] ?? null);
    return [{
      gameId,
      listId: rule.listId,
      official: recent.filter((session) => !session.practice).length,
      practice: recent.filter((session) => session.practice).length,
      wins: rule.gameId === 'jaa_atuu' ? null : (records.wins[gameId] ?? 0),
      best: best !== null && Number.isFinite(best) ? best : null,
    }];
  });
}

/** "Last 5 official rounds: 42, 51, 48, 63, 60 points." - the chart's text equivalent. */
export function chartSummary(points: readonly ChartPoint[], words: { lead: (count: number) => string; format: (value: number) => string; unitSuffix: string }): string {
  if (points.length === 0) return '';
  return `${words.lead(points.length)}: ${points.map((point) => words.format(point.value)).join(', ')}${words.unitSuffix ? ` ${words.unitSuffix}` : ''}.`;
}

/** The full text equivalent of one round type's chart: values (+ average when there is one). */
export function chartDescription(points: readonly ChartPoint[], words: { lead: (count: number) => string; format: (value: number) => string; unitSuffix: string; average: string | null }): string {
  const values = chartSummary(points, words);
  if (!values) return '';
  return words.average && points.length > 1 ? `${values} ${words.average}` : values;
}

/** Y range for the chart: the real min..max (padded), never starting at an invented zero for times. */
export function chartRange(points: readonly ChartPoint[]): { min: number; max: number } | null {
  if (points.length === 0) return null;
  const values = points.map((point) => point.value);
  let min = Math.min(...values);
  let max = Math.max(...values);
  if (min === max) {
    min -= 1;
    max += 1;
  }
  const pad = (max - min) * 0.1;
  return { min: Math.max(0, min - pad), max: max + pad };
}

/** Share: game title, the real stored PB (if the game has one), recent official rounds, one safe metric. */
export function statsShare(rule: GameRecordRule, records: OwnerRecords): { best: number | null; officialRecent: number; average: number | null } {
  const official = recentSessions(records, rule.gameId, 'official');
  const best = rule.best === 'completion' ? null : (records.best[rule.gameId] ?? null);
  return { best, officialRecent: official.length, average: summarize(rule, official).average };
}

// ---------------------------------------------------------------------
// Official vs practice: never one average, never one trend line
// ---------------------------------------------------------------------
export type RoundType = 'official' | 'practice';

export type RoundGroup = {
  type: RoundType;
  sessions: GameSessionRecord[];
  summary: GameStatsSummary;
  points: ChartPoint[];
};

/**
 * The groups a filter shows: 'official' / 'practice' -> that group only;
 * 'all' -> BOTH groups side by side (each with its own summary and chart),
 * never merged. Empty groups are kept for the single-type filters (the
 * screen shows an empty state) and dropped from 'all'.
 */
export function roundGroups(rule: GameRecordRule, records: OwnerRecords, filter: SessionFilter, best: number | null): RoundGroup[] {
  const types: RoundType[] = filter === 'all' ? ['official', 'practice'] : [filter];
  return types
    .map((type) => {
      const sessions = recentSessions(records, rule.gameId, type);
      // Practice never holds the PB: only the official group gets the stored best.
      return { type, sessions, summary: summarize(rule, sessions), points: chartPoints(rule, sessions, type === 'official' ? best : null) };
    })
    .filter((group) => filter !== 'all' || group.sessions.length > 0);
}

// ---------------------------------------------------------------------
// Aggregate formatting (averages) - separate from formatMetric, which keeps
// formatting individual results exactly as before.
// ---------------------------------------------------------------------
const LOCALE_BY_LANGUAGE: Record<string, string> = { kg: 'ky', ru: 'ru', en: 'en' };

export function appLocale(language: string): string {
  return LOCALE_BY_LANGUAGE[language] ?? language;
}

function decimal(value: number, language: string, minimumIntegerDigits = 1): string {
  try {
    return new Intl.NumberFormat(appLocale(language), { maximumFractionDigits: 1, minimumFractionDigits: 0, minimumIntegerDigits, useGrouping: false }).format(value);
  } catch {
    const text = String(value);
    return minimumIntegerDigits > 1 && value < 10 ? `0${text}` : text;
  }
}

/**
 * An average as people should read it: up to ONE decimal (10.5, not 11),
 * no trailing ".0" (47, not 47.0), in the app's locale (RU: 10,5). Times
 * keep the same one-decimal precision as m:ss.s (0:41.3). Null for a
 * missing / non-finite / negative value - never a fabricated "0".
 */
export function formatAggregate(unit: GameRecordRule['primary']['unit'], value: number | null | undefined, language: string): string | null {
  if (value === null || value === undefined || !Number.isFinite(value) || value < 0) return null;
  const rounded = Math.round(value * 10) / 10;
  if (unit === 'seconds') {
    const minutes = Math.floor(rounded / 60);
    const seconds = Math.round((rounded - minutes * 60) * 10) / 10;
    return `${minutes}:${decimal(seconds, language, 2)}`;
  }
  if (unit === 'percent') return `${decimal(rounded, language)}%`;
  return decimal(rounded, language);
}
