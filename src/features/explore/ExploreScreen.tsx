import { router } from 'expo-router';
import { ChevronRight, Map as MapIcon, SlidersHorizontal, TriangleAlert } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AgeExperienceTransition, AnimatedPressable, EmptyState, FadeSlideIn, HeroEntrance, ScreenEntrance, Skeleton } from '@/components/ui';
import type { CharacterId } from '@/components/character';
import { BottomTabBar } from '@/components/navigation/BottomTabBar';
import type { SupportedLanguage } from '@/i18n';
import { useAgeExperience } from '@/services/ageExperience/useAgeExperience';
import { track } from '@/services/analytics/analytics';
import { useTrackScreenView } from '@/services/analytics/useTrackScreenView';
import { useDiscoveries } from '@/services/content/discoveriesService';
import { useCurrentQuest, useExploreRegions } from '@/services/content/exploreService';
import { useQuestSteps } from '@/services/content/questStepsService';
import { mapDiscoveryTitle, mapExploreRegionName } from '@/services/content/types';
import { filterRegions, type ExploreFilterId } from '@/services/explore/filters';
import { computeRegionCompletions } from '@/services/explore/regionAggregation';
import { findNextIncompleteStep, resolveStepRoute, type QuestStep } from '@/services/explore/questSteps';
import { useProgressStore } from '@/store/useProgressStore';
import { TrailsRow } from '@/features/trails/TrailsRow';
import { colors, radii, spacing, typography } from '@/theme';

import {
  CurrentQuestCard,
  DiscoveriesRow,
  ExploreFilterSheet,
  ExploreHeader,
  KyrgyzstanMap,
  NatureSitesRow,
  RegionProgressCard,
} from './components';
import { discoveryImages, exploreMapPins, natureSiteImages } from './data';
import { getExploreSectionOrder, type ExploreSectionId } from './exploreSections';
import type { ExploreDiscovery } from './types';

export function ExploreScreen() {
  useTrackScreenView('explore');
  useEffect(() => {
    track('explore_opened');
  }, []);
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const { experience } = useAgeExperience();
  const progress = useProgressStore();
  const [filtersVisible, setFiltersVisible] = useState(false);
  const [activeFilters, setActiveFilters] = useState<ExploreFilterId[]>([]);

  const { data: regions, isLoading: regionsLoading, error: regionsError, refetch: refetchRegions } = useExploreRegions();
  const { data: questRow, isLoading: questLoading, error: questError, refetch: refetchQuest } = useCurrentQuest();
  const { data: discoveries, isLoading: discoveriesLoading, refetch: refetchDiscoveries } = useDiscoveries();
  const { data: questStepRows } = useQuestSteps(questRow?.id);

  const isLoading = regionsLoading || questLoading || discoveriesLoading;
  const hasError = !!regionsError || !!questError;

  const language = i18n.language as SupportedLanguage;
  const questSteps: QuestStep[] = (questStepRows ?? []).map((s) => ({
    id: s.id,
    questId: s.quest_id,
    stepOrder: s.step_order,
    stepType: s.step_type,
    targetId: s.target_id,
  }));
  const discoveryList = discoveries ?? [];

  const completions = computeRegionCompletions({
    regionIds: (regions ?? []).map((r) => r.id),
    visitedRegionIds: progress.visitedRegionIds,
    discoveries: discoveryList.map((d) => ({ id: d.id, regionId: d.region_id })),
    discoveredIds: progress.discoveredExploreIds,
    questSteps,
    completedStepIds: progress.completedQuestStepIds,
  });

  const filteredRegionIds = new Set(
    filterRegions((regions ?? []).map((r) => ({ id: r.id, kind: r.kind })), activeFilters, progress.visitedRegionIds).map(
      (r) => r.id,
    ),
  );

  const mapPins = (regions ?? [])
    .filter((region) => region.kind === 'region' && filteredRegionIds.has(region.id))
    .map((region) => {
      const pin = exploreMapPins.find((p) => p.locationId === region.id);
      return pin
        ? {
            id: region.id,
            label: mapExploreRegionName(region)[language] ?? region.name_kg,
            xPercent: pin.xPercent,
            yPercent: pin.yPercent,
            state: completions[region.id]?.state,
          }
        : null;
    })
    .filter((pin): pin is NonNullable<typeof pin> => pin !== null);

  // The map's pins are baked into map_terrain.jpg itself (see
  // KyrgyzstanMap's own comment) - filtering mapPins only removes invisible
  // tap targets/state badges, it can never visually hide a baked pin. This
  // list is the actual visible effect of a filter, shown only while a
  // filter is active so it doesn't duplicate the unfiltered home screen.
  const filteredRegionsList =
    activeFilters.length > 0
      ? (regions ?? [])
          .filter((region) => filteredRegionIds.has(region.id))
          .map((region) => ({
            id: region.id,
            name: mapExploreRegionName(region)[language] ?? region.name_kg,
            tagline: region.tagline,
          }))
      : null;

  // Tone index = position among ALL nature rows, exactly how the detail
  // route picks its fallback tone, so a photo-less card and its detail
  // hero share one color even while a filter hides some sites.
  const allNatureIds = (regions ?? []).filter((region) => region.kind === 'nature').map((region) => region.id);
  const natureSites = (regions ?? [])
    .filter((region) => region.kind === 'nature' && filteredRegionIds.has(region.id))
    .map((region) => ({
      id: region.id,
      name: mapExploreRegionName(region)[language] ?? region.name_kg,
      tagline: region.tagline,
      imageSource: natureSiteImages[region.id] ?? null,
      toneIndex: Math.max(0, allNatureIds.indexOf(region.id)),
      visited: progress.visitedRegionIds.includes(region.id),
    }));

  const homeDiscoveries: ExploreDiscovery[] = discoveryList.map((d) => ({
    id: d.id,
    title: mapDiscoveryTitle(d)[language] ?? d.title_kg,
    category: d.category,
    xpReward: d.xp_reward,
    imageSource: discoveryImages[d.id],
  }));

  const regionsTotal = (regions ?? []).filter((r) => r.kind === 'region').length;
  const regionsVisited = (regions ?? []).filter((r) => r.kind === 'region' && progress.visitedRegionIds.includes(r.id)).length;
  const natureTotal = (regions ?? []).filter((r) => r.kind === 'nature').length;
  const natureVisited = (regions ?? []).filter((r) => r.kind === 'nature' && progress.visitedRegionIds.includes(r.id)).length;
  const discoveriesTotal = discoveryList.length;
  const discoveriesFound = discoveryList.filter((d) => progress.discoveredExploreIds.includes(d.id)).length;
  const questTotal = questRow?.total_count ?? 0;
  const questCurrent = Math.min(progress.questFoundCount, questTotal);

  const sumCurrent = regionsVisited + natureVisited + discoveriesFound + questCurrent;
  const sumTotal = regionsTotal + natureTotal + discoveriesTotal + questTotal;
  const overallPercent = sumTotal > 0 ? Math.round((sumCurrent / sumTotal) * 100) : 0;

  const quest = questRow
    ? {
        id: questRow.id,
        characterId: questRow.character_id as CharacterId,
        title: questRow.title,
        subtitle: questRow.subtitle,
        foundCount: progress.questFoundCount,
        totalCount: questRow.total_count,
        ctaLabel: progress.questCompleted ? t('explore.quest.completedCta') : questRow.cta_label,
      }
    : null;

  function handlePressQuest() {
    if (progress.questCompleted) return;
    const nextStep = findNextIncompleteStep(questSteps, progress.completedQuestStepIds);
    if (!nextStep) return;
    const discoveryRegionId =
      nextStep.stepType === 'DISCOVER_ITEM' ? (discoveryList.find((d) => d.id === nextStep.targetId)?.region_id ?? null) : null;
    router.push(resolveStepRoute(nextStep, discoveryRegionId) as never);
  }

  function handlePressDiscovery(discovery: ExploreDiscovery) {
    useProgressStore.getState().discoverExploreItem(discovery.id);
  }

  // Same four sections, same underlying regions/quest/discoveries data, for
  // every AgeExperience - only their order changes (spec "Make Culture and
  // Explore adapt to AgeExperience... Keep same underlying data"). The map
  // (and its own filtered-results list) stays pinned above these, see
  // exploreSections.ts.
  function renderSection(id: ExploreSectionId) {
    switch (id) {
      case 'progress':
        return (
          <View key={id} style={styles.horizontalPad}>
            <RegionProgressCard
              progress={{
                overallPercent,
                stats: {
                  regions: { current: regionsVisited, total: regionsTotal },
                  nature: { current: natureVisited, total: natureTotal },
                  discoveries: { current: discoveriesFound, total: discoveriesTotal },
                  quests: { current: questCurrent, total: questTotal },
                },
              }}
            />
          </View>
        );
      case 'quest':
        return quest ? (
          <View key={id} style={styles.horizontalPad}>
            <CurrentQuestCard quest={quest} onPress={handlePressQuest} />
          </View>
        ) : null;
      case 'trails':
        return <TrailsRow key={id} />;
      case 'natureSites':
        return <NatureSitesRow key={id} sites={natureSites} onPressSite={(siteId) => router.push(`/explore/${siteId}` as never)} />;
      case 'discoveries':
        return (
          <DiscoveriesRow
            key={id}
            discoveries={homeDiscoveries}
            discoveredIds={progress.discoveredExploreIds}
            onPressDiscovery={handlePressDiscovery}
            onPressSeeAll={() => router.push('/collection' as never)}
          />
        );
    }
  }

  return (
    <View style={styles.root}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.sm }]}
      >
        <ScreenEntrance>
          <ExploreHeader
            onPressAvatar={() => router.push('/character-select' as never)}
            onPressSearch={() => router.push('/explore/search' as never)}
            onPressCollection={() => router.push('/collection' as never)}
          />
        </ScreenEntrance>

        {isLoading ? (
          <View style={styles.horizontalPad}>
            <Skeleton height={220} borderRadius={28} style={styles.skeletonSpacing} />
            <View style={styles.skeletonRow}>
              <Skeleton width={150} height={130} borderRadius={20} />
              <Skeleton width={150} height={130} borderRadius={20} />
            </View>
          </View>
        ) : hasError ? (
          <EmptyState
            icon={TriangleAlert}
            tone="error"
            title={t('explore.loadError')}
            actionLabel={t('common.retry')}
            onPressAction={() => {
              refetchRegions();
              refetchQuest();
              refetchDiscoveries();
            }}
          />
        ) : (
          <>
            <View style={styles.horizontalPad}>
              <HeroEntrance>
                <KyrgyzstanMap
                  pins={mapPins}
                  onPressPin={(locationId) => router.push(`/explore/${locationId}` as never)}
                  onPressFilter={() => setFiltersVisible(true)}
                />
              </HeroEntrance>
              <AnimatedPressable
                style={styles.mapEntry}
                onPress={() => router.push('/explore/map' as never)}
                pressScale={0.98}
                hoverEffect
                accessibilityRole="button"
                accessibilityLabel={t('explore.map.entry')}
              >
                <MapIcon size={16} color={colors.primary} strokeWidth={2.25} />
                <Text style={styles.mapEntryText}>{t('explore.map.entry')}</Text>
                <ChevronRight size={16} color={colors.primary} strokeWidth={2.25} />
              </AnimatedPressable>
            </View>

            {filteredRegionsList && (
              <View style={styles.horizontalPad}>
                <Text style={styles.filteredTitle}>{t('explore.filters.resultsTitle')}</Text>
                {filteredRegionsList.length === 0 ? (
                  <EmptyState
                    compact
                    icon={SlidersHorizontal}
                    title={t('explore.filters.noResults')}
                    description={t('explore.filters.noResultsDescription')}
                    actionLabel={t('explore.filters.clear')}
                    onPressAction={() => setActiveFilters([])}
                  />
                ) : (
                  <View style={styles.filteredList}>
                    {filteredRegionsList.map((region, index) => (
                      <FadeSlideIn key={region.id} index={index}>
                        <AnimatedPressable
                          style={styles.filteredRow}
                          onPress={() => router.push(`/explore/${region.id}` as never)}
                          hoverEffect
                          accessibilityRole="button"
                          accessibilityLabel={region.name}
                        >
                          <View style={styles.filteredRowText}>
                            <Text style={styles.filteredRowName}>{region.name}</Text>
                            <Text style={styles.filteredRowTagline} numberOfLines={1}>
                              {region.tagline}
                            </Text>
                          </View>
                          <ChevronRight size={16} color={colors.textSecondary} strokeWidth={2.25} />
                        </AnimatedPressable>
                      </FadeSlideIn>
                    ))}
                  </View>
                )}
              </View>
            )}

            <AgeExperienceTransition style={styles.sectionList}>
              {getExploreSectionOrder(experience).map((id, index) => (
                <FadeSlideIn key={id} index={index} staggerMs={40}>
                  {renderSection(id)}
                </FadeSlideIn>
              ))}
            </AgeExperienceTransition>
          </>
        )}
      </ScrollView>

      <ExploreFilterSheet
        visible={filtersVisible}
        activeFilters={activeFilters}
        onApply={(filters) => {
          setActiveFilters(filters);
          setFiltersVisible(false);
          track('explore_filter_used', { filters: filters.join(',') });
        }}
        onClose={() => setFiltersVisible(false)}
      />

      <View style={{ paddingBottom: insets.bottom }}>
        <BottomTabBar
          activeTab="explore"
          onPressTab={(tab) => {
            if (tab === 'home') router.push('/home');
            if (tab === 'games') router.push('/games' as never);
            if (tab === 'culture') router.push('/culture' as never);
            if (tab === 'profile') router.push('/profile' as never);
          }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    gap: spacing.lg,
    paddingBottom: spacing.xl,
  },
  sectionList: {
    gap: spacing.lg,
  },
  mapEntry: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: 'rgba(47,82,51,0.35)',
    backgroundColor: colors.surface,
  },
  mapEntryText: {
    ...typography.bodyBold,
    color: colors.primary,
  },
  horizontalPad: {
    paddingHorizontal: spacing.md,
  },
  skeletonSpacing: {
    marginBottom: spacing.sm,
  },
  skeletonRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  filteredTitle: {
    ...typography.h2,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  filteredList: {
    gap: spacing.xs,
  },
  filteredRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  filteredRowText: {
    flex: 1,
    marginRight: spacing.sm,
  },
  filteredRowName: {
    ...typography.body,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  filteredRowTagline: {
    ...typography.small,
    color: colors.textSecondary,
  },
});
