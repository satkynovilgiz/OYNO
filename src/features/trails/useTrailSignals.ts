import { useCollectionSignals } from '@/features/collections/useCollectionProgress';
import { useProgressStore } from '@/store/useProgressStore';

import type { TrailSignals } from './trailProgress';

/** Real signals trails read - the collection signals plus region visits, all
 * from the existing progress store. */
export function useTrailSignals(): TrailSignals {
  const collectionSignals = useCollectionSignals();
  const visitedRegionIds = useProgressStore((state) => state.visitedRegionIds);
  return { ...collectionSignals, visitedRegionIds };
}
