import { useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { ImageSourcePropType } from 'react-native';

import { computeCollectionProgress } from '@/features/collections/collectionProgress';
import { collections, getCollection } from '@/features/collections/collectionsData';
import { useCollectionSignals } from '@/features/collections/useCollectionProgress';
import { cultureCategoryImages, cultureItemImages } from '@/features/culture/data';
import type { CultureCategoryId } from '@/features/culture/types';
import { INTERACTIVE_EXPERIENCES, routeForInteractiveExperience } from '@/features/culture/interactiveExperiences';
import { useTodayDiscovery } from '@/features/daily/useTodayDiscovery';
import { natureSiteImages } from '@/features/explore/data';
import { gameArt } from '@/features/games/gamesCatalog';
import { mockGamesList } from '@/features/games/mockData';
import { progressGameIdFor } from '@/features/games/progressGameIds';
import { gameTitleKey } from '@/features/games/types';
import { isInteractiveExperienceCompleted } from '@/features/home/continueJourney';
import { buildPassport } from '@/features/journey/passport';
import { resolveTrailStep, routeForTrailStep } from '@/features/trails/trailDisplay';
import { computeTrailProgress, PLAY_TRACKED_GAME_IDS } from '@/features/trails/trailProgress';
import { getTrail, trails } from '@/features/trails/trailsData';
import { pickActiveQuest } from '@/features/quests/questProgress';
import { getGuidedQuest, questStepRoute } from '@/features/quests/questsData';
import { useQuestProgress } from '@/features/quests/useQuests';
import { useTrailSignals } from '@/features/trails/useTrailSignals';
import type { SupportedLanguage } from '@/i18n';
import { useAllCultureItems } from '@/services/content/cultureItemsService';
import { useCultureMaterials } from '@/services/content/cultureService';
import { useExploreRegions } from '@/services/content/exploreService';
import { mapExploreRegionName } from '@/services/content/types';
import { useNetworkStatus } from '@/services/offline/networkStatus';
import { isRouteAvailableOffline } from '@/services/offline/offlineAvailability';
import { useDailyDiscoveryStore } from '@/store/useDailyDiscoveryStore';
import { useProgressStore } from '@/store/useProgressStore';
import journeyBackdrop from '@assets/img/OYNO_design/explore/quest_boru_shyrdak.png';

import { buildHomeJourneyRecommendation, buildRecentlyExplored, type HomeRecommendation } from './homeRecommendation';

export type HomeRecommendationDisplay = {
  eyebrow: string;
  title: string;
  subtitle: string | null;
  imageSource: ImageSourcePropType;
  /** High-resolution same-category art for when `imageSource` is too small
   * to fill the card (see HomeArtwork) - never an invented image. */
  backdropSource?: ImageSourcePropType | null;
  ctaLabel: string;
};

export type RecentDisplay = { key: string; title: string; imageSource: ImageSourcePropType | null; route: string };

/**
 * Gathers the real inputs (trail/collection/passport progress from their
 * own single functions, the quest, today's Daily, played games) for the
 * pure `buildHomeJourneyRecommendation`, then turns its answer into card
 * text from the existing content. Home never recalculates any progress.
 */
export function useHomeRecommendation(): { recommendation: HomeRecommendation; display: HomeRecommendationDisplay; recent: RecentDisplay[] } {
  const { t, i18n } = useTranslation();
  const language = i18n.language as SupportedLanguage;
  const queryClient = useQueryClient();
  const { isOffline } = useNetworkStatus();

  const trailSignals = useTrailSignals();
  const collectionSignals = useCollectionSignals();
  const progress = useProgressStore();
  const dailyCompletions = useDailyDiscoveryStore((state) => state.completions);
  const { discovery: today } = useTodayDiscovery();
  const { data: regions } = useExploreRegions();
  const { data: cultureItems } = useAllCultureItems();
  const { data: cultureMaterials } = useCultureMaterials();
  // Guided Quests (the legacy single quest is retired from Home): the one
  // active quest continues at its real current step; otherwise the first
  // not-started quest is suggested via its detail screen.
  const questProgress = useQuestProgress();
  const activeQuest = pickActiveQuest(questProgress);
  const suggestedQuest = activeQuest ?? questProgress.find((entry) => entry.status === 'notStarted') ?? null;

  const recommendation = useMemo(() => {
    return buildHomeJourneyRecommendation({
      trails: trails.map((trail) => {
        const trailProgress = computeTrailProgress(trail, trailSignals);
        return { trail, progress: trailProgress, nextRoute: trailProgress.nextStep ? routeForTrailStep(trailProgress.nextStep) : null };
      }),
      quest: suggestedQuest
        ? {
            id: suggestedQuest.quest.id,
            current: suggestedQuest.completed,
            total: suggestedQuest.total,
            completed: suggestedQuest.status === 'completed',
            nextRoute: suggestedQuest.status === 'active' && suggestedQuest.currentStep ? questStepRoute(suggestedQuest.currentStep) : `/quests/${suggestedQuest.quest.id}`,
          }
        : null,
      daily: today ? { itemId: today.item.id, isCompleted: today.isCompleted } : null,
      collections: collections.map((collection) => ({ collection, progress: computeCollectionProgress(collection, collectionSignals) })),
      passport: buildPassport(regions ?? [], progress.visitedRegionIds, progress.regionVisitDates, (id) => natureSiteImages[id], language),
      playedGames: mockGamesList
        .filter((game) => PLAY_TRACKED_GAME_IDS.has(game.id) && !!game.route)
        .map((game) => ({ gameId: game.id, route: game.route!, played: progress.gameStats[progressGameIdFor(game.id)]?.played ?? 0 })),
      untriedInteractive: INTERACTIVE_EXPERIENCES.filter((experience) => !isInteractiveExperienceCompleted(experience.id, trailSignals.completionFlags)).flatMap(
        (experience) => {
          const route = routeForInteractiveExperience(experience.id);
          return route ? [{ id: experience.id, route }] : [];
        },
      ),
      isAvailable: (route) => !isOffline || isRouteAvailableOffline(route, queryClient),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trailSignals, collectionSignals, progress, today, regions, suggestedQuest, language, isOffline]);

  const display = useMemo<HomeRecommendationDisplay>(() => {
    const sources = { regions: regions ?? [], cultureItems: cultureItems ?? [], cultureMaterials: cultureMaterials ?? [] };
    const eyebrow =
      recommendation.mode === 'today'
        ? t('home.journey.today')
        : recommendation.mode === 'exploreNext'
          ? t('home.journey.exploreNext')
          : recommendation.mode === 'complete'
            ? t('home.journey.complete')
            : t('home.journey.continueYourJourney');
    const progressText = recommendation.progress ? t('home.journey.progress', recommendation.progress) : null;
    const regionName = (id: string | null) => {
      const row = regions?.find((region) => region.id === id);
      const name = row ? mapExploreRegionName(row) : null;
      return name ? (name[language] ?? name.kg) : '';
    };

    switch (recommendation.kind) {
      case 'trail': {
        const trail = getTrail(recommendation.contentId ?? '')!;
        const nextStep = recommendation.mode === 'continue' ? computeTrailProgress(trail, trailSignals).nextStep : null;
        const nextTitle = nextStep ? resolveTrailStep(nextStep, sources, t, language).title : '';
        return {
          eyebrow,
          title: trail.title[language] ?? trail.title.kg,
          subtitle: progressText,
          imageSource: trail.heroImage,
          ctaLabel: nextTitle ? `${t('home.journey.continue')} → ${nextTitle}` : t('home.journey.start'),
        };
      }
      case 'quest': {
        const guided = getGuidedQuest(recommendation.contentId ?? '');
        return {
          eyebrow,
          title: guided ? (guided.title[language] ?? guided.title.kg) : '',
          subtitle: progressText,
          imageSource: guided?.heroImage ?? journeyBackdrop,
          ctaLabel: recommendation.mode === 'continue' ? t('home.journey.continue') : t('home.journey.start'),
        };
      }
      case 'daily':
        return {
          eyebrow,
          title: today?.item.title ?? '',
          subtitle: t('daily.entry.title'),
          imageSource: today?.imageSource ?? cultureItemImages[recommendation.contentId ?? '']?.[0] ?? journeyBackdrop,
          backdropSource: today ? (cultureCategoryImages[today.item.category_id as CultureCategoryId] ?? null) : null,
          ctaLabel: t('daily.entry.open'),
        };
      case 'collection': {
        const collection = getCollection(recommendation.contentId ?? '')!;
        return {
          eyebrow,
          title: collection.title[language] ?? collection.title.kg,
          subtitle: progressText,
          imageSource: collection.heroImage,
          ctaLabel: recommendation.mode === 'continue' ? t('home.journey.continue') : t('home.journey.start'),
        };
      }
      case 'passport':
        return {
          eyebrow,
          title: recommendation.mode === 'continue' ? t('home.journey.passportTitle') : regionName(recommendation.targetId),
          subtitle: recommendation.progress ? t('explore.map.summary', { unlocked: recommendation.progress.completed, total: recommendation.progress.total }) : null,
          imageSource: natureSiteImages[recommendation.targetId ?? ''] ?? journeyBackdrop,
          ctaLabel: `${t('home.journey.explore')} ${regionName(recommendation.targetId)}`,
        };
      case 'game': {
        const game = mockGamesList.find((entry) => entry.id === recommendation.contentId);
        const played = progress.gameStats[progressGameIdFor(recommendation.contentId ?? '')]?.played ?? 0;
        return {
          eyebrow,
          title: game ? t(gameTitleKey(game.id)) : '',
          subtitle: t('home.journey.playedTimes', { count: played }),
          imageSource: (game ? gameArt(game, 'large') : null) ?? journeyBackdrop,
          ctaLabel: t('home.journey.playAgain'),
        };
      }
      case 'interactive': {
        const experience = INTERACTIVE_EXPERIENCES.find((entry) => entry.id === recommendation.contentId);
        return {
          eyebrow,
          title: experience ? t(experience.titleKey) : '',
          subtitle: null,
          imageSource: experience?.imageSource ?? journeyBackdrop,
          ctaLabel: t('home.journey.start'),
        };
      }
      default:
        return {
          eyebrow,
          title: recommendation.mode === 'complete' ? t('home.journey.completeTitle') : t('home.journey.exploreTitle'),
          subtitle: null,
          imageSource: journeyBackdrop,
          ctaLabel: recommendation.mode === 'complete' ? t('journey.entryCta') : t('home.journey.explore'),
        };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recommendation, regions, cultureItems, cultureMaterials, today, language, trailSignals, progress.gameStats]);

  const recent = useMemo<RecentDisplay[]>(
    () =>
      buildRecentlyExplored(progress.regionVisitDates, dailyCompletions).flatMap((entry) => {
        if (entry.kind === 'place') {
          const row = regions?.find((region) => region.id === entry.id);
          if (!row) return [];
          const name = mapExploreRegionName(row);
          return [{ key: `place:${entry.id}`, title: name[language] ?? name.kg, imageSource: natureSiteImages[entry.id] ?? null, route: `/explore/${entry.id}` }];
        }
        const item = cultureItems?.find((row) => row.id === entry.id);
        if (!item) return [];
        return [{ key: `daily:${entry.id}`, title: item.title, imageSource: cultureItemImages[entry.id]?.[0] ?? null, route: `/culture/item/${entry.id}` }];
      }),
    [progress.regionVisitDates, dailyCompletions, regions, cultureItems, language],
  );

  return { recommendation, display, recent };
}
