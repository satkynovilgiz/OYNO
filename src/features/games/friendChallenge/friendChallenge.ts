import { GAME_RECORD_RULES, ruleFor, type GameRecordRule, type GameSessionRecord } from '../records/gameRecords';

/**
 * Challenge a Friend - the whole challenge lives in the link (no server, no
 * accounts, no identity): `oyno://games/<route>?challengeMetric=<m>&target=<n>`.
 * Only games whose record rule has a real comparable best can be
 * challenged (Kok Boru's win/draw/loss has no numeric target).
 */
export type ChallengeMetric = 'score' | 'time';
export type FriendChallenge = { gameId: string; metric: ChallengeMetric; target: number };

/** Sensible bounds per metric (anything else is treated as invalid). */
const RANGE: Record<ChallengeMetric, { min: number; max: number; integer: boolean }> = {
  score: { min: 1, max: 100000, integer: true },
  time: { min: 1, max: 3600, integer: false },
};

export function metricFor(rule: GameRecordRule): ChallengeMetric | null {
  if (rule.best === 'higher') return 'score';
  if (rule.best === 'lower') return 'time';
  return null;
}

/** Games that can be challenged. */
export function challengeableGames(): string[] {
  return Object.values(GAME_RECORD_RULES).filter((rule) => metricFor(rule) !== null).map((rule) => rule.gameId);
}

/** A finished round that may become a challenge: official play, a real
 * value, and (for "lower is better") only a round that counts as a best
 * (Kyz Kuumai: a catch). */
export function challengeFromSession(session: GameSessionRecord): FriendChallenge | null {
  const rule = ruleFor(session.gameId);
  if (!rule || session.practice) return null;
  const metric = metricFor(rule);
  if (!metric || !rule.eligibleForBest(session)) return null;
  const target = RANGE[metric].integer ? Math.round(session.primary) : Math.round(session.primary * 10) / 10;
  return isInRange(metric, target) ? { gameId: rule.gameId, metric, target } : null;
}

function isInRange(metric: ChallengeMetric, value: number): boolean {
  const range = RANGE[metric];
  return Number.isFinite(value) && value >= range.min && value <= range.max && (!range.integer || Number.isInteger(value));
}

/** Path + query for the game's EXISTING route. */
export function challengePath(challenge: FriendChallenge): { path: string; query: { challengeMetric: ChallengeMetric; target: string } } | null {
  const rule = ruleFor(challenge.gameId);
  if (!rule || metricFor(rule) !== challenge.metric) return null;
  return { path: rule.route.replace(/^\//, ''), query: { challengeMetric: challenge.metric, target: String(challenge.target) } };
}

/**
 * Incoming params are UNTRUSTED: known game, the metric that game really
 * uses, a finite number in range. Anything else -> null (the screen just
 * opens normally). Never throws.
 */
export function parseChallenge(gameId: string, params: { challengeMetric?: unknown; target?: unknown }): FriendChallenge | null {
  try {
    const rule = ruleFor(gameId);
    if (!rule) return null;
    const metric = metricFor(rule);
    if (!metric || params.challengeMetric !== metric) return null;
    if (typeof params.target !== 'string' || !/^\d+(\.\d+)?$/.test(params.target.trim())) return null;
    const target = Number(params.target);
    return isInRange(metric, target) ? { gameId, metric, target } : null;
  } catch {
    return null;
  }
}

/** Did this round beat the target? Same semantics as the game's own best
 * rule: higher score wins; for time, only a counting round (a catch) that
 * is faster. Equal is not beaten. */
export function beatsTarget(challenge: FriendChallenge, session: GameSessionRecord): boolean {
  const rule = ruleFor(challenge.gameId);
  if (!rule || session.gameId !== challenge.gameId || session.practice) return false;
  if (challenge.metric === 'score') return session.primary > challenge.target;
  return rule.eligibleForBest(session) && session.primary < challenge.target;
}
