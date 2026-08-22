import { router } from 'expo-router';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
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
  NewMaterialsRow,
  QuizTeaserCard,
  TodayDiscoveryCard,
} from './components';
import { cultureCategoryImages, cultureCategoryMockProgress, cultureMaterialImages, cultureProgress } from './data';
import type { CultureCategory, CultureCategoryId, CultureDiscovery, CultureMaterial } from './types';

function handlePressCategory(category: CultureCategory) {
  if (category.id === 'games') {
    router.push('/games' as never);
    return;
  }
  router.push('/collection' as never);
}

export function CultureScreen() {
  useTrackScreenView('culture');
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
            <Text style={styles.stateText}>Мазмун жүктөлгөн жок. Кайра аракет кылыңыз.</Text>
          </View>
        ) : (
          <>
            <CultureCategoriesGrid
              categories={categories}
              onPressCategory={handlePressCategory}
              onPressSeeAll={() => router.push('/collection' as never)}
            />

            <View style={[styles.horizontalPad, styles.row]}>
              {todayDiscovery && (
                <TodayDiscoveryCard
                  discovery={todayDiscovery}
                  onPress={() => useProgressStore.getState().discoverCulture()}
                />
              )}
              <EnterBozUyCard onPress={() => useProgressStore.getState().visitBozUy()} />
            </View>

            <View style={styles.horizontalPad}>
              <CultureProgressCard progress={cultureProgress} />
            </View>

            <View style={[styles.horizontalPad, styles.row]}>
              <View style={styles.quizCol}>
                <QuizTeaserCard onPress={() => console.log('navigate: culture quiz')} />
              </View>
              <View style={styles.materialsCol}>
                <NewMaterialsRow
                  materials={materials}
                  onPressMaterial={(material) => console.log('navigate: material detail', material.id)}
                  onPressSeeAll={() => console.log('navigate: all materials')}
                />
              </View>
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
  quizCol: {
    flex: 0.4,
  },
  materialsCol: {
    flex: 0.6,
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
