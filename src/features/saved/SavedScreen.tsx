import { ChevronLeft, Heart } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnimatedPressable, EmptyState, IconButton, Pill } from '@/components/ui';
import { mockGamesList } from '@/features/games/mockData';
import type { SupportedLanguage } from '@/i18n';
import {
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
import { useFavoritesStore, type FavoriteContentType } from '@/store/useFavoritesStore';
import { colors, spacing, typography } from '@/theme';

import { SavedItemCard } from './components/SavedItemCard';
import { filterSavedItems, resolveSavedItems, type SavedFilter } from './savedFilters';

type SavedScreenProps = {
  onPressBack: () => void;
  onPressItem: (route: string) => void;
};

const FILTERS: SavedFilter[] = ['all', 'games', 'culture', 'places'];

export function SavedScreen({ onPressBack, onPressItem }: SavedScreenProps) {
  const { t, i18n } = useTranslation();
  const language = i18n.language as SupportedLanguage;
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState<SavedFilter>('all');

  const favoriteIds = useFavoritesStore((state) => state.favoriteIds);
  const toggleFavorite = useFavoritesStore((state) => state.toggleFavorite);

  const { data: categories } = useCultureCategories();
  const { data: materials } = useCultureMaterials();
  const { data: items } = useAllCultureItems();
  const { data: regions } = useExploreRegions();

  const catalog = useMemo<CatalogItem[]>(
    () => [
      ...buildGameCatalog(mockGamesList, t),
      ...buildCultureItemCatalog(items ?? [], categories ?? []),
      ...buildCultureMaterialCatalog(materials ?? []),
      ...buildExploreCatalog(regions ?? [], language),
      ...buildInteractiveExperienceCatalog(t),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [categories, materials, items, regions, language],
  );

  const savedItems = useMemo(() => resolveSavedItems(favoriteIds, catalog), [favoriteIds, catalog]);
  const visibleItems = useMemo(() => filterSavedItems(savedItems, filter), [savedItems, filter]);

  const rows: CatalogItem[][] = [];
  for (let i = 0; i < visibleItems.length; i += 2) {
    rows.push(visibleItems.slice(i, i + 2));
  }

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <IconButton icon={ChevronLeft} shape="roundedSquare" accessibilityLabel={t('common.back')} onPress={onPressBack} />
        <Text style={styles.title}>{t('saved.title')}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.filterRow}>
        {FILTERS.map((option) => (
          <AnimatedPressable
            key={option}
            onPress={() => setFilter(option)}
            haptic="light"
            accessibilityRole="button"
            accessibilityLabel={t(`saved.filters.${option}`)}
          >
            <Pill label={t(`saved.filters.${option}`)} tone={filter === option ? 'primary' : 'surface'} />
          </AnimatedPressable>
        ))}
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]} showsVerticalScrollIndicator={false}>
        {savedItems.length === 0 ? (
          <EmptyState icon={Heart} title={t('saved.emptyTitle')} description={t('saved.emptyDescription')} />
        ) : visibleItems.length === 0 ? (
          <EmptyState icon={Heart} title={t('saved.emptyFilterTitle')} description={t('saved.emptyFilterDescription')} compact />
        ) : (
          rows.map((row, rowIndex) => (
            <View key={rowIndex} style={styles.row}>
              {row.map((item) => (
                <SavedItemCard
                  key={`${item.contentType}:${item.id}`}
                  item={item}
                  onPress={() => item.route && onPressItem(item.route)}
                  onPressRemove={() => void toggleFavorite(item.contentType as FavoriteContentType, item.id)}
                />
              ))}
              {row.length === 1 ? <View style={styles.rowFiller} /> : null}
            </View>
          ))
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
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  headerSpacer: {
    width: 40,
  },
  title: {
    ...typography.h1,
    color: colors.textPrimary,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  content: {
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  rowFiller: {
    flex: 1,
  },
});
