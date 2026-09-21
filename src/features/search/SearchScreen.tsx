import { ChevronLeft, Search as SearchIcon, X } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnimatedPressable, EmptyState, IconButton, TextButton } from '@/components/ui';
import { mockGamesList } from '@/features/games/mockData';
import type { SupportedLanguage } from '@/i18n';
import {
  buildCultureCategoryCatalog,
  buildCultureItemCatalog,
  buildCultureMaterialCatalog,
  buildExploreCatalog,
  buildGameCatalog,
  buildInteractiveExperienceCatalog,
  type CatalogItem,
} from '@/services/content/contentCatalog';
import { useAllCultureItems } from '@/services/content/cultureItemsService';
import { useCultureCategories, useCultureMaterials } from '@/services/content/cultureService';
import { useExploreRegions } from '@/services/content/exploreService';
import { addRecentSearch, clearRecentSearches, getRecentSearches, saveRecentSearches } from '@/services/search/recentSearches';
import { groupSearchResults, searchCatalog, type SearchResultGroup } from '@/services/search/globalSearch';
import { colors, radii, shadows, spacing, typography } from '@/theme';

import { SearchResultRow } from './components/SearchResultRow';

type SearchScreenProps = {
  onPressBack: () => void;
  onPressResult: (route: string) => void;
};

const DEBOUNCE_MS = 200;
const GROUP_ORDER: SearchResultGroup[] = ['games', 'culture', 'places', 'materials'];
// A small, honest "suggested" set - games already flagged `featured` in
// their real catalog data, plus the 4 interactive experiences - never a
// fabricated popularity ranking (no real search-analytics exist to base
// one on).
const SUGGESTED_GAME_IDS = mockGamesList.filter((game) => game.featured).map((game) => game.id);

export function SearchScreen({ onPressBack, onPressResult }: SearchScreenProps) {
  const { t, i18n } = useTranslation();
  const language = i18n.language as SupportedLanguage;
  const insets = useSafeAreaInsets();

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

  const catalog = useMemo<CatalogItem[]>(
    () => [
      ...buildGameCatalog(mockGamesList, t),
      ...buildCultureCategoryCatalog(categories ?? []),
      ...buildCultureItemCatalog(items ?? [], categories ?? []),
      ...buildCultureMaterialCatalog(materials ?? []),
      ...buildExploreCatalog(regions ?? [], language),
      ...buildInteractiveExperienceCatalog(t),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [categories, materials, items, regions, language],
  );

  const suggested = useMemo(
    () => catalog.filter((item) => (item.contentType === 'game' && SUGGESTED_GAME_IDS.includes(item.id)) || item.contentType === 'interactive_experience'),
    [catalog],
  );

  const results = useMemo(() => searchCatalog(catalog, debouncedQuery), [catalog, debouncedQuery]);
  const grouped = useMemo(() => groupSearchResults(results), [results]);
  const isTyping = debouncedQuery.trim().length > 0;
  const hasResults = results.length > 0;

  const handlePressResult = (item: CatalogItem) => {
    if (!item.route) return;
    const next = addRecentSearch(recentSearches, query);
    setRecentSearches(next);
    void saveRecentSearches(next);
    onPressResult(item.route);
  };

  const handleClearRecent = () => {
    setRecentSearches([]);
    void clearRecentSearches();
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top + spacing.sm }]}>
      <View style={styles.header}>
        <IconButton icon={ChevronLeft} shape="roundedSquare" accessibilityLabel={t('common.back')} onPress={onPressBack} />
        <View style={styles.field}>
          <SearchIcon size={16} color={colors.textSecondary} strokeWidth={2} />
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
            <AnimatedPressable onPress={() => setQuery('')} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('search.clearLabel')}>
              <X size={16} color={colors.textMuted} strokeWidth={2.25} />
            </AnimatedPressable>
          ) : null}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {!isTyping ? (
          <>
            {recentSearches.length > 0 ? (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>{t('search.recentTitle')}</Text>
                  <TextButton label={t('search.clearRecent')} onPress={handleClearRecent} />
                </View>
                <View style={styles.chipsRow}>
                  {recentSearches.map((entry) => (
                    <AnimatedPressable key={entry} style={styles.chip} onPress={() => setQuery(entry)} accessibilityRole="button" accessibilityLabel={entry}>
                      <Text style={styles.chipLabel}>{entry}</Text>
                    </AnimatedPressable>
                  ))}
                </View>
              </View>
            ) : null}

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('search.suggestedTitle')}</Text>
              <View style={styles.resultsList}>
                {suggested.map((item) => (
                  <SearchResultRow key={`${item.contentType}:${item.id}`} item={item} categoryLabel={t(`search.groups.culture`)} onPress={() => handlePressResult(item)} />
                ))}
              </View>
            </View>

            {recentSearches.length === 0 ? (
              <EmptyState icon={SearchIcon} title={t('search.emptyTitle')} description={t('search.emptyDescription')} compact />
            ) : null}
          </>
        ) : hasResults ? (
          GROUP_ORDER.map((group) =>
            grouped[group].length > 0 ? (
              <View key={group} style={styles.section}>
                <Text style={styles.sectionTitle}>{t(`search.groups.${group}`)}</Text>
                <View style={styles.resultsList}>
                  {grouped[group].map((item) => (
                    <SearchResultRow key={`${item.contentType}:${item.id}`} item={item} categoryLabel={t(`search.groups.${group}`)} onPress={() => handlePressResult(item)} />
                  ))}
                </View>
              </View>
            ) : null,
          )
        ) : (
          <EmptyState icon={SearchIcon} title={t('search.noResultsTitle')} description={t('search.noResultsDescription')} compact />
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  field: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    height: 48,
    borderRadius: radii.pill,
    borderWidth: 1.5,
    borderColor: colors.surfaceBorder,
    ...shadows.card,
  },
  input: {
    flex: 1,
    ...typography.body,
    color: colors.textPrimary,
  },
  content: {
    paddingHorizontal: spacing.md,
    gap: spacing.lg,
  },
  section: {
    gap: spacing.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    ...typography.h2,
    color: colors.textPrimary,
  },
  resultsList: {
    gap: spacing.xs,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  chip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceAlt,
  },
  chipLabel: {
    ...typography.small,
    color: colors.textPrimary,
    fontWeight: '700',
  },
});
