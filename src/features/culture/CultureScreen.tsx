import { router } from 'expo-router';
import { TriangleAlert } from 'lucide-react-native';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomTabBar } from '@/components/navigation/BottomTabBar';
import { AgeExperienceTransition, EmptyState, FadeSlideIn, HeroEntrance, ScreenEntrance, Skeleton } from '@/components/ui';
import { collections } from '@/features/collections/collectionsData';
import { CollectionsRow } from '@/features/collections/components/CollectionsRow';
import { useAgeExperience } from '@/services/ageExperience/useAgeExperience';
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
import { getCultureSectionOrder, type CultureSectionId } from './cultureSections';
import { cultureCategoryImages, cultureCategoryMockProgress, cultureMaterialImages, cultureProgress } from './data';
import { INTERACTIVE_EXPERIENCES, routeForInteractiveExperience } from './interactiveExperiences';
import type { CultureCategory, CultureCategoryId, CultureDiscovery, CultureMaterial } from './types';

function handlePressExperience(id: string) {
  const route = routeForInteractiveExperience(id);
  if (route) router.push(route as never);
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
  const { experience } = useAgeExperience();
  const hasUnreadNotifications = useNotificationsStore((state) => state.hasUnread());
  const progress = useProgressStore();
  const { data: categoryRows, isLoading: categoriesLoading, error: categoriesError, refetch: refetchCategories } = useCultureCategories();
  const { data: materialRows, isLoading: materialsLoading, error: materialsError, refetch: refetchMaterials } = useCultureMaterials();

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

  // Same seven sections, same underlying categories/materials data, for
  // every AgeExperience - only their order changes (spec "Make Culture and
  // Explore adapt to AgeExperience... Keep same underlying data").
  function renderSection(id: CultureSectionId) {
    switch (id) {
      case 'categories':
        return (
          <CultureCategoriesGrid
            key={id}
            categories={categories}
            onPressCategory={handlePressCategory}
            onPressSeeAll={() => router.push('/collection' as never)}
          />
        );
      case 'interactive':
        return (
          <InteractiveExperiencesRow key={id} experiences={INTERACTIVE_EXPERIENCES} onPressExperience={handlePressExperience} />
        );
      case 'bozUy':
        return (
          <View key={id} style={styles.horizontalPad}>
            <EnterBozUyCard onPress={() => router.push('/culture/boz-uy/build' as never)} />
          </View>
        );
      case 'todayDiscovery':
        return todayDiscovery ? (
          <View key={id} style={styles.horizontalPad}>
            <TodayDiscoveryCard discovery={todayDiscovery} onPress={() => useProgressStore.getState().discoverCulture()} />
          </View>
        ) : null;
      case 'progressQuiz':
        return (
          <View key={id} style={[styles.horizontalPad, styles.stack]}>
            <CultureProgressCard progress={cultureProgress} />
            <QuizTeaserCard onPress={() => router.push('/culture/quiz' as never)} />
          </View>
        );
      case 'newMaterials':
        return (
          <NewMaterialsRow
            key={id}
            materials={materials}
            onPressMaterial={(material) => router.push(`/culture/material/${material.id}` as never)}
          />
        );
      case 'collections':
        return (
          <CollectionsRow
            key={id}
            collections={collections}
            onPressCollection={(collectionId) => router.push(`/collections/${collectionId}` as never)}
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
          <CultureHeader
            streakDays={progress.streakDays}
            coins={progress.coins}
            hasUnreadNotifications={hasUnreadNotifications}
            onPressAvatar={() => router.push('/character-select' as never)}
            onPressNotifications={() => router.push('/notifications' as never)}
          />
        </ScreenEntrance>

        <View style={styles.horizontalPad}>
          <HeroEntrance>
            <CultureHero onPress={() => router.push('/collection' as never)} />
          </HeroEntrance>
        </View>

        {isLoading ? (
          <View style={styles.horizontalPad}>
            <Skeleton height={180} borderRadius={22} style={styles.skeletonSpacing} />
            <View style={styles.skeletonRow}>
              <Skeleton height={100} style={styles.skeletonFlex} />
              <Skeleton height={100} style={styles.skeletonFlex} />
            </View>
          </View>
        ) : hasError ? (
          <EmptyState
            icon={TriangleAlert}
            tone="error"
            title={t('culture.loadError')}
            actionLabel={t('common.retry')}
            onPressAction={() => {
              refetchCategories();
              refetchMaterials();
            }}
          />
        ) : (
          <AgeExperienceTransition style={styles.sectionList}>
            {getCultureSectionOrder(experience).map((id, index) => (
              <FadeSlideIn key={id} index={index} staggerMs={40}>
                {renderSection(id)}
              </FadeSlideIn>
            ))}
          </AgeExperienceTransition>
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
  sectionList: {
    gap: spacing.lg,
  },
  horizontalPad: {
    paddingHorizontal: spacing.md,
  },
  stack: {
    gap: spacing.sm,
  },
  skeletonSpacing: {
    marginBottom: spacing.sm,
  },
  skeletonRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  skeletonFlex: {
    flex: 1,
  },
});
