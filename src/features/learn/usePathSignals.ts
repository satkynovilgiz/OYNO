import { useEffect, useMemo } from 'react';

import { readingKey } from '@/features/culture/reading/readingModel';
import { useGameRecords, useRecordsOwner } from '@/features/games/records/useGameRecords';
import { useChallengeStore } from '@/store/useChallengeStore';
import { ownerStudy, useGlossaryStudyStore } from '@/store/useGlossaryStudyStore';
import { ownerManualSteps, useLearningPathStore } from '@/store/useLearningPathStore';
import { useProgressStore } from '@/store/useProgressStore';
import { ownerReading, useReadingStore } from '@/store/useReadingStore';

import { challengeResultKey, type PathSignals } from './learningPaths';

/** Every signal Learning Paths derive from - read from the EXISTING stores
 * for the current owner (re-selected on account change). No new progress
 * engine: only manual fallback steps have their own (small) store. */
export function usePathSignals(): { signals: PathSignals; owner: string; ready: boolean } {
  const owner = useRecordsOwner();
  const reading = ownerReading(useReadingStore((state) => state.saved), owner);
  const study = ownerStudy(useGlossaryStudyStore((state) => state.saved), owner);
  const manual = ownerManualSteps(useLearningPathStore((state) => state.saved), owner);
  const challengeResults = useChallengeStore((state) => state.results);
  const { records } = useGameRecords();
  const progress = useProgressStore();
  // Each hook is always called (no short-circuit between hooks).
  const readingLoaded = useReadingStore((state) => state.isLoaded);
  const studyLoaded = useGlossaryStudyStore((state) => state.isLoaded);
  const manualLoaded = useLearningPathStore((state) => state.isLoaded);
  const loaded = readingLoaded && studyLoaded && manualLoaded;

  useEffect(() => {
    void useReadingStore.getState().load();
    void useGlossaryStudyStore.getState().load();
    void useLearningPathStore.getState().load();
    if (!useChallengeStore.getState().isLoaded) void useChallengeStore.getState().load();
  }, []);

  const signals = useMemo<PathSignals>(
    () => ({
      readingCompleted: (id) => !!reading[readingKey('culture_item', id)]?.completedAt,
      readingStarted: (id) => !!reading[readingKey('culture_item', id)],
      glossaryGotIt: (id) => (study[id]?.gotItCount ?? 0) > 0,
      glossarySeen: (id) => !!study[id],
      challengeCompleted: (id) => !!challengeResults[challengeResultKey(id)]?.completedAt,
      challengeStarted: (id) => !!challengeResults[challengeResultKey(id)],
      gamePlayed: (id) => (records.recent[id] ?? []).some((session) => !session.practice),
      labFlag: (flag) => progress.loadedOwner === owner && !!progress[flag],
      manualCompleted: (pathId, stepId) => !!manual[pathId]?.[stepId],
    }),
    [reading, study, manual, challengeResults, records, progress, owner],
  );
  return { signals, owner, ready: loaded };
}
