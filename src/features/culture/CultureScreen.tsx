import { router } from 'expo-router';
import { Search, TriangleAlert } from 'lucide-react-native';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomTabBar } from '@/components/navigation/BottomTabBar';
import { AgeExperienceTransition, EmptyState, FadeSlideIn, HeroEntrance, IconButton, ScreenEntrance, ScreenHeader, SectionHeader, Skeleton } from '@/components/ui';
import { ChallengesEntryCard } from '@/features/challenges/ChallengesEntryCard';
import { collections } from '@/features/collections/collectionsData';
import { computeCollectionProgress } from '@/features/collections/collectionProgress';
import { useCollectionSignals } from '@/features/collections/useCollectionProgress';
import { komuzTracks } from './audioData';
import type { SupportedLanguage } from '@/i18n';
import { dayNumber, localDateKey } from '@/services/daily/dailyDiscovery';
import { useAllCultureItems } from '@/services/content/cultureItemsService';
import { useDailyDiscoveryStore } from '@/store/useDailyDiscoveryStore';
import { useAgeExperience } from '@/services/ageExperience/useAgeExperience';
import { useTrackScreenView } from '@/services/analytics/useTrackScreenView';
import { useCultureCategories, useCultureMaterials } from '@/services/content/cultureService';
import { useProgressStore } from '@/store/useProgressStore';
import { colors, spacing } from '@/theme';

import {
  CategoryGrid,
  CollectionsRail,
  ContinueLearning,
  EnterBozUyCard,
  FeaturedStoryCard,
  InteractiveExperiencesRow,
  ListenCard,
  NewMaterialsRow,
  QuizTeaserCard,
  TodayDiscoveryCard,
  type ContinueRowData,
} from './components';
import { getCultureSectionOrder, type CultureSectionId } from './cultureSections';
import { cultureCategoryImages, cultureItemImages, cultureMaterialImages } from './data';
import { INTERACTIVE_EXPERIENCES, routeForInteractiveExperience } from './interactiveExperiences';
import type { CultureCategoryId, CultureDiscovery, CultureMaterial } from './types';

function handlePressExperience(id: string) {
  const route = routeForInteractiveExperience(id);
  if (route) router.push(route as never);
}

function handlePressCategory(categoryId: string) {
  if (categoryId === 'games') {
    router.push('/games' as never);
    return;
  }
  router.push(`/culture/${categoryId}` as never);
}

export function CultureScreen() {
  useTrackScreenView('culture');
  const { t, i18n } = useTranslation();
  const language = i18n.language as SupportedLanguage;
  const insets = useSafeAreaInsets();
  const { experience } = useAgeExperience();
  const collectionSignals = useCollectionSignals();
  const dailyCompletions = useDailyDiscoveryStore((state) => state.completions);
  const { data: allItems } = useAllCultureItems();
  const { data: categoryRows, isLoading: categoriesLoading, error: categoriesError, refetch: refetchCategories } = useCultureCategories();
  const { data: materialRows, isLoading: materialsLoading, error: materialsError, refetch: refetchMaterials } = useCultureMaterials();

  const isLoading = categoriesLoading || materialsLoading;
  const hasError = !!categoriesError || !!materialsError;

  // Real counts only: number of culture_items per category (null while
  // the items query hasn't answered - no number rather than a guess).
  const categories = (categoryRows ?? []).map((row) => {
    const id = row.id as CultureCategoryId;
    const count = allItems ? allItems.filter((item) => item.category_id === id).length : null;
    return { id, title: row.title, image: cultureCategoryImages[id], count: count && count > 0 ? count : null };
  });

  const collectionCards = collections.map((collection) => {
    const progress = computeCollectionProgress(collection, collectionSignals);
    const status =
      progress.status === 'completed'
        ? `✓ ${t('collections.status.completed')}`
        : progress.status === 'inProgress'
          ? t('collections.status.continue')
          : undefined;
    return {
      id: collection.id,
      title: collection.title[language] ?? collection.title.kg,
      intro: collection.intro[language] ?? collection.intro.kg,
      image: collection.heroImage,
      completed: progress.completed,
      total: progress.total,
      status,
      inProgress: progress.status === 'inProgress',
    };
  });

  // Featured story: a stable daily rotation over the real curated
  // collections; the excerpt is the collection's own editorial intro.
  const featuredCollection = collectionCards.length > 0 ? collectionCards[dayNumber(localDateKey()) % collectionCards.length] : null;

  // Continue learning: collections really in progress, then the latest
  // real Daily OYNO completions (culture items) - newest first.
  const continueRows: ContinueRowData[] = [
    ...collectionCards
      .filter((card) => card.inProgress)
      .map((card) => ({ key: `collection:${card.id}`, title: card.title, meta: t('collections.progress', { completed: card.completed, total: card.total }), image: card.image, route: `/collections/${card.id}` })),
    ...Object.entries(dailyCompletions)
      .sort(([a], [b]) => b.localeCompare(a))
      .slice(0, 2)
      .flatMap(([dateKey, itemId]) => {
        const item = allItems?.find((row) => row.id === itemId);
        return item ? [{ key: `daily:${dateKey}`, title: item.title, meta: `${t('daily.entry.title')} · ${dateKey.slice(8, 10)}.${dateKey.slice(5, 7)}`, image: cultureItemImages[item.id]?.[0] ?? null, route: `/culture/item/${item.id}` }] : [];
      }),
  ].slice(0, 3);

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
        return <CategoryGrid key={id} categories={categories} experience={experience} onPressCategory={handlePressCategory} />;
      case 'collections':
        return <CollectionsRail key={id} items={collectionCards} experience={experience} onPress={(collectionId) => router.push(`/collections/${collectionId}` as never)} />;
      case 'continue':
        return <ContinueLearning key={id} rows={continueRows} onPress={(route) => router.push(route as never)} />;
      case 'listen':
        return <ListenCard key={id} trackCount={komuzTracks.length} image={cultureCategoryImages.komuz} onPress={() => router.push('/culture/komuz/learn' as never)} />;
      case 'interactive':
        return <InteractiveExperiencesRow key={id} experiences={INTERACTIVE_EXPERIENCES} onPressExperience={handlePressExperience} />;
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
      case 'learn':
        return (
          <View key={id} style={styles.stack}>
            <SectionHeader title={t('culture.v2.learnTitle')} size="sm" />
            <View style={[styles.horizontalPad, styles.stack]}>
              <QuizTeaserCard onPress={() => router.push('/culture/quiz' as never)} />
              <ChallengesEntryCard />
            </View>
          </View>
        );
      case 'newMaterials':
        return <NewMaterialsRow key={id} materials={materials} onPressMaterial={(material) => router.push(`/culture/material/${material.id}` as never)} />;
    }
  }

  return (
    <View style={styles.root}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.xs }]}
      >
        <ScreenEntrance>
          <ScreenHeader
            eyebrow="OYNO"
            title={t('culture.title')}
            subtitle={t('culture.subtitle')}
            editorialTitle
            actions={<IconButton icon={Search} size={40} iconSize={20} shape="roundedSquare" elevated={false} accessibilityLabel={t('culture.searchLabel')} onPress={() => router.push('/search' as never)} />}
          />
        </ScreenEntrance>

        {featuredCollection ? (
          <HeroEntrance>
            <FeaturedStoryCard
              story={{ id: featuredCollection.id, eyebrow: t('culture.v2.featured'), title: featuredCollection.title, excerpt: featuredCollection.intro, image: featuredCollection.image }}
              experience={experience}
              onPress={() => router.push(`/collections/${featuredCollection.id}` as never)}
            />
          </HeroEntrance>
        ) : null}

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
    gap: spacing.xl,
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
