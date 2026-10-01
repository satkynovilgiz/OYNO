import type { RegionExperienceConfig } from '@/features/explore/regions/regionExperiences';
import { computeRegionProgress, pickStartHere, regionStatus, type RegionProgress, type RegionSignals, type StartHere } from '@/features/explore/regions/regionModel';

export type ContinueRegion =
  | { kind: 'continue' | 'start'; config: RegionExperienceConfig; progress: RegionProgress; next: StartHere }
  | { kind: 'allDone' };

/**
 * Home "Continue exploring" - a pure, deterministic pick (no recommendation
 * service), in this order:
 *  1. a region in progress - the one with the most recent REAL visit to any
 *     of its places (regionVisitDates); ties / no dates -> region order;
 *  2. nothing in progress -> the first not-started region in region order
 *     ('start' when no region has been started at all, so a new user is
 *     never told to "continue");
 *  3. everything completed -> 'allDone'.
 * The next activity is the Region Hub's own pickStartHere, so Home and the
 * hub always agree.
 */
export function pickContinueRegion(configs: readonly RegionExperienceConfig[], signals: RegionSignals, visitDates: Readonly<Record<string, string>>): ContinueRegion {
  const entries = configs.map((config, order) => {
    const progress = computeRegionProgress(config, signals);
    const lastVisit = config.destinationIds.map((id) => visitDates[id] ?? '').reduce((latest, date) => (date > latest ? date : latest), '');
    return { config, order, progress, status: regionStatus(progress), lastVisit };
  });
  const inProgress = entries
    .filter((entry) => entry.status === 'in_progress')
    .sort((a, b) => b.lastVisit.localeCompare(a.lastVisit) || a.order - b.order);
  if (inProgress[0]) return { kind: 'continue', config: inProgress[0].config, progress: inProgress[0].progress, next: pickStartHere(inProgress[0].config, signals) };
  const notStarted = entries.find((entry) => entry.status === 'not_started');
  if (notStarted) {
    const anyStarted = entries.some((entry) => entry.status !== 'not_started');
    return { kind: anyStarted ? 'continue' : 'start', config: notStarted.config, progress: notStarted.progress, next: pickStartHere(notStarted.config, signals) };
  }
  return { kind: 'allDone' };
}
