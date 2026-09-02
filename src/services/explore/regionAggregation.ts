import { calculateRegionCompletion, type RegionCompletion } from './regionState';
import type { QuestStep } from './questSteps';

export type AggregationDiscovery = { id: string; regionId: string | null };

export type RegionAggregationInput = {
  regionIds: string[];
  visitedRegionIds: string[];
  discoveries: AggregationDiscovery[];
  discoveredIds: string[];
  questSteps: QuestStep[];
  completedStepIds: string[];
};

/**
 * Ties together the three independent per-user signals (visited regions,
 * found discoveries, completed quest steps) into one RegionCompletion per
 * region - the single shared computation both the map badges and the
 * region detail screen read from, so they can never disagree.
 */
export function computeRegionCompletions(input: RegionAggregationInput): Record<string, RegionCompletion> {
  const { regionIds, visitedRegionIds, discoveries, discoveredIds, questSteps, completedStepIds } = input;

  const discoveryRegionOf = new Map(discoveries.map((d) => [d.id, d.regionId]));

  const result: Record<string, RegionCompletion> = {};
  for (const regionId of regionIds) {
    const discoveriesForRegion = discoveries.filter((d) => d.regionId === regionId);
    const discoveriesFound = discoveriesForRegion.filter((d) => discoveredIds.includes(d.id)).length;

    const questStepsForRegion = questSteps.filter((step) => {
      if (step.stepType === 'VISIT_LOCATION') return step.targetId === regionId;
      if (step.stepType === 'DISCOVER_ITEM') return discoveryRegionOf.get(step.targetId) === regionId;
      return false;
    });
    const questStepsCompleted = questStepsForRegion.filter((step) => completedStepIds.includes(step.id)).length;

    result[regionId] = calculateRegionCompletion({
      published: true,
      visited: visitedRegionIds.includes(regionId),
      discoveriesTotal: discoveriesForRegion.length,
      discoveriesFound,
      questStepsTotal: questStepsForRegion.length,
      questStepsCompleted,
    });
  }
  return result;
}
