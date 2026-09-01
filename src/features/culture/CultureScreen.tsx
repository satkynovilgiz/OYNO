import { router } from 'expo-router';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomTabBar } from '@/components/navigation/BottomTabBar';
import { useTrackScreenView } from '@/services/analytics/useTrackScreenView';
import { useCultureCategories, useCultureMaterials } from '@/services/content/cultureService';
import { useNotificationsStore } from '@/store/useNotificationsStore';
import { useProgressStore } from '@/store/useProgressStore';
import { colors, spacing } from '@/theme';

import {
  CultureCategoriesGrid,
  CultureHeader,
  CultureHero,
  CultureProgressCard,
  EnterBozUyCard,
  InteractiveExperiencesRow,
  NewMaterialsRow,
  QuizTeaserCard,
  TodayDiscoveryCard,
} from './components';
import type { InteractiveExperience } from './components';
import { cultureCategoryImages, cultureCategoryMockProgress, cultureMaterialImages, cultureProgress } from './data';
import type { CultureCategory, CultureCategoryId, CultureDiscovery, CultureMaterial } from './types';

const INTERACTIVE_EXPERIENCES: InteractiveExperience[] = [
  { id: 'oymo', titleKey: 'culture.interactive.oymo', imageSource: cultureCategoryImages.oymo },
  { id: 'boz-uy', titleKey: 'culture.interactive.bozUy', imageSource: cultureCategoryImages['boz-uy'] },
  { id: 'shyrdak', titleKey: 'culture.interactive.shyrdak', imageSource: cultureCategoryImages.shyrdak },
  { id: 'komuz', titleKey: 'culture.interactive.komuz', imageSource: cultureCategoryImages.komuz },
];

function handlePressExperience(id: string) {
  if (id === 'oymo') router.push('/culture/oymo/create' as never);
  if (id === 'boz-uy') router.push('/culture/boz-uy/build' as never);
  if (id === 'shyrdak') router.push('/culture/shyrdak/create' as never);
  if (id === 'komuz') router.push('/culture/komuz/learn' as never);
}

function handlePressCategory(category: CultureCategory) {
  if (category.id === 'games') {
    router.push('/games' as never);
    return;
  }
  router.push(`/culture/${category.id}` as never);
}

export function CultureScreen() {
  useTrackScreenView('culture');
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const hasUnreadNotifications = useNotificationsStore((state) => state.hasUnread());
  const progress = useProgressStore();
  const { data: categoryRows, isLoading: categoriesLoading, error: categoriesError } = useCultureCategories();
  const { data: materialRows, isLoading: materialsLoading, error: materialsError } = useCultureMaterials();

  const isLoading = categoriesLoading || materialsLoading;
  const hasError = !!categoriesError || !!materialsError;

  const categories: CultureCategory[] = (categoryRows ?? []).map((row) => {
    const id = row.id as CultureCategoryId;
    return {
      id,
      title: row.title,
      imageSource: cultureCategoryImages[id],
      ...cultureCategoryMockProgress[id],
    };
  });

  const todayDiscoveryRow = materialRows?.find((row) => row.kind === 'today_discovery');
  const todayDiscovery: CultureDiscovery | null = todayDiscoveryRow
    ? {
        title: todayDiscoveryRow.title,
        description: todayDiscoveryRow.description ?? '',
        imageSource: cultureMaterialImages[todayDiscoveryRow.id],
        isNew: true,
      }
    : null;

  const materials: CultureMaterial[] = (materialRows ?? [])
    .filter((row) => row.kind !== 'today_discovery')
    .map((row) => ({
      id: row.id,
      title: row.title,
      type: row.kind as CultureMaterial['type'],
      durationMinutes: row.duration_minutes ?? 0,
      imageSource: cultureMaterialImages[row.id],
    }));

  return (
    <View style={styles.root}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.sm }]}
      >
        <CultureHeader
          streakDays={progress.streakDays}
          coins={progress.coins}
          hasUnreadNotifications={hasUnreadNotifications}
          onPressAvatar={() => router.push('/character-select' as never)}
          onPressNotifications={() => router.push('/notifications' as never)}
        />

        <View style={styles.horizontalPad}>
          <CultureHero onPress={() => router.push('/collection' as never)} />
        </View>

        {isLoading ? (
          <View style={styles.stateBlock}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : hasError ? (
          <View style={styles.stateBlock}>
            <Text style={styles.stateText}>{t('culture.loadError')}</Text>
          </View>
        ) : (
          <>
            <CultureCategoriesGrid
              categories={categories}
              onPressCategory={handlePressCategory}
              onPressSeeAll={() => router.push('/collection' as never)}
            />

            <View style={styles.horizontalPad}>
              <InteractiveExperiencesRow experiences={INTERACTIVE_EXPERIENCES} onPressExperience={handlePressExperience} />
            </View>

            <View style={[styles.horizontalPad, styles.row]}>
              {todayDiscovery && (
                <TodayDiscoveryCard
                  discovery={todayDiscovery}
                  onPress={() => useProgressStore.getState().discoverCulture()}
                />
              )}
              <EnterBozUyCard onPress={() => router.push('/culture/boz-uy/build' as never)} />
            </View>

            <View style={styles.horizontalPad}>
              <CultureProgressCard progress={cultureProgress} />
            </View>

            <View style={styles.horizontalPad}>
              <QuizTeaserCard onPress={() => router.push('/culture/quiz' as never)} />
            </View>

            <View style={styles.horizontalPad}>
              <NewMaterialsRow
                materials={materials}
                onPressMaterial={(material) => router.push(`/culture/material/${material.id}` as never)}
              />
            </View>
          </>
        )}
      </ScrollView>

      <View style={{ paddingBottom: insets.bottom }}>
        <BottomTabBar
          activeTab="culture"
          onPressTab={(tab) => {
            if (tab === 'home') router.push('/home');
            if (tab === 'games') router.push('/games' as never);
            if (tab === 'explore') router.push('/explore' as never);
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
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
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
