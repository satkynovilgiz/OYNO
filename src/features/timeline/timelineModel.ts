import { activitiesThisWeek, collectActivityEvents, weekStart } from '@/features/goals/weeklyGoal';
import { isBetter, ruleFor, type GameSessionRecord } from '@/features/games/records/gameRecords';
import type { OwnerRecords } from '@/store/useGameRecordsStore';

/**
 * My Learning Timeline - a private, DATED history derived from existing
 * records (no second activity database). Only events with a trustworthy
 * timestamp:
 *   reading_completed   Reading progress completedAt (first completion)
 *   challenge_completed challenge result completedAt (first completion)
 *   study_session       glossary study session completion time
 *   path_step           Learning Path step the person marked complete
 *   game_played         a normal (non-practice) round kept in game records
 *   personal_best       ONLY when the device still has the game's FULL round
 *                       history (rounds played == rounds kept), so the round
 *                       that set each best is known - never guessed
 *   listening_finished  the player itself reported the end (completed)
 * Never: opens, searches, favorites, shares, notes, Journal, gallery.
 * Learning Path COMPLETION is omitted: not every step has a reliable date.
 */

export type TimelineKind = 'reading_completed' | 'challenge_completed' | 'study_session' | 'path_step' | 'game_played' | 'personal_best' | 'listening_finished';
export type TimelineFilter = 'all' | 'reading' | 'study' | 'games' | 'audio';
export const TIMELINE_FILTERS: readonly TimelineFilter[] = ['all', 'reading', 'study', 'games', 'audio'];

export type TimelineEvent = {
  id: string;
  kind: TimelineKind;
  at: string;
  /** What it was about - resolved to a title by the screen. */
  ref: { type: 'culture_item' | 'culture_material' | 'challenge' | 'path' | 'game' | 'listening' | 'glossary'; id: string; stepId?: string };
  /** A real recorded value (game primary metric). */
  value: number | null;
  /** Also counted by the Weekly Goal (same completion logic). */
  weeklyGoal: boolean;
};

const FILTER_KINDS: Record<Exclude<TimelineFilter, 'all'>, TimelineKind[]> = {
  reading: ['reading_completed'],
  study: ['challenge_completed', 'study_session', 'path_step'],
  games: ['game_played', 'personal_best'],
  audio: ['listening_finished'],
};

export type TimelineInput = {
  readings: readonly { contentType: string; contentId: string; completedAt: string | null }[];
  challengeResults: Record<string, { completedAt: string | null }>;
  glossarySessions: readonly string[];
  manualPathSteps: Record<string, Record<string, string>>;
  gameRecords: OwnerRecords;
  listening: readonly { key: string; sourceType: string; sourceId: string; completed: boolean; lastListenedAt: string }[];
};

const validTime = (at: string) => !Number.isNaN(Date.parse(at));

/** The round(s) that set a NEW best - only when the full history is kept. */
export function personalBestRounds(gameId: string, recent: readonly GameSessionRecord[], roundsPlayed: number): GameSessionRecord[] {
  const rule = ruleFor(gameId);
  if (!rule || rule.best === 'completion' || roundsPlayed === 0 || roundsPlayed !== recent.length) return [];
  const chronological = [...recent].filter((session) => validTime(session.completedAt)).sort((a, b) => a.completedAt.localeCompare(b.completedAt) || a.id.localeCompare(b.id));
  let best: number | null = null;
  const result: GameSessionRecord[] = [];
  for (const session of chronological) {
    if (session.practice || !rule.eligibleForBest(session) || !Number.isFinite(session.primary)) continue;
    if (isBetter(rule, session.primary, best)) {
      // The very first best isn't "new" (nothing was beaten) - same as the result screen.
      if (best !== null) result.push(session);
      best = session.primary;
    }
  }
  return result;
}

export function buildTimeline(input: TimelineInput, now: Date): TimelineEvent[] {
  const gameSessions = Object.values(input.gameRecords.recent).flat();
  const goalEvents = collectActivityEvents({ readings: input.readings, challengeResults: input.challengeResults, glossarySessions: input.glossarySessions, manualPathSteps: input.manualPathSteps, gameSessions });
  const counted = new Set(activitiesThisWeek(goalEvents, now).map((event) => event.id));
  const events: TimelineEvent[] = [];
  const add = (event: Omit<TimelineEvent, 'weeklyGoal'>, goalId: string | null) => {
    if (!validTime(event.at)) return;
    events.push({ ...event, weeklyGoal: goalId !== null && counted.has(goalId) });
  };

  for (const reading of input.readings) {
    if (!reading.completedAt) continue;
    add({ id: `reading:${reading.contentType}:${reading.contentId}`, kind: 'reading_completed', at: reading.completedAt, ref: { type: reading.contentType === 'culture_material' ? 'culture_material' : 'culture_item', id: reading.contentId }, value: null }, `reading:${reading.contentType}:${reading.contentId}`);
  }
  for (const [key, result] of Object.entries(input.challengeResults)) {
    if (result.completedAt) add({ id: `challenge:${key}`, kind: 'challenge_completed', at: result.completedAt, ref: { type: 'challenge', id: key }, value: null }, `challenge:${key}`);
  }
  for (const at of new Set(input.glossarySessions)) add({ id: `glossary:${at}`, kind: 'study_session', at, ref: { type: 'glossary', id: 'study' }, value: null }, `glossary:${at}`);
  for (const [pathId, steps] of Object.entries(input.manualPathSteps)) {
    for (const [stepId, at] of Object.entries(steps)) add({ id: `path:${pathId}:${stepId}`, kind: 'path_step', at, ref: { type: 'path', id: pathId, stepId }, value: null }, `path:${pathId}:${stepId}`);
  }
  const seenRounds = new Set<string>();
  for (const session of gameSessions) {
    if (session.practice || seenRounds.has(session.id)) continue;
    seenRounds.add(session.id);
    add({ id: `game:${session.id}`, kind: 'game_played', at: session.completedAt, ref: { type: 'game', id: session.gameId }, value: Number.isFinite(session.primary) ? session.primary : null }, `game:${session.id}`);
  }
  for (const [gameId, recent] of Object.entries(input.gameRecords.recent)) {
    for (const session of personalBestRounds(gameId, recent, input.gameRecords.sessions[gameId] ?? 0)) {
      add({ id: `pb:${session.id}`, kind: 'personal_best', at: session.completedAt, ref: { type: 'game', id: gameId }, value: session.primary }, null);
    }
  }
  for (const record of input.listening) {
    if (record.completed) add({ id: `listen:${record.key}:${record.lastListenedAt}`, kind: 'listening_finished', at: record.lastListenedAt, ref: { type: 'listening', id: record.key }, value: null }, null);
  }

  const unique = new Map(events.map((event) => [event.id, event]));
  return [...unique.values()].sort((a, b) => b.at.localeCompare(a.at) || a.id.localeCompare(b.id));
}

export function filterTimeline(events: readonly TimelineEvent[], filter: TimelineFilter): TimelineEvent[] {
  return filter === 'all' ? [...events] : events.filter((event) => FILTER_KINDS[filter].includes(event.kind));
}

/** Default window: the last 60 days (or everything). */
export const DEFAULT_DAYS = 60;
export function withinRange(events: readonly TimelineEvent[], now: Date, allHistory: boolean): TimelineEvent[] {
  if (allHistory) return [...events];
  const since = now.getTime() - DEFAULT_DAYS * 24 * 60 * 60 * 1000;
  return events.filter((event) => Date.parse(event.at) >= since);
}

export type TimelineGroup = 'today' | 'yesterday' | 'this_week' | 'earlier';

/** Local-calendar grouping (week = Monday-Sunday, like Weekly Goals). */
export function groupOf(at: string, now: Date): TimelineGroup {
  const date = new Date(at);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const time = date.getTime();
  if (time >= startOfToday) return 'today';
  if (time >= startOfToday - 24 * 60 * 60 * 1000) return 'yesterday';
  if (time >= weekStart(now).getTime()) return 'this_week';
  return 'earlier';
}

export function groupTimeline(events: readonly TimelineEvent[], now: Date): { group: TimelineGroup; events: TimelineEvent[] }[] {
  const order: TimelineGroup[] = ['today', 'yesterday', 'this_week', 'earlier'];
  return order.map((group) => ({ group, events: events.filter((event) => groupOf(event.at, now) === group) })).filter((entry) => entry.events.length > 0);
}

/** Route for an event, or null when the source no longer exists. */
export function timelineRoute(ref: TimelineEvent['ref'], exists: (ref: TimelineEvent['ref']) => boolean, gameRoute: (gameId: string) => string | null): string | null {
  if (!exists(ref)) return null;
  switch (ref.type) {
    case 'culture_item':
      return `/culture/item/${ref.id}`;
    case 'culture_material':
      return `/culture/material/${ref.id}`;
    case 'challenge': {
      if (ref.id.startsWith('collection:')) return `/challenges/collection-${ref.id.slice('collection:'.length)}`;
      if (ref.id === 'journey') return '/challenges/journey';
      return '/challenges';
    }
    case 'path':
      return `/learn/${ref.id}`;
    case 'game':
      return gameRoute(ref.id);
    case 'glossary':
      return '/culture/glossary';
    case 'listening':
      return '/profile/listening';
  }
}
