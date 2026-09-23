import { useProgressStore } from '@/store/useProgressStore';

import type { CollectionProgressSignals } from './collectionProgress';

/** The real signals collection progress reads, straight from the existing
 * progress store - no new tracking. */
export function useCollectionSignals(): CollectionProgressSignals {
  const bozUyVisited = useProgressStore((state) => state.bozUyVisited);
  const oymoCreated = useProgressStore((state) => state.oymoCreated);
  const shyrdakCreated = useProgressStore((state) => state.shyrdakCreated);
  const komuzLessonCompleted = useProgressStore((state) => state.komuzLessonCompleted);
  const gameStats = useProgressStore((state) => state.gameStats);
  return { completionFlags: { bozUyVisited, oymoCreated, shyrdakCreated, komuzLessonCompleted }, gameStats };
}
