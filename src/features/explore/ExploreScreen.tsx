import { router } from 'expo-router';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { CharacterId } from '@/components/character';
import { BottomTabBar } from '@/components/navigation/BottomTabBar';
import { useTrackScreenView } from '@/services/analytics/useTrackScreenView';
import { useCurrentQuest, useExploreRegions } from '@/services/content/exploreService';
import { useProgressStore } from '@/store/useProgressStore';
import { colors, spacing } from '@/theme';

import {
  CurrentQuestCard,
  DiscoveriesRow,
  ExploreHeader,
  KyrgyzstanMap,
  RegionProgressCard,
} from './components';
import { exploreDiscoveries, exploreMapPins, exploreProgress } from './data';
import type { ExploreDiscovery } from './types';

export function ExploreScreen() {
  useTrackScreenView('explore');
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const progress = useProgressStore();
  const { data: regions, isLoading: regionsLoading, error: regionsError } = useExploreRegions();
  const { data: questRow, isLoading: questLoading, error: questError } = useCurrentQuest();

  function handlePressQuest() {
    useProgressStore.getState().advanceQuest();
  }

  function handlePressDiscovery(discovery: ExploreDiscovery) {
    useProgressStore.getState().discoverExploreItem(discovery.id);
  }

  const isLoading = regionsLoading || questLoading;
  const hasError = !!regionsError || !!questError;

  const mapPins = (regions ?? []).length
    ? exploreMapPins.map((pin) => {
        const region = regions?.find((item) => item.id === pin.locationId);
        return {
          id: pin.locationId,
          label: region?.name_kg ?? pin.locationId,
          xPercent: pin.xPercent,
          yPercent: pin.yPercent,
        };
      })
    : [];

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

  return (
    <View style={styles.root}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.sm }]}
      >
        <ExploreHeader
          onPressAvatar={() => router.push('/character-select' as never)}
          onPressCollection={() => router.push('/collection' as never)}
        />

        {isLoading ? (
          <View style={styles.stateBlock}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : hasError ? (
          <View style={styles.stateBlock}>
            <Text style={styles.stateText}>{t('explore.loadError')}</Text>
          </View>
        ) : (
          <>
            <View style={styles.horizontalPad}>
              <KyrgyzstanMap
                pins={mapPins}
                onPressPin={(locationId) => router.push(`/explore/${locationId}` as never)}
                onPressLocate={() => {}}
                onPressFilter={() => router.push('/collection' as never)}
              />
            </View>

            <View style={styles.horizontalPad}>
              <RegionProgressCard progress={exploreProgress} />
            </View>

            {quest && (
              <View style={styles.horizontalPad}>
                <CurrentQuestCard quest={quest} onPress={handlePressQuest} />
              </View>
            )}

            <DiscoveriesRow
              discoveries={exploreDiscoveries}
              discoveredIds={progress.discoveredExploreIds}
              onPressDiscovery={handlePressDiscovery}
              onPressSeeAll={() => router.push('/collection' as never)}
            />
          </>
        )}
      </ScrollView>

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
  horizontalPad: {
    paddingHorizontal: spacing.md,
  },
  stateBlock: {
    paddingVertical: spacing.xxl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stateText: {
    color: colors.textSecondary,
  },
});
