import { useMemo } from 'react';

import { useQuestProgress } from '@/features/quests/useQuests';
import { computeTrailProgress } from '@/features/trails/trailProgress';
import { getTrail } from '@/features/trails/trailsData';
import { useTrailSignals } from '@/features/trails/useTrailSignals';
import { useProgressStore } from '@/store/useProgressStore';

import { listRegionExperiences } from './regionExperiences';
import type { RegionSignals } from './regionModel';

/**
 * The one source of region progress signals, shared by the Region Hub and
 * the Explore "by region" rail so they can never disagree: visits,
 * discoveries, and trail / guided quest progress for every trail or quest
 * any region links.
 */
export function useRegionSignals(): RegionSignals {
  const visitedRegionIds = useProgressStore((state) => state.visitedRegionIds);
  const discoveredIds = useProgressStore((state) => state.discoveredExploreIds);
  const trailSignals = useTrailSignals();
  const questProgress = useQuestProgress();

  return useMemo(() => {
    const trailIds = new Set(listRegionExperiences().flatMap((config) => config.trailIds));
    const questIds = new Set(listRegionExperiences().flatMap((config) => config.questIds));
    const trails: RegionSignals['trails'] = {};
    for (const id of trailIds) {
      const trail = getTrail(id);
      if (trail) trails[id] = computeTrailProgress(trail, trailSignals);
    }
    const quests: RegionSignals['quests'] = {};
    for (const entry of questProgress) if (questIds.has(entry.quest.id)) quests[entry.quest.id] = { completed: entry.completed, total: entry.total };
    return { visitedRegionIds, discoveredIds, trails, quests };
  }, [visitedRegionIds, discoveredIds, trailSignals, questProgress]);
}
