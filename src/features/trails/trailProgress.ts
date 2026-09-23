import { computeCollectionProgress, type CollectionProgressSignals } from '@/features/collections/collectionProgress';
import { getCollection } from '@/features/collections/collectionsData';
import { progressGameIdFor } from '@/features/games/progressGameIds';
import { isInteractiveExperienceCompleted } from '@/features/home/continueJourney';

import type { Trail, TrailStepRef } from './trailsData';

/**
 * The ONLY trail progress calculation (Explore row, trail detail, My
 * Journey, Search and Home all call `computeTrailProgress`). A step counts
 * only when OYNO already records a trustworthy signal for it:
 * - destination -> `visitedRegionIds` (the same visit Passport/Explore use)
 * - interactive_experience -> its server-side completion flag
 * - game -> played at least once, ONLY for games that actually record plays
 * - collection -> `computeCollectionProgress(...).status === 'completed'`
 * Culture items/materials have no stored "read" signal, and games that
 * never record a play (e.g. Besh Tash) can't be verified - those steps are
 * `info`: shown in the journey, never counted, never faked as done.
 */

/** Games list ids whose game screen calls `recordGamePlayed`
 * (src/games3d/games/*): Chuko, Ordo, Jaa Atuu, Kyz Kuumai, Kok Boru. */
export const PLAY_TRACKED_GAME_IDS = new Set(['chuko', 'ordo', 'zhaa-atuu', 'kyz-kuumay', 'kok-boru']);

export type TrailSignals = CollectionProgressSignals & { visitedRegionIds: string[] };

export type TrailStepState = 'completed' | 'todo' | 'info';

export type TrailStepProgress = { step: TrailStepRef; state: TrailStepState };

export type TrailStatus = 'unstarted' | 'inProgress' | 'completed' | 'untracked';

export type TrailProgress = {
  steps: TrailStepProgress[];
  completed: number;
  total: number;
  status: TrailStatus;
  /** First incomplete trackable step in trail order, or null when done. */
  nextStep: TrailStepRef | null;
};

export function trailStepState(step: TrailStepRef, signals: TrailSignals): TrailStepState {
  switch (step.type) {
    case 'destination':
      return signals.visitedRegionIds.includes(step.id) ? 'completed' : 'todo';
    case 'interactive_experience':
      return isInteractiveExperienceCompleted(step.id, signals.completionFlags) ? 'completed' : 'todo';
    case 'game':
      if (!PLAY_TRACKED_GAME_IDS.has(step.id)) return 'info';
      return (signals.gameStats[progressGameIdFor(step.id)]?.played ?? 0) > 0 ? 'completed' : 'todo';
    case 'collection': {
      const collection = getCollection(step.id);
      if (!collection) return 'info';
      const progress = computeCollectionProgress(collection, signals);
      if (progress.status === 'untracked') return 'info';
      return progress.status === 'completed' ? 'completed' : 'todo';
    }
    default:
      return 'info';
  }
}

export function computeTrailProgress(trail: Trail, signals: TrailSignals): TrailProgress {
  const steps = trail.steps.map((step) => ({ step, state: trailStepState(step, signals) }));
  const trackable = steps.filter((entry) => entry.state !== 'info');
  const completed = trackable.filter((entry) => entry.state === 'completed').length;
  const total = trackable.length;
  const status: TrailStatus = total === 0 ? 'untracked' : completed === 0 ? 'unstarted' : completed < total ? 'inProgress' : 'completed';
  const nextStep = steps.find((entry) => entry.state === 'todo')?.step ?? null;
  return { steps, completed, total, status, nextStep };
}

export type TrailCatalog = {
  destinationIds: string[];
  cultureItemIds: string[];
  cultureMaterialIds: string[];
  interactiveIds: string[];
  /** Games that have a playable route. */
  gameIds: string[];
  collectionIds: string[];
};

/** Definition check: every step must reference real content, no step may
 * appear twice, and a trail must have at least one trackable step type. */
export function validateTrail(trail: Trail, catalog: TrailCatalog): string[] {
  const errors: string[] = [];
  const seen = new Set<string>();
  const known: Record<TrailStepRef['type'], string[]> = {
    destination: catalog.destinationIds,
    culture_item: catalog.cultureItemIds,
    culture_material: catalog.cultureMaterialIds,
    interactive_experience: catalog.interactiveIds,
    game: catalog.gameIds,
    collection: catalog.collectionIds,
  };
  for (const step of trail.steps) {
    const key = `${step.type}:${step.id}`;
    if (seen.has(key)) errors.push(`duplicate step ${key}`);
    seen.add(key);
    if (!known[step.type].includes(step.id)) errors.push(`missing ${key}`);
  }
  if (trail.steps.length === 0) errors.push('empty trail');
  return errors;
}
