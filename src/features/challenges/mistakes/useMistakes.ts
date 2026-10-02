import { useEffect, useMemo } from 'react';

import { useRecordsOwner } from '@/features/games/records/useGameRecords';
import { ownerMistakes, useChallengeMistakesStore } from '@/store/useChallengeMistakesStore';

import { reviewQueue, type MistakeRecord } from './mistakesModel';
import { questionExists } from './questionExists';

export { questionExists };

/** The current person's review queue (stale questions cleaned silently;
 * re-selected the moment the account changes). */
export function useMistakeQueue(): { queue: MistakeRecord[]; owner: string; isLoaded: boolean } {
  const owner = useRecordsOwner();
  const saved = useChallengeMistakesStore((state) => state.saved);
  const isLoaded = useChallengeMistakesStore((state) => state.isLoaded);
  useEffect(() => {
    void useChallengeMistakesStore.getState().load().then(() => useChallengeMistakesStore.getState().prune(owner, questionExists));
  }, [owner]);
  const queue = useMemo(() => reviewQueue(ownerMistakes(saved, owner), questionExists), [saved, owner]);
  return { queue, owner, isLoaded };
}
