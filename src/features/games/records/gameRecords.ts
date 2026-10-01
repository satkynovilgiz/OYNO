/**
 * Game Records + Personal Bests - pure rules, no storage, no UI.
 *
 * Every game keeps its OWN records: a Jaa Atuu score is never compared with
 * a Kok Boru score, and there is no overall rating. How a game's best is
 * judged is stated explicitly in GAME_RECORD_RULES - never inferred.
 */

export type GameRecordResult = 'win' | 'loss' | 'draw' | 'completed';
export type BestRule = 'higher' | 'lower' | 'completion';
export type MetricUnit = 'points' | 'seconds' | 'goals' | 'percent' | 'count' | 'speed';

export type GameSessionRecord = {
  id: string;
  /** The game's progress id (GAME_ID in its *Game.tsx, e.g. 'jaa_atuu'). */
  gameId: string;
  completedAt: string;
  /** Practice rounds are kept, labelled, and never become the best. */
  practice: boolean;
  result: GameRecordResult;
  /** The game's primary measurement for this round (see its rule). */
  primary: number;
  /** Extra real measurements, keyed by metric id in the rule. */
  secondary: Record<string, number>;
};

export type GameRecordRule = {
  /** The game's progress id. */
  gameId: string;
  /** Its id in the games list (routes, titles, artwork). */
  listId: string;
  route: string;
  best: BestRule;
  primary: { unit: MetricUnit };
  /** Secondary metrics worth showing, in order. */
  secondary: { id: string; unit: MetricUnit; labelKey: string }[];
  /** Which official (non-practice) rounds may hold the best at all. */
  eligibleForBest: (session: GameSessionRecord) => boolean;
};

const always = () => true;

/**
 * Audited from each game's own result code (src/games3d/games/*):
 * - Jaa Atuu: total score of a normal round (practice has 15 arrows, so its
 *   totals aren't comparable). Accuracy / bullseyes / best shot are real.
 * - Ordo, Chuko: the player's score in a normal match vs the AI; practice
 *   never reaches a result screen.
 * - Kyz Kuumai: a chase - catching her FASTER is better, so lower seconds,
 *   and only catches count (an escape has no comparable time).
 * - Kok Boru: a 1v1 match is win / draw / loss; goals aren't a fair
 *   "higher is better" score across matches, so there is no numeric best -
 *   records show results and wins only.
 */
export const GAME_RECORD_RULES: Record<string, GameRecordRule> = {
  jaa_atuu: {
    gameId: 'jaa_atuu',
    listId: 'zhaa-atuu',
    route: '/games/jaa-atuu',
    best: 'higher',
    primary: { unit: 'points' },
    secondary: [
      { id: 'accuracy', unit: 'percent', labelKey: 'games3d.result.accuracy' },
      { id: 'bullseyes', unit: 'count', labelKey: 'games3d.result.bullseyes' },
      { id: 'bestShot', unit: 'points', labelKey: 'games3d.result.bestShot' },
    ],
    eligibleForBest: always,
  },
  ordo: {
    gameId: 'ordo',
    listId: 'ordo',
    route: '/games/ordo',
    best: 'higher',
    primary: { unit: 'points' },
    secondary: [{ id: 'captures', unit: 'count', labelKey: 'gameRecords.metric.captures' }],
    eligibleForBest: always,
  },
  chuko: {
    gameId: 'chuko',
    listId: 'chuko',
    route: '/games/chuko',
    best: 'higher',
    primary: { unit: 'points' },
    secondary: [],
    eligibleForBest: always,
  },
  kyz_kuumai: {
    gameId: 'kyz_kuumai',
    listId: 'kyz-kuumay',
    route: '/games/kyz-kuumai',
    best: 'lower',
    primary: { unit: 'seconds' },
    secondary: [{ id: 'topSpeed', unit: 'speed', labelKey: 'gameRecords.metric.topSpeed' }],
    eligibleForBest: (session) => session.result === 'win',
  },
  kok_boru: {
    gameId: 'kok_boru',
    listId: 'kok-boru',
    route: '/games/kok-boru',
    best: 'completion',
    primary: { unit: 'goals' },
    secondary: [],
    eligibleForBest: () => false,
  },
};

export const MAX_RECENT_SESSIONS = 10;

export function ruleFor(gameId: string): GameRecordRule | null {
  return GAME_RECORD_RULES[gameId] ?? null;
}

/** Strictly better under the game's rule - an equal result is NOT a new
 * best. */
export function isBetter(rule: GameRecordRule, candidate: number, current: number | null): boolean {
  if (rule.best === 'completion') return false;
  if (current === null) return true;
  return rule.best === 'higher' ? candidate > current : candidate < current;
}

export type GameRecordSummary = {
  gameId: string;
  /** Rounds recorded on this device since Game Records began. */
  sessions: number;
  best: number | null;
  latest: GameSessionRecord | null;
  wins: number;
};

export type RecordOutcome = {
  /** Shown as "New personal best" only when a previous best was beaten. */
  isNewBest: boolean;
  previousBest: number | null;
  best: number | null;
};

/**
 * Applies one finished round: returns the new best and whether it is a NEW
 * personal best. The first-ever best isn't announced (nothing was beaten);
 * practice and ineligible rounds never touch the best.
 */
export function applySession(rule: GameRecordRule, currentBest: number | null, session: GameSessionRecord): RecordOutcome {
  if (session.practice || rule.best === 'completion' || !rule.eligibleForBest(session) || !Number.isFinite(session.primary)) {
    return { isNewBest: false, previousBest: currentBest, best: currentBest };
  }
  if (!isBetter(rule, session.primary, currentBest)) return { isNewBest: false, previousBest: currentBest, best: currentBest };
  return { isNewBest: currentBest !== null, previousBest: currentBest, best: session.primary };
}

/** Newest first, capped - no giant history. */
export function addRecent(list: readonly GameSessionRecord[], session: GameSessionRecord, max = MAX_RECENT_SESSIONS): GameSessionRecord[] {
  return [session, ...list.filter((existing) => existing.id !== session.id)].slice(0, max);
}

/** A finished round from a game's own result summary. Only call this from
 * the RESULT phase - loading failures, tutorial exits, quits and pauses
 * never reach it, so they are never recorded. */
export function makeSession(gameId: string, input: Omit<GameSessionRecord, 'id' | 'gameId' | 'completedAt'>, now = new Date()): GameSessionRecord {
  return { id: `${gameId}:${now.getTime()}:${Math.floor(Math.random() * 1e6)}`, gameId, completedAt: now.toISOString(), ...input };
}

type Translate = (key: string, options?: Record<string, unknown>) => string;

/** "24 points", "1:05", "3 goals" - localized through gameRecords.unit.*. */
export function formatMetric(unit: MetricUnit, value: number, t: Translate): string {
  if (unit === 'seconds') {
    const whole = Math.max(0, Math.round(value));
    return t('gameRecords.unit.time', { time: `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}` });
  }
  if (unit === 'percent') return t('gameRecords.unit.percent', { value: Math.round(value) });
  return t(`gameRecords.unit.${unit}`, { count: Math.round(value * (unit === 'speed' ? 10 : 1)) / (unit === 'speed' ? 10 : 1) });
}
