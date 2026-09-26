import type { CaptureOutcome } from './OrdoRulesEngine';
import { ORDO_CAPTURES_BEFORE_KHAN, type OrdoSide } from './OrdoTypes';

export type OrdoOutcomeMessage = { key: string; params?: Record<string, number>; tone: 'neutral' | 'accent' };

/**
 * One short line explaining what the rules engine decided for a settled
 * throw - only events that actually happened (never a generic "nice!").
 * Priority: khan captured > khan hit too early (returned to the ring) >
 * pieces cleared (+ "the khan is open now" when that crosses the
 * threshold) > nothing captured. `capturesBefore` = the thrower's regular
 * captures before this throw.
 */
export function describeOrdoOutcome(outcome: CaptureOutcome, side: OrdoSide, capturesBefore: number): OrdoOutcomeMessage {
  const mine = side === 'player';
  const cleared = outcome.legalCaptures.filter((piece) => piece.kind === 'regular').length;
  const capturesAfter = capturesBefore + cleared;

  if (outcome.khanCapturedBy) {
    return { key: mine ? 'games3d.ordo.outcome.khanCaptured' : 'games3d.ordo.outcome.khanCapturedAi', tone: mine ? 'accent' : 'neutral' };
  }
  if (outcome.rejectedKhanId) {
    const remaining = Math.max(0, ORDO_CAPTURES_BEFORE_KHAN - capturesAfter);
    return { key: mine ? 'games3d.ordo.outcome.khanTooEarly' : 'games3d.ordo.outcome.khanTooEarlyAi', params: { count: remaining }, tone: 'neutral' };
  }
  if (cleared > 0) {
    if (mine && capturesBefore < ORDO_CAPTURES_BEFORE_KHAN && capturesAfter >= ORDO_CAPTURES_BEFORE_KHAN) {
      return { key: 'games3d.ordo.outcome.khanOpen', params: { count: cleared }, tone: 'accent' };
    }
    return { key: mine ? 'games3d.ordo.outcome.cleared' : 'games3d.ordo.outcome.clearedAi', params: { count: cleared }, tone: mine ? 'accent' : 'neutral' };
  }
  return { key: mine ? 'games3d.ordo.outcome.noCapture' : 'games3d.ordo.outcome.noCaptureAi', tone: 'neutral' };
}
