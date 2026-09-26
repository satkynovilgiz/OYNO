import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { OfflineUnavailable } from '@/components/offline/OfflineUnavailable';
import { NotFoundState } from '@/components/system/NotFoundState';
import { discoveryImages, natureSiteImages } from '@/features/explore/data';
import { LocationDetailScreen, type RelatedQuest } from '@/features/explore/LocationDetailScreen';
import type { ExploreLocation } from '@/features/explore/types';
import { track } from '@/services/analytics/analytics';
import { useDiscoveries } from '@/services/content/discoveriesService';
import { useCurrentQuest, useExploreRegions } from '@/services/content/exploreService';
import { useQuestSteps } from '@/services/content/questStepsService';
import { regionTagline } from '@/services/content/regionTaglines';
import { useQuestProgress } from '@/features/quests/useQuests';
import { mapDiscoveryTitle, mapExploreRegionName } from '@/services/content/types';
import { computeRegionCompletions } from '@/services/explore/regionAggregation';
import type { QuestStep } from '@/services/explore/questSteps';
import { favoriteKey, useFavoritesStore } from '@/store/useFavoritesStore';
import { isWaitingForNetwork } from '@/services/offline/offlineManifest';
import { useProgressStore } from '@/store/useProgressStore';
import { colors } from '@/theme';
import { toggleFavoriteWithFeedback } from '@/features/saved/toggleFavoriteWithFeedback';
import { computeTrailProgress } from '@/features/trails/trailProgress';
import { trails } from '@/features/trails/trailsData';
import { trailStatusLabel } from '@/features/trails/TrailsRow';
import { useTrailSignals } from '@/features/trails/useTrailSignals';

export { RouteErrorBoundary as ErrorBoundary } from '@/components/system/RouteErrorBoundary';

export default function ExploreLocationRoute() {
  const { t, i18n } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const regionsQuery = useExploreRegions();
  const discoveriesQuery = useDiscoveries();
  const { data: regions, isLoading: regionsLoading, error: regionsError } = regionsQuery;
  const { data: discoveries, isLoading: discoveriesLoading } = discoveriesQuery;
  const { data: questRow } = useCurrentQuest();
  const guidedProgress = useQuestProgress();
  const { data: questSteps } = useQuestSteps(questRow?.id);
  const progress = useProgressStore();
  const trailSignals = useTrailSignals();
  const favoriteIds = useFavoritesStore((state) => state.favoriteIds);

  const row = regions?.find((item) => item.id === id);
  const isLoading = regionsLoading || discoveriesLoading;

  useEffect(() => {
    if (!row) return;
    track('location_open', { locationId: row.id });
    void useProgressStore.getState().visitExploreRegion(row.id);
    void useProgressStore.getState().advanceQuestStep('VISIT_LOCATION', row.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [row?.id]);

  // Offline with nothing downloaded: say so, don't spin forever.
  if (isWaitingForNetwork(regionsQuery) || isWaitingForNetwork(discoveriesQuery)) {
    return (
      <OfflineUnavailable
        onRetry={() => {
          void regionsQuery.refetch();
          void discoveriesQuery.refetch();
        }}
      />
    );
  }

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (regionsError) {
    return (
      <View style={styles.center}>
        <Text style={styles.message}>{t('explore.locationDetail.loadError')}</Text>
      </View>
    );
  }

  if (!row) {
    return (
      <NotFoundState
        message={t('explore.locationDetail.notFound')}
        onPressBack={() => (router.canGoBack() ? router.back() : router.replace('/explore'))}
      />
    );
  }

  const regionDiscoveries = (discoveries ?? []).filter((d) => d.region_id === row.id);
  const questStepsList: QuestStep[] = (questSteps ?? []).map((s) => ({
    id: s.id,
    questId: s.quest_id,
    stepOrder: s.step_order,
    stepType: s.step_type,
    targetId: s.target_id,
  }));

  const completions = computeRegionCompletions({
    regionIds: [row.id],
    visitedRegionIds: progress.visitedRegionIds,
    discoveries: (discoveries ?? []).map((d) => ({ id: d.id, regionId: d.region_id })),
    discoveredIds: progress.discoveredExploreIds,
    questSteps: questStepsList,
    completedStepIds: progress.completedQuestStepIds,
  });
  const completion = completions[row.id] ?? { percent: 0, state: 'available' as const };

  const location: ExploreLocation = {
    id: row.id,
    kind: row.kind,
    name: mapExploreRegionName(row),
    tagline: regionTagline(row, i18n.language as 'kg' | 'ru' | 'en'),
    facts: row.facts,
    factsTranslation: row.factsTranslation,
    status: row.status,
    sources: row.sources ?? null,
    discoveredPercent: completion.percent,
  };

  const sameKind = (regions ?? []).filter((item) => item.kind === row.kind);
  const toneIndex = Math.max(
    0,
    sameKind.findIndex((item) => item.id === row.id),
  );

  const localizedDiscoveries = regionDiscoveries.map((d) => ({
    id: d.id,
    title: mapDiscoveryTitle(d)[i18n.language as 'kg' | 'ru' | 'en'] ?? d.title_kg,
    category: d.category,
    xpReward: d.xp_reward,
    imageSource: discoveryImages[d.id],
  }));

  // A real photo only when one of this region's own discoveries has
  // bundled art - never a generic/unrelated stand-in for "cinematic
  // photography" (spec "Do not fabricate missing information").
  // Nature destinations use their own mapped photo (the same one their
  // Explore card shows) when one exists.
  const heroImage = localizedDiscoveries.find((d) => d.imageSource)?.imageSource ?? natureSiteImages[row.id] ?? null;

  // Related guided quest: only one whose unfinished step is to visit THIS
  // destination - never shown speculatively.
  let relatedQuest: RelatedQuest = null;
  let relatedQuestId: string | null = null;
  for (const entry of guidedProgress) {
    if (entry.status === 'completed') continue;
    const visitHere = entry.steps.find(({ step, state }) => step.type === 'explore_destination' && step.targetId === row.id && state !== 'completed');
    if (visitHere) {
      relatedQuest = { title: entry.quest.title[i18n.language as 'kg' | 'ru' | 'en'] ?? entry.quest.title.kg, ctaLabel: t('quests.open') };
      relatedQuestId = entry.quest.id;
      break;
    }
  }

  // Only trails that really list this destination as a step.
  const relatedTrails = trails
    .filter((trail) => trail.steps.some((step) => step.type === 'destination' && step.id === row.id))
    .map((trail) => ({
      id: trail.id,
      title: trail.title[i18n.language as 'kg' | 'ru' | 'en'] ?? trail.title.kg,
      image: trail.heroImage,
      status: trailStatusLabel(computeTrailProgress(trail, trailSignals), t),
    }));

  return (
    <LocationDetailScreen
      location={location}
      toneIndex={toneIndex}
      state={completion.state}
      heroImage={heroImage}
      discoveries={localizedDiscoveries}
      discoveredIds={progress.discoveredExploreIds}
      isFavorite={favoriteIds.includes(favoriteKey(row.kind, row.id))}
      relatedQuest={relatedQuest}
      passport={row.kind === 'nature' ? { visited: progress.visitedRegionIds.includes(row.id), visitedAt: progress.regionVisitDates[row.id] ?? null } : null}
      relatedTrails={relatedTrails}
      onPressTrail={(trailId) => router.push(`/trails/${trailId}` as never)}
      onPressPassport={() => router.push('/journey' as never)}
      onPressBack={() => (router.canGoBack() ? router.back() : router.replace('/explore'))}
      onPressDiscovery={(discoveryId) => useProgressStore.getState().discoverExploreItem(discoveryId)}
      onToggleFavorite={() => toggleFavoriteWithFeedback(row.kind, row.id)}
      onPressRelatedQuest={() => relatedQuestId && router.push(`/quests/${relatedQuestId}` as never)}
    />
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  message: {
    color: colors.textSecondary,
  },
});
