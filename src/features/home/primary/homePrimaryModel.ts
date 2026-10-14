import type { ReadingProgress } from '@/features/culture/reading/readingModel';
import type { RecoveryKind } from '@/features/recovery/recoveryModel';

import type { HomeRecommendation } from '../homeRecommendation';

/**
 * Home's three primary actions - Discover, Create, Continue - as pure
 * rules over state OYNO already keeps. Nothing here invents activity:
 * every Continue card points at real unfinished work of the CURRENT owner.
 *
 * Continue - ONE card, first match wins:
 *  1. unsaved   - edits the Recovery Center lists for this owner (they can
 *                 be lost, so they come first). One entry opens its own
 *                 editor; several open the Recovery Center. Labels name
 *                 the KIND of work only - never the record's text.
 *  2. guide     - the getting-started guide the person started.
 *  3. reading   - the most recent unfinished article (Continue Reading),
 *                 back to its section when one was recorded.
 *  4. journey   - Home's recommendation when it is genuinely a
 *                 continuation (trail / quest / collection / passport in
 *                 progress). "Play again" is not unfinished work.
 *  Nothing -> null: Home shows the first-use or "nothing unfinished" state
 *  instead, never an invented card.
 *
 * Offline: a candidate whose screen can't open with the data on the device
 * is skipped (unsaved work falls back to the Recovery Center, which is local).
 */

export type PrimaryActionId = 'discover' | 'create' | 'continue';
export const PRIMARY_ACTIONS: readonly PrimaryActionId[] = ['discover', 'create', 'continue'];
/** Existing destinations: Culture is the Discover hub; /create groups the making tools. */
export const DISCOVER_ROUTE = '/culture';
export const CREATE_ROUTE = '/create';
export const RECOVERY_ROUTE = '/profile/recovery';
export const GUIDE_ROUTE = '/start';

export type UnsavedEntry = { kind: RecoveryKind; route: string; survivesRestart: boolean };

export type ContinuePick =
  | { kind: 'unsaved'; count: number; entryKind: RecoveryKind | null; route: string; survivesRestart: boolean }
  | { kind: 'guide'; route: string }
  | { kind: 'reading'; record: ReadingProgress; route: string }
  | { kind: 'journey'; recommendation: HomeRecommendation; route: string };

export type ContinueInputs = {
  unsaved: readonly UnsavedEntry[];
  guideActive: boolean;
  /** continueReading()'s answer (stale content already skipped) and its base route. */
  reading: { record: ReadingProgress; route: string } | null;
  recommendation: HomeRecommendation | null;
  isAvailable: (route: string) => boolean;
};

/** A recommendation that is real unfinished progress (the Continue card's), not a suggestion. */
export function isContinuation(recommendation: HomeRecommendation | null): recommendation is HomeRecommendation {
  return !!recommendation && recommendation.mode === 'continue' && recommendation.kind !== 'game';
}

export function readingRoute(base: string, record: ReadingProgress): string {
  return record.lastSectionKey ? `${base}?section=${encodeURIComponent(record.lastSectionKey)}` : base;
}

export function pickContinue(input: ContinueInputs): ContinuePick | null {
  // The guide's own pending step is the guide card, not an unsaved edit.
  const unsaved = input.unsaved.filter((entry) => entry.kind !== 'firstUse');
  if (unsaved.length > 0) {
    const only = unsaved.length === 1 ? unsaved[0] : null;
    const route = only && input.isAvailable(only.route) ? only.route : RECOVERY_ROUTE;
    return { kind: 'unsaved', count: unsaved.length, entryKind: only?.kind ?? null, route, survivesRestart: unsaved.every((entry) => entry.survivesRestart) };
  }
  if (input.guideActive) return { kind: 'guide', route: GUIDE_ROUTE };
  if (input.reading) {
    const route = readingRoute(input.reading.route, input.reading.record);
    if (input.isAvailable(input.reading.route)) return { kind: 'reading', record: input.reading.record, route };
  }
  if (isContinuation(input.recommendation) && input.isAvailable(input.recommendation.route)) {
    return { kind: 'journey', recommendation: input.recommendation, route: input.recommendation.route };
  }
  return null;
}

/**
 * Who Home is talking to. 'new' only when there is no trace of use at all
 * (no reading, no visits/daily history, no games played, no guide), so a
 * returning person is never greeted as new. 'returning' with nothing
 * unfinished gets an honest "nothing to continue" line.
 */
export type HomeAudience = 'new' | 'returning';
export function homeAudience(input: { pick: ContinuePick | null; hasReading: boolean; hasRecent: boolean; hasPlayed: boolean; guideStarted: boolean }): HomeAudience {
  return input.pick || input.hasReading || input.hasRecent || input.hasPlayed || input.guideStarted ? 'returning' : 'new';
}

/** Hero rule: when the recommendation is a continuation it lives in the Continue card only (never twice). */
export function heroShowsRecommendation(recommendation: HomeRecommendation): boolean {
  return !isContinuation(recommendation);
}
