import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { useMistakeQueue } from '@/features/challenges/mistakes/useMistakes';
import { cultureItemImages, cultureMaterialImages } from '@/features/culture/data';
import { reviewQueue as glossaryQueue } from '@/features/culture/glossary/study/glossaryStudy';
import { useGlossary } from '@/features/culture/glossary/useGlossary';
import { continueReading, percentRead } from '@/features/culture/reading/readingModel';
import { useGameRecords } from '@/features/games/records/useGameRecords';
import { LEARNING_PATHS, learnRoute, pathProgress, pickHomePath } from '@/features/learn/learningPaths';
import { usePathSignals } from '@/features/learn/usePathSignals';
import { useAllCultureItems } from '@/services/content/cultureItemsService';
import { useCultureMaterials } from '@/services/content/cultureService';
import { localDateKey } from '@/services/daily/dailyDiscovery';
import { useChallengeStore } from '@/store/useChallengeStore';
import { ownerStudy, useGlossaryStudyStore } from '@/store/useGlossaryStudyStore';
import { ownerReading, useReadingStore } from '@/store/useReadingStore';
import { ownerGoal, useWeeklyGoalStore } from '@/store/useWeeklyGoalStore';

import { isDismissedToday, pickForYou, type HomeRecommendationCard } from './forYouToday';

/** Gathers the EXISTING selectors' results for the current owner and asks
 * the pure picker for one card (or null when dismissed for today). */
export function useForYouToday(heroRoute: string | null): { card: HomeRecommendationCard | null; owner: string } {
  const { t } = useTranslation();
  const { signals, owner } = usePathSignals();
  const reading = ownerReading(useReadingStore((state) => state.saved), owner);
  const study = ownerStudy(useGlossaryStudyStore((state) => state.saved), owner);
  const settings = ownerGoal(useWeeklyGoalStore((state) => state.saved), owner);
  const challengeResults = useChallengeStore((state) => state.results);
  const { queue: mistakes } = useMistakeQueue();
  const { entries } = useGlossary();
  const { records } = useGameRecords();
  const { data: items } = useAllCultureItems();
  const { data: materials } = useCultureMaterials();
  useEffect(() => {
    void useWeeklyGoalStore.getState().load();
  }, []);

  const today = localDateKey();
  if (isDismissedToday(settings.dismissedForYouOn, today)) return { card: null, owner };

  const exists = (record: { contentType: string; contentId: string }) =>
    record.contentType === 'culture_item' ? !!items?.some((item) => item.id === record.contentId) : !!materials?.some((material) => material.id === record.contentId);
  const unfinished = continueReading(reading, exists);
  const unfinishedTitle = unfinished
    ? unfinished.contentType === 'culture_item'
      ? items?.find((item) => item.id === unfinished.contentId)?.title
      : materials?.find((material) => material.id === unfinished.contentId)?.title
    : null;
  const progressById = LEARNING_PATHS.map((path) => ({ path, progress: pathProgress(path, signals) }));
  const active = progressById.find((entry) => entry.progress.started && !entry.progress.done);
  const unstarted = progressById.find((entry) => !entry.progress.started);
  // The Learning Paths card on Home shows this path - don't repeat it.
  const homePath = pickHomePath(LEARNING_PATHS, signals);
  const heroOf = (itemId: string | null) => (itemId ? (cultureItemImages[itemId]?.[0] ?? null) : null);

  const isNewUser =
    Object.keys(reading).length === 0 && Object.keys(study).length === 0 && Object.keys(challengeResults).length === 0 && Object.keys(records.sessions).length === 0 && !progressById.some((entry) => entry.progress.started);

  const card = pickForYou({
    isNewUser,
    unfinishedReading:
      unfinished && unfinishedTitle
        ? {
            title: unfinishedTitle,
            percent: percentRead(unfinished),
            route: unfinished.contentType === 'culture_item' ? `/culture/item/${unfinished.contentId}` : `/culture/material/${unfinished.contentId}`,
            image: unfinished.contentType === 'culture_item' ? (cultureItemImages[unfinished.contentId]?.[0] ?? null) : (cultureMaterialImages[unfinished.contentId] ?? null),
          }
        : null,
    activePath: active ? { title: t(active.path.titleKey), completed: active.progress.completed, total: active.progress.total, route: learnRoute(active.path.id), image: heroOf(active.path.heroItemId) } : null,
    mistakesWaiting: mistakes.length,
    glossaryWaiting: glossaryQueue(study, entries.map(({ entry }) => entry.id)).length,
    dailyChallengeDone: !!challengeResults[`daily:${today}`]?.completedAt,
    firstUnstartedPath: unstarted ? { title: t(unstarted.path.titleKey), route: learnRoute(unstarted.path.id), image: heroOf(unstarted.path.heroItemId) } : null,
    beginnerPath: { title: t(LEARNING_PATHS[0].titleKey), route: learnRoute(LEARNING_PATHS[0].id), image: heroOf(LEARNING_PATHS[0].heroItemId) },
    excludedRoutes: [heroRoute, homePath ? learnRoute(homePath.path.id) : null].filter((route): route is string => !!route),
  });
  return { card, owner };
}
