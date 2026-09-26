import { router } from 'expo-router';
import { Gamepad2, Landmark, Mountain, Route, Search as SearchIcon, SearchX, X, type LucideIcon } from 'lucide-react-native';
import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LibraryEmptyState } from '@/components/library/LibraryChrome';
import { offlineKindFor } from '@/components/library/contentTypeMeta';
import { AnimatedPressable, FadeSlideIn, SectionHeader } from '@/components/ui';
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
import { groupRankedResults, rankSearchResults } from '@/services/search/globalSearch';
import { addRecentSearch, clearRecentSearches, getRecentSearches, saveRecentSearches } from '@/services/search/recentSearches';
import { useDailyDiscoveryStore } from '@/store/useDailyDiscoveryStore';
import { useFavoritesStore } from '@/store/useFavoritesStore';
import { useProgressStore } from '@/store/useProgressStore';
import { cardRadii, colors, elevation, spacing, textStyles } from '@/theme';

import { SearchResultRow } from './SearchResultRow';

type SearchScreenProps = {
  onPressBack: () => void;
  onPressResult: (route: string) => void;
};

type Category = { id: 'places' | 'culture' | 'games' | 'trails'; icon: LucideIcon; route: string; tone: string };

// Real destinations only. Trails live in Journey (there is no trail index).
const CATEGORIES: Category[] = [
  { id: 'places', icon: Mountain, route: '/explore', tone: '#3D6E72' },
  { id: 'culture', icon: Landmark, route: '/culture', tone: colors.accentTerracotta },
  { id: 'games', icon: Gamepad2, route: '/games', tone: colors.primary },
  { id: 'trails', icon: Route, route: '/journey', tone: '#8B6B3D' },
];

/**
 * Search - the fastest way to anything in OYNO. Local and instant over the
 * one shared content catalog (places, culture, collections, trails, games);
 * private notes are never part of it.
 *   before typing  recent searches (device-only), recently explored (real
 *                  visit / Daily dates), category shortcuts
 *   while typing   ranked results grouped by kind, a few per group with
 *                  "Show all"; honest zero-results state
 */
export function SearchScreen({ onPressBack, onPressResult }: SearchScreenProps) {
  const { t, i18n } = useTranslation();
  const language = i18n.language as SupportedLanguage;
  const insets = useSafeAreaInsets();
  const { experience } = useAgeExperience();
  const large = experience === 'child';
  const preview = large ? 3 : 4;

  const [query, setQuery] = useState('');
  // Local data - no debounce; React keeps typing responsive by rendering
  // results at lower priority than the keystroke itself.
  const deferredQuery = useDeferredValue(query);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [expanded, setExpanded] = useState<string[]>([]);

  useEffect(() => {
    void getRecentSearches().then(setRecentSearches);
  }, []);

  useEffect(() => setExpanded([]), [deferredQuery]);

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
      ...buildExploreCatalog(regions ?? [], language),
      ...buildCultureCategoryCatalog(categories ?? []),
      ...buildCultureItemCatalog(items ?? [], categories ?? []),
      ...buildInteractiveExperienceCatalog(t),
      ...buildCultureMaterialCatalog(materials ?? []),
      ...buildCollectionCatalog(collections, language, null),
      ...buildTrailCatalog(trails, language, (trail) => {
        const progress = computeTrailProgress(trail, trailSignals);
        if (progress.status === 'untracked') return null;
        return progress.status === 'completed' ? t('trails.status.completed') : t('trails.progress', { completed: progress.completed, total: progress.total });
      }),
      ...buildGameCatalog(mockGamesList, t),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [categories, materials, items, regions, language, trailSignals],
  );

  // Real history only: places opened and Daily discoveries completed.
  const recentlyExplored = useMemo(() => {
    return buildRecentlyExplored(regionVisitDates, dailyCompletions, 4)
      .map((entry) =>
        entry.kind === 'place'
          ? catalog.find((item) => (item.contentType === 'nature' || item.contentType === 'region') && item.id === entry.id)
          : catalog.find((item) => item.contentType === 'culture_item' && item.id === entry.id),
      )
      .filter((item): item is CatalogItem => !!item && !!item.route);
  }, [regionVisitDates, dailyCompletions, catalog]);

  const results = useMemo(() => rankSearchResults(catalog, deferredQuery), [catalog, deferredQuery]);
  const groups = useMemo(() => groupRankedResults(results), [results]);
  const isTyping = deferredQuery.trim().length > 0;

  const isSaved = (item: CatalogItem) => favoriteIds.includes(`${item.contentType}:${item.id}`);
  const isOffline = (item: CatalogItem) => {
    const kind = offlineKindFor(item.contentType);
    return !!kind && !!offlineEntries[downloadId(kind, item.id)];
  };

  const remember = (value: string) => {
    const next = addRecentSearch(recentSearches, value);
    if (next === recentSearches) return;
    setRecentSearches(next);
    void saveRecentSearches(next);
  };

  const openResult = (item: CatalogItem) => {
    if (!item.route) return;
    remember(query);
    onPressResult(item.route);
  };

  const row = (item: CatalogItem, highlightQuery: string) => (
    <SearchResultRow key={`${item.contentType}:${item.id}`} item={item} query={highlightQuery} saved={isSaved(item)} offline={isOffline(item)} large={large} onPress={() => openResult(item)} />
  );

  const categoryGrid = (
    <View style={styles.categories}>
      {CATEGORIES.map(({ id, icon: Icon, route, tone }) => (
        <AnimatedPressable key={id} style={[styles.category, large && styles.categoryLarge]} onPress={() => router.push(route as never)} press="soft" accessibilityRole="button" accessibilityLabel={t(`search.v2.categories.${id}`)}>
          <View style={[styles.categoryIcon, { backgroundColor: tone }]}>
            <Icon size={large ? 22 : 18} color={colors.textOnDark} strokeWidth={2} />
          </View>
          <Text style={[styles.categoryText, large && styles.categoryTextLarge]} numberOfLines={2}>
            {t(`search.v2.categories.${id}`)}
          </Text>
        </AnimatedPressable>
      ))}
    </View>
  );

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <View style={styles.field}>
          <SearchIcon size={18} color={colors.textSecondary} strokeWidth={2.25} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t('search.v2.placeholder')}
            placeholderTextColor={colors.textMuted}
            style={[styles.input, large && styles.inputLarge]}
            autoFocus
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
            enterKeyHint="search"
            onSubmitEditing={() => remember(query)}
            accessibilityRole="search"
            accessibilityLabel={t('search.title')}
            accessibilityHint={t('search.v2.fieldHint')}
          />
          {query.length > 0 ? (
            <AnimatedPressable style={styles.clear} onPress={() => setQuery('')} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('search.clearLabel')}>
              <X size={14} color={colors.textOnDark} strokeWidth={3} />
            </AnimatedPressable>
          ) : null}
        </View>
        <AnimatedPressable style={styles.cancel} onPress={onPressBack} hitSlop={6} accessibilityRole="button" accessibilityLabel={t('search.cancelLabel')}>
          <Text style={styles.cancelText}>{t('search.cancelLabel')}</Text>
        </AnimatedPressable>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        automaticallyAdjustKeyboardInsets
        showsVerticalScrollIndicator={false}
      >
        {!isTyping ? (
          <>
            {recentSearches.length > 0 ? (
              <FadeSlideIn index={0} style={styles.section}>
                <SectionHeader
                  title={t('search.recentTitle')}
                  size="sm"
                  inset={0}
                  actionLabel={t('search.v2.clearRecent')}
                  onPressAction={() => {
                    setRecentSearches([]);
                    void clearRecentSearches();
                  }}
                />
                <View style={styles.chipsRow}>
                  {recentSearches.map((entry) => (
                    <AnimatedPressable key={entry} style={styles.recentChip} onPress={() => setQuery(entry)} press="soft" accessibilityRole="button" accessibilityLabel={t('search.v2.searchFor', { query: entry })}>
                      <SearchIcon size={12} color={colors.textMuted} strokeWidth={2.25} />
                      <Text style={styles.recentChipText} numberOfLines={1}>
                        {entry}
                      </Text>
                    </AnimatedPressable>
                  ))}
                </View>
              </FadeSlideIn>
            ) : null}

            {recentlyExplored.length > 0 ? (
              <FadeSlideIn index={1} style={styles.section}>
                <SectionHeader title={t('library.recentlyViewed')} size="sm" inset={0} />
                <View>{recentlyExplored.map((item) => row(item, ''))}</View>
              </FadeSlideIn>
            ) : null}

            <FadeSlideIn index={2} style={styles.section}>
              <SectionHeader title={t('search.v2.browseTitle')} size="sm" inset={0} />
              {categoryGrid}
            </FadeSlideIn>
          </>
        ) : groups.length > 0 ? (
          <>
            <Text style={styles.resultCount} accessibilityLiveRegion="polite">
              {t('search.v2.resultCount', { count: results.length })}
            </Text>
            {groups.map((group) => {
              const open = expanded.includes(group.id);
              const shown = open ? group.items : group.items.slice(0, preview);
              const more = group.items.length - preview;
              return (
                <View key={group.id} style={styles.section}>
                  <SectionHeader
                    title={t(`search.groups.${group.id}`)}
                    count={group.items.length}
                    size="sm"
                    inset={0}
                    actionLabel={more > 0 ? (open ? t('search.v2.showLess') : t('search.v2.showAll')) : undefined}
                    onPressAction={more > 0 ? () => setExpanded((current) => (open ? current.filter((id) => id !== group.id) : [...current, group.id])) : undefined}
                  />
                  <View>{shown.map((item) => row(item, deferredQuery))}</View>
                </View>
              );
            })}
          </>
        ) : (
          <>
            <LibraryEmptyState icon={SearchX} tone={colors.accentTerracotta} title={t('library.noResults', { query: deferredQuery.trim() })} description={t('search.v2.noResultsHint')} />
            {categoryGrid}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  field: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.xs, height: 50, paddingHorizontal: spacing.md, borderRadius: cardRadii.chip, backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.borderSubtle, ...elevation.soft },
  // The field's own border shows focus; no extra browser outline on web.
  input: { flex: 1, ...textStyles.body, fontSize: 17, color: colors.textPrimary, paddingVertical: 0, ...(Platform.OS === 'web' ? ({ outlineWidth: 0, outlineStyle: 'none' } as object) : null) },
  inputLarge: { fontSize: 19 },
  clear: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.textMuted },
  cancel: { minHeight: 44, justifyContent: 'center' },
  cancelText: { ...textStyles.bodyMedium, fontWeight: '600', color: colors.primary },
  content: { paddingHorizontal: spacing.md, gap: spacing.lg, paddingTop: spacing.xs },
  section: { gap: spacing.xs },
  resultCount: { ...textStyles.caption, color: colors.textMuted, marginBottom: -spacing.sm },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  recentChip: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 36, maxWidth: '100%', paddingHorizontal: spacing.sm, borderRadius: cardRadii.chip, backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.borderSubtle },
  recentChipText: { ...textStyles.caption, fontWeight: '600', color: colors.textPrimary, flexShrink: 1 },
  categories: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: spacing.sm },
  category: { width: '48.5%', flexDirection: 'row', alignItems: 'center', gap: spacing.xs, minHeight: 56, padding: spacing.xs, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.borderSubtle },
  categoryLarge: { minHeight: 72 },
  categoryIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  categoryText: { ...textStyles.bodyMedium, fontWeight: '700', color: colors.textPrimary, flexShrink: 1 },
  categoryTextLarge: { fontSize: 18 },
});
