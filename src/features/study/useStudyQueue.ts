import { useMemo } from 'react';

import { useMistakeQueue } from '@/features/challenges/mistakes/useMistakes';
import { reviewQueue as glossaryReviewQueue } from '@/features/culture/glossary/study/glossaryStudy';
import { useGlossary } from '@/features/culture/glossary/useGlossary';
import { readingKey, recentlyRead, shouldOfferResume } from '@/features/culture/reading/readingModel';
import { LEARNING_PATHS, pathProgress, stepRoute } from '@/features/learn/learningPaths';
import { usePathSignals } from '@/features/learn/usePathSignals';
import { gameRouteFor } from '@/features/learn/useStepDisplay';
import { useAllCultureItems } from '@/services/content/cultureItemsService';
import { useCultureMaterials } from '@/services/content/cultureService';
import { ownerStudy, useGlossaryStudyStore } from '@/store/useGlossaryStudyStore';
import { ownerReading, useReadingStore } from '@/store/useReadingStore';

import type { StudyQueueInput } from './studyQueue';

/**
 * The Study Queue's input, straight from the CURRENT owner's existing
 * selectors (mistake queue, glossary review queue, path progress, reading
 * progress). Switching account changes the owner, so everything is
 * recomputed at once - there is no Study Queue storage to clear.
 */
export function useStudyQueueInput(): { input: StudyQueueInput; titles: { reading: Record<string, string>; readingPercent: Record<string, number> }; ready: boolean } {
  const { queue: mistakes, isLoaded: mistakesLoaded } = useMistakeQueue();
  const { signals, owner, ready: pathsReady } = usePathSignals();
  const study = ownerStudy(useGlossaryStudyStore((state) => state.saved), owner);
  const reading = ownerReading(useReadingStore((state) => state.saved), owner);
  const { entries } = useGlossary();
  const { data: items } = useAllCultureItems();
  const { data: materials } = useCultureMaterials();

  return useMemo(() => {
    const titleOf = (contentType: string, contentId: string) =>
      contentType === 'culture_item' ? items?.find((item) => item.id === contentId)?.title : materials?.find((material) => material.id === contentId)?.title;
    const unfinished = recentlyRead(reading, (record) => !!titleOf(record.contentType, record.contentId), Number.MAX_SAFE_INTEGER).filter((record) => !record.completedAt && shouldOfferResume(record));
    const titles: Record<string, string> = {};
    const percent: Record<string, number> = {};
    for (const record of unfinished) {
      const key = readingKey(record.contentType, record.contentId);
      titles[key] = titleOf(record.contentType, record.contentId) ?? '';
      percent[key] = Math.round(Math.min(1, record.furthest) * 100);
    }
    const activePaths = LEARNING_PATHS.map((path) => ({ path, progress: pathProgress(path, signals) }))
      .filter(({ progress }) => progress.started && !progress.done)
      .map(({ path, progress }) => ({ id: path.id, nextIndex: progress.nextIndex, nextStepRoute: progress.nextIndex === null ? null : stepRoute(path.steps[progress.nextIndex], gameRouteFor) }));
    return {
      input: {
        mistakeIds: mistakes.map((record) => record.questionId),
        glossaryIds: glossaryReviewQueue(study, entries.map(({ entry }) => entry.id)),
        activePaths,
        unfinishedReading: unfinished.map((record) => ({
          key: readingKey(record.contentType, record.contentId),
          route: record.contentType === 'culture_item' ? `/culture/item/${record.contentId}` : `/culture/material/${record.contentId}`,
        })),
      },
      titles: { reading: titles, readingPercent: percent },
      ready: mistakesLoaded && pathsReady,
    };
  }, [mistakes, mistakesLoaded, signals, pathsReady, study, reading, entries, items, materials]);
}
