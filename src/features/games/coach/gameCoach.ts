import type { GameSessionRecord } from '../records/gameRecords';

/**
 * Game Coach - deterministic, hand-authored tips (no AI, no generated
 * advice). Every rule reads ONLY fields the game really records
 * (useRoundRecords -> GameSessionRecord) and every tip restates a control
 * or rule that is true in that game's own code/tutorial:
 *   - Jaa Atuu: drag to aim, hold to draw, release (JaaAtuuController);
 *     accuracy = hits / arrows, bullseyes, best shot.
 *   - Ordo, Chuko: pull back to aim - the pull DISTANCE sets the power
 *     (controls/DragPowerController); Ordo: clear 3 pieces before the khan.
 *   - Kyz Kuumai: sprint drains stamina; a catch is a win.
 *   - Kok Boru: carry the ulak into your goal circle; ride close to steal.
 * Coach only reads records - it never writes a best, score or result.
 */

export type CoachTip = { gameId: string; tipId: string; tipKey: string; priority: number; practice: boolean };

type Window = GameSessionRecord[];
export type GameCoachRule = {
  gameId: string;
  tipId: string;
  priority: number;
  /** Offer the existing Practice mode with this tip. */
  practice: boolean;
  condition: (recent: Window) => boolean;
};

/** Recent window: the newest valid OFFICIAL rounds (practice is separate). */
export const COACH_WINDOW = 5;
/** A pattern needs at least this many rounds ("repeatedly"). */
export const MIN_ROUNDS = 3;

const avg = (values: number[]) => (values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0);
const lastN = (recent: Window, n = MIN_ROUNDS) => recent.slice(0, n);
const metric = (session: GameSessionRecord, id: string) => (Number.isFinite(session.secondary[id]) ? session.secondary[id] : null);

export const COACH_RULES: readonly GameCoachRule[] = [
  // Jaa Atuu: most arrows missing the target.
  { gameId: 'jaa_atuu', tipId: 'jaa_aim_first', priority: 1, practice: true, condition: (recent) => lastN(recent).every((s) => metric(s, 'accuracy') !== null) && avg(lastN(recent).map((s) => metric(s, 'accuracy')!)) < 50 },
  // Jaa Atuu: hitting the target, but never the center.
  { gameId: 'jaa_atuu', tipId: 'jaa_center', priority: 2, practice: true, condition: (recent) => lastN(recent).every((s) => metric(s, 'accuracy') !== null && metric(s, 'accuracy')! >= 50 && metric(s, 'bullseyes') === 0) },
  // Ordo: few pieces knocked out per match.
  { gameId: 'ordo', tipId: 'ordo_pull_power', priority: 1, practice: false, condition: (recent) => lastN(recent).every((s) => metric(s, 'captures') !== null) && avg(lastN(recent).map((s) => metric(s, 'captures')!)) < 1 },
  // Ordo: losing most recent matches.
  { gameId: 'ordo', tipId: 'ordo_clear_three', priority: 2, practice: false, condition: (recent) => lastN(recent).filter((s) => s.result === 'loss').length >= 2 },
  // Chuko: losing most recent matches.
  { gameId: 'chuko', tipId: 'chuko_pull_power', priority: 1, practice: true, condition: (recent) => lastN(recent).filter((s) => s.result === 'loss').length >= 2 },
  // Kyz Kuumai: she got away in most recent chases.
  { gameId: 'kyz_kuumai', tipId: 'kyz_save_sprint', priority: 1, practice: true, condition: (recent) => lastN(recent).filter((s) => s.result === 'loss').length >= 2 },
  // Kok Boru: no goals in recent matches.
  { gameId: 'kok_boru', tipId: 'kok_carry_to_goal', priority: 1, practice: true, condition: (recent) => lastN(recent).every((s) => s.primary === 0) },
];

export const COACHED_GAMES = [...new Set(COACH_RULES.map((rule) => rule.gameId))];

/** Valid official rounds, newest first: practice and broken records are ignored. */
export function coachWindow(sessions: readonly GameSessionRecord[], gameId: string): Window {
  return sessions
    .filter((session) => session.gameId === gameId && !session.practice && Number.isFinite(session.primary) && !Number.isNaN(Date.parse(session.completedAt)))
    .sort((a, b) => b.completedAt.localeCompare(a.completedAt) || a.id.localeCompare(b.id))
    .slice(0, COACH_WINDOW);
}

export type CoachAdvice = { kind: 'first_time' } | { kind: 'tip'; tip: CoachTip } | { kind: 'none' };

/**
 * ONE piece of advice, deterministic:
 *   no official round yet   -> 'first_time' (the existing tutorial, no fake personalization)
 *   fewer than MIN_ROUNDS   -> nothing (not enough to see a pattern)
 *   a rule matches          -> the lowest priority number wins
 *   nothing matches         -> nothing (no invented problem)
 */
export function coachAdvice(gameId: string, sessions: readonly GameSessionRecord[]): CoachAdvice {
  if (!COACHED_GAMES.includes(gameId)) return { kind: 'none' };
  const recent = coachWindow(sessions, gameId);
  if (recent.length === 0) return { kind: 'first_time' };
  if (recent.length < MIN_ROUNDS) return { kind: 'none' };
  const rule = COACH_RULES.filter((candidate) => candidate.gameId === gameId)
    .sort((a, b) => a.priority - b.priority || a.tipId.localeCompare(b.tipId))
    .find((candidate) => candidate.condition(recent));
  return rule ? { kind: 'tip', tip: { gameId, tipId: rule.tipId, tipKey: `gameCoach.tips.${rule.tipId}`, priority: rule.priority, practice: rule.practice } } : { kind: 'none' };
}
