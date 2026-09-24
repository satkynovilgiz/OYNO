import { router } from 'expo-router';
import { Compass, Gamepad2, Landmark, Search as SearchIcon, SearchX, X } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LibraryEmptyState, LibraryHeader, LibrarySectionHeader } from '@/components/library/LibraryChrome';
import { LibraryContentCard, LibraryContentRow } from '@/components/library/LibraryContentRow';
import { offlineKindFor } from '@/components/library/contentTypeMeta';
import { AnimatedPressable, FadeSlideIn, TextButton } from '@/components/ui';
import { collections } from '@/features/collections/collectionsData';
import { mockGamesList } from '@/features/games/mockData';
import { buildRecentlyExplored } from '@/features/home/homeRecommendation';
import { computeTrailProgress } from '@/features/trails/trailProgress';
import { trails } from '@/features/trails/trailsData';
import { useTrailSignals } from '@/features/trails/useTrailSignals';
import type { SupportedLanguage } from '@/i18n';
import { useAgeExperience } from '@/services/ageExperience/useAgeExperience';
import {
  type CatalogItem,
  buildCollectionCatalog,
  buildCultureCategoryCatalog,
  buildCultureItemCatalog,
  buildCultureMaterialCatalog,
  buildExploreCatalog,
  buildGameCatalog,
  buildInteractiveExperienceCatalog,
  buildTrailCatalog,
} from '@/services/content/contentCatalog';
import { useAllCultureItems } from '@/services/content/cultureItemsService';
import { useCultureCategories, useCultureMaterials } from '@/services/content/cultureService';
import { useExploreRegions } from '@/services/content/exploreService';
import { downloadId } from '@/services/offline/offlineManifest';
import { useOfflineStore } from '@/services/offline/useOfflineStore';
import { groupSearchResults, searchCatalog, type SearchResultGroup } from '@/services/search/globalSearch';
import { addRecentSearch, clearRecentSearches, getRecentSearches, saveRecentSearches } from '@/services/search/recentSearches';
import { useDailyDiscoveryStore } from '@/store/useDailyDiscoveryStore';
import { useFavoritesStore } from '@/store/useFavoritesStore';
import { useProgressStore } from '@/store/useProgressStore';
import { colors, radii, shadows, spacing, typography } from '@/theme';

type SearchScreenProps = {
  onPressBack: () => void;
  onPressResult: (route: string) => void;
};

const DEBOUNCE_MS = 200;
const GROUP_ORDER: SearchResultGroup[] = ['games', 'places', 'culture', 'trails', 'collections', 'materials'];
// An honest "suggested" set: games flagged `featured` in their real
// catalog data plus the interactive experiences - never a fabricated
// popularity ranking (no real search analytics exist).
const SUGGESTED_GAME_IDS = mockGamesList.filter((game) => game.featured).map((game) => game.id);

/**
 * Search - part of "Your OYNO": a large clean field; before typing, real
 * recent searches and real recently explored content (Explore visits and
 * completed Daily discoveries - no new history store), then honest
 * suggestions; while typing, results grouped by kind (only non-empty
 * groups). Same shared rows/marks as Saved and Offline.
 */
export function SearchScreen({ onPressBack, onPressResult }: SearchScreenProps) {
  const { t, i18n } = useTranslation();
  const language = i18n.language as SupportedLanguage;
  const insets = useSafeAreaInsets();
  const { experience } = useAgeExperience();

  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  useEffect(() => {
    void getRecentSearches().then(setRecentSearches);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  const { data: categories } = useCultureCategories();
  const { data: materials } = useCultureMaterials();
  const { data: items } = useAllCultureItems();
  const { data: regions } = useExploreRegions();
  const trailSignals = useTrailSignals();
  const favoriteIds = useFavoritesStore((state) => state.favoriteIds);
  const offlineEntries = useOfflineStore((state) => state.manifest.entries);
  const regionVisitDates = useProgressStore((state) => state.regionVisitDates);
  const dailyCompletions = useDailyDiscoveryStore((state) => state.completions);

  const catalog = useMemo<CatalogItem[]>(
    () => [
      ...buildGameCatalog(mockGamesList, t),
      ...buildCultureCategoryCatalog(categories ?? []),
      ...buildCultureItemCatalog(items ?? [], categories ?? []),
      ...buildCultureMaterialCatalog(materials ?? []),
      ...buildExploreCatalog(regions ?? [], language),
      ...buildInteractiveExperienceCatalog(t),
      ...buildTrailCatalog(trails, language, (trail) => {
        const progress = computeTrailProgress(trail, trailSignals);
        if (progress.status === 'untracked') return null;
        return progress.status === 'completed' ? t('trails.status.completed') : t('trails.progress', { completed: progress.completed, total: progress.total });
      }),
      ...buildCollectionCatalog(collections, language, null),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [categories, materials, items, regions, language, trailSignals],
  );

  const suggested = useMemo(
    () => catalog.filter((item) => (item.contentType === 'game' && SUGGESTED_GAME_IDS.includes(item.id)) || item.contentType === 'interactive_experience'),
    [catalog],
  );

  // Real history only: places opened and Daily discoveries completed.
  const recentlyViewed = useMemo(() => {
    return buildRecentlyExplored(regionVisitDates, dailyCompletions, 5)
      .map((entry) =>
        entry.kind === 'place'
          ? catalog.find((item) => (item.contentType === 'nature' || item.contentType === 'region') && item.id === entry.id)
          : catalog.find((item) => item.contentType === 'culture_item' && item.id === entry.id),
      )
      .filter((item): item is CatalogItem => !!item && !!item.route);
  }, [regionVisitDates, dailyCompletions, catalog]);

  const results = useMemo(() => searchCatalog(catalog, debouncedQuery), [catalog, debouncedQuery]);
  const grouped = useMemo(() => groupSearchResults(results), [results]);
  const isTyping = debouncedQuery.trim().length > 0;

  const isSaved = (item: CatalogItem) => favoriteIds.includes(`${item.contentType}:${item.id}`);
  const isOffline = (item: CatalogItem) => {
    const kind = offlineKindFor(item.contentType);
    return !!kind && !!offlineEntries[downloadId(kind, item.id)];
  };

  const handlePressResult = (item: CatalogItem) => {
    if (!item.route) return;
    if (query.trim()) {
      const next = addRecentSearch(recentSearches, query);
      setRecentSearches(next);
      void saveRecentSearches(next);
    }
    onPressResult(item.route);
  };

  const renderItems = (list: CatalogItem[]) =>
    experience === 'preteen' ? (
      <View style={styles.grid}>
        {list.map((item) => (
          <View key={`${item.contentType}:${item.id}`} style={styles.gridCell}>
            <LibraryContentCard item={{ ...item, subtitle: item.metadata }} saved={isSaved(item)} offline={isOffline(item)} onPress={() => handlePressResult(item)} />
          </View>
        ))}
      </View>
    ) : (
      <View style={styles.list}>
        {list.map((item) => (
          <LibraryContentRow key={`${item.contentType}:${item.id}`} item={{ ...item, subtitle: item.metadata }} experience={experience} saved={isSaved(item)} offline={isOffline(item)} onPress={() => handlePressResult(item)} />
        ))}
      </View>
    );

  return (
    <View style={styles.root}>
      <LibraryHeader onPressBack={onPressBack}>
        <View style={styles.field}>
          <SearchIcon size={18} color={colors.textSecondary} strokeWidth={2} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t('search.placeholder')}
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            autoFocus
            returnKeyType="search"
            accessibilityLabel={t('search.title')}
          />
          {query.length > 0 ? (
            <AnimatedPressable onPress={() => setQuery('')} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('search.clearLabel')}>
              <X size={18} color={colors.textMuted} strokeWidth={2.25} />
            </AnimatedPressable>
          ) : null}
        </View>
      </LibraryHeader>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {!isTyping ? (
          <>
            {recentSearches.length > 0 ? (
              <FadeSlideIn index={0} style={styles.section}>
                <LibrarySectionHeader
                  title={t('search.recentTitle')}
                  action={
                    <TextButton
                      label={t('search.clearRecent')}
                      onPress={() => {
                        setRecentSearches([]);
                        void clearRecentSearches();
                      }}
                    />
                  }
                />
                <View style={styles.chipsRow}>
                  {recentSearches.map((entry) => (
                    <AnimatedPressable key={entry} style={styles.recentChip} onPress={() => setQuery(entry)} accessibilityRole="button" accessibilityLabel={entry}>
                      <SearchIcon size={12} color={colors.textMuted} strokeWidth={2.25} />
                      <Text style={styles.recentChipText} numberOfLines={1}>
                        {entry}
                      </Text>
                    </AnimatedPressable>
                  ))}
                </View>
              </FadeSlideIn>
            ) : null}

            {recentlyViewed.length > 0 ? (
              <FadeSlideIn index={1} style={styles.section}>
                <LibrarySectionHeader title={t('library.recentlyViewed')} />
                {renderItems(recentlyViewed)}
              </FadeSlideIn>
            ) : null}

            <FadeSlideIn index={2} style={styles.section}>
              <LibrarySectionHeader title={t('search.suggestedTitle')} />
              {renderItems(experience === 'child' ? suggested.slice(0, 4) : suggested)}
            </FadeSlideIn>
          </>
        ) : results.length > 0 ? (
          GROUP_ORDER.filter((group) => grouped[group].length > 0).map((group, index) => (
            <FadeSlideIn key={group} index={index} style={styles.section}>
              <LibrarySectionHeader title={t(`search.groups.${group}`)} count={grouped[group].length} />
              {renderItems(grouped[group])}
            </FadeSlideIn>
          ))
        ) : (
          <LibraryEmptyState icon={SearchX} tone={colors.accentTerracotta} title={t('library.noResults', { query: debouncedQuery.trim() })} description={t('library.noResultsHint')}>
            {[
              { label: t('library.browse.games'), icon: Gamepad2, route: '/games' },
              { label: t('library.browse.culture'), icon: Landmark, route: '/culture' },
              { label: t('library.browse.places'), icon: Compass, route: '/explore' },
            ].map(({ label, icon: Icon, route }) => (
              <AnimatedPressable key={route} style={styles.browseChip} onPress={() => router.push(route as never)} accessibilityRole="button" accessibilityLabel={label}>
                <Icon size={14} color={colors.primary} strokeWidth={2.25} />
                <Text style={styles.browseChipText}>{label}</Text>
              </AnimatedPressable>
            ))}
          </LibraryEmptyState>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  field: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, backgroundColor: colors.surface, paddingHorizontal: spacing.md, height: 52, borderRadius: radii.pill, borderWidth: 1.5, borderColor: colors.surfaceBorder, ...shadows.card },
  input: { flex: 1, ...typography.body, fontSize: 17, color: colors.textPrimary },
  content: { paddingHorizontal: spacing.md, gap: spacing.lg, paddingTop: spacing.xs },
  section: { gap: spacing.sm },
  list: { gap: spacing.xxs },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: spacing.md },
  gridCell: { width: '48%' },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  recentChip: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 36, maxWidth: '100%', paddingHorizontal: spacing.sm, borderRadius: radii.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.surfaceBorder },
  recentChipText: { ...typography.caption, fontWeight: '600', color: colors.textPrimary, flexShrink: 1 },
  browseChip: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 40, paddingHorizontal: spacing.md, borderRadius: radii.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.surfaceBorder },
  browseChipText: { ...typography.caption, fontWeight: '700', color: colors.primary },
});
