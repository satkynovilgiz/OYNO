import { progressGameIdFor } from '@/features/games/progressGameIds';
import { isInteractiveExperienceCompleted, type InteractiveCompletionFlags } from '@/features/home/continueJourney';
import type { GameStat } from '@/store/useProgressStore';

import type { Collection, CollectionSectionRef } from './collectionsData';

/**
 * Collection progress, computed ONLY from content types OYNO already
 * records a real completion signal for:
 * - interactive experiences -> the four server-side flags (bozUyVisited,
 *   oymoCreated, shyrdakCreated, komuzLessonCompleted), the same ones Home
 *   and Journey read;
 * - games -> "played at least once" from `gameStats` (via the recorded
 *   progress id), the same signal Journey's Played chapter uses.
 * Culture items/materials have no stored "read" signal, so they are never
 * counted and never shown as done - they stay pure storytelling.
 *
 * The Culture card, the Collection detail screen and My Journey all call
 * this one function, so there is exactly one progress calculation.
 */

export type CollectionProgressSignals = {
  completionFlags: InteractiveCompletionFlags;
  gameStats: Record<string, GameStat>;
};

export type RefState = 'completed' | 'untouched' | 'untracked';

export type CollectionStatus = 'unstarted' | 'inProgress' | 'completed' | 'untracked';

export type CollectionProgress = {
  completed: number;
  total: number;
  status: CollectionStatus;
  stateOf: (ref: CollectionSectionRef) => RefState;
};

export function refState(ref: CollectionSectionRef, signals: CollectionProgressSignals): RefState {
  if (ref.kind === 'interactive_experience') {
    return isInteractiveExperienceCompleted(ref.id, signals.completionFlags) ? 'completed' : 'untouched';
  }
  if (ref.kind === 'game') {
    return (signals.gameStats[progressGameIdFor(ref.id)]?.played ?? 0) > 0 ? 'completed' : 'untouched';
  }
  return 'untracked';
}

export function computeCollectionProgress(collection: Collection, signals: CollectionProgressSignals): CollectionProgress {
  const states = collection.sections.map((ref) => refState(ref, signals));
  const total = states.filter((state) => state !== 'untracked').length;
  const completed = states.filter((state) => state === 'completed').length;
  const status: CollectionStatus = total === 0 ? 'untracked' : completed === 0 ? 'unstarted' : completed < total ? 'inProgress' : 'completed';
  return { completed, total, status, stateOf: (ref) => refState(ref, signals) };
}
