import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { discoveryImages } from '@/features/explore/data';
import { LocationDetailScreen } from '@/features/explore/LocationDetailScreen';
import type { ExploreLocation } from '@/features/explore/types';
import { track } from '@/services/analytics/analytics';
import { useDiscoveries } from '@/services/content/discoveriesService';
import { useCurrentQuest, useExploreRegions } from '@/services/content/exploreService';
import { useQuestSteps } from '@/services/content/questStepsService';
import { mapDiscoveryTitle, mapExploreRegionName } from '@/services/content/types';
import { computeRegionCompletions } from '@/services/explore/regionAggregation';
import type { QuestStep } from '@/services/explore/questSteps';
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

  return (
    <LocationDetailScreen
      location={location}
      toneIndex={toneIndex}
      state={completion.state}
      discoveries={localizedDiscoveries}
      discoveredIds={progress.discoveredExploreIds}
      isFavorite={progress.favoriteIds.includes(`${row.kind}:${row.id}`)}
      onPressBack={() => router.back()}
      onPressDiscovery={(discoveryId) => useProgressStore.getState().discoverExploreItem(discoveryId)}
      onToggleFavorite={() => useProgressStore.getState().toggleFavorite(row.kind, row.id)}
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
