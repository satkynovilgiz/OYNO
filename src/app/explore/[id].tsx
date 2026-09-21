import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { discoveryImages } from '@/features/explore/data';
import { LocationDetailScreen, type RelatedQuest } from '@/features/explore/LocationDetailScreen';
import type { ExploreLocation } from '@/features/explore/types';
import { track } from '@/services/analytics/analytics';
import { useDiscoveries } from '@/services/content/discoveriesService';
import { useCurrentQuest, useExploreRegions } from '@/services/content/exploreService';
import { useQuestSteps } from '@/services/content/questStepsService';
import { mapDiscoveryTitle, mapExploreRegionName } from '@/services/content/types';
import { computeRegionCompletions } from '@/services/explore/regionAggregation';
import { findNextIncompleteStep, resolveStepRoute, type QuestStep } from '@/services/explore/questSteps';
import { favoriteKey, useFavoritesStore } from '@/store/useFavoritesStore';
import { useProgressStore } from '@/store/useProgressStore';
import { colors } from '@/theme';

export default function ExploreLocationRoute() {
  const { t, i18n } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: regions, isLoading: regionsLoading, error: regionsError } = useExploreRegions();
  const { data: discoveries, isLoading: discoveriesLoading } = useDiscoveries();
  const { data: questRow } = useCurrentQuest();
  const { data: questSteps } = useQuestSteps(questRow?.id);
  const progress = useProgressStore();
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
      <View style={styles.center}>
        <Text style={styles.message}>{t('explore.locationDetail.notFound')}</Text>
      </View>
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
    tagline: row.tagline,
    facts: row.facts,
    status: row.status,
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
  const heroImage = localizedDiscoveries.find((d) => d.imageSource)?.imageSource ?? null;

  // "Related quest" only when the active quest's next real, incomplete
  // step genuinely targets this location or a discovery inside it -
  // never shown speculatively.
  let relatedQuest: RelatedQuest = null;
  if (questRow && !progress.questCompleted) {
    const nextStep = findNextIncompleteStep(questStepsList, progress.completedQuestStepIds);
    if (nextStep) {
      const discoveryRegionId =
        nextStep.stepType === 'DISCOVER_ITEM' ? ((discoveries ?? []).find((d) => d.id === nextStep.targetId)?.region_id ?? null) : null;
      if (resolveStepRoute(nextStep, discoveryRegionId) === `/explore/${row.id}`) {
        relatedQuest = { title: questRow.title, ctaLabel: questRow.cta_label };
      }
    }
  }

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
      onPressBack={() => (router.canGoBack() ? router.back() : router.replace('/explore'))}
      onPressDiscovery={(discoveryId) => useProgressStore.getState().discoverExploreItem(discoveryId)}
      onToggleFavorite={() => useFavoritesStore.getState().toggleFavorite(row.kind, row.id)}
      onPressRelatedQuest={() => router.push('/explore' as never)}
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
