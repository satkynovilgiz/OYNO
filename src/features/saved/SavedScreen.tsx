import { ArrowDownToLine, ChevronRight, Compass, Heart } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LibraryEmptyState, LibraryFilterChips, LibraryHeader, LibrarySectionHeader } from '@/components/library/LibraryChrome';
import { LibraryContentCard, LibraryContentRow } from '@/components/library/LibraryContentRow';
import { offlineKindFor } from '@/components/library/contentTypeMeta';
import { AnimatedPressable, FadeSlideIn } from '@/components/ui';
import { mockGamesList } from '@/features/games/mockData';
import type { SupportedLanguage } from '@/i18n';
import { useAgeExperience } from '@/services/ageExperience/useAgeExperience';
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
import { downloadId } from '@/services/offline/offlineManifest';
import { useOfflineStore } from '@/services/offline/useOfflineStore';
import { useFavoritesStore, type FavoriteContentType } from '@/store/useFavoritesStore';
import { colors, radii, spacing, typography } from '@/theme';

import { filterSavedItems, resolveSavedItems, type SavedFilter } from './savedFilters';

type SavedScreenProps = {
  onPressBack: () => void;
  onPressItem: (route: string) => void;
};

const FILTERS: SavedFilter[] = ['all', 'games', 'culture', 'places'];

/**
 * Saved - "Your OYNO" personal collection: everything the user chose to
 * keep, newest first, from the one Favorites model. Filters are exactly
 * the categories that model supports. Offline Downloads is a separate
 * library (linked here, never mixed into Favorites).
 */
export function SavedScreen({ onPressBack, onPressItem }: SavedScreenProps) {
  const { t, i18n } = useTranslation();
  const language = i18n.language as SupportedLanguage;
  const insets = useSafeAreaInsets();
  const { experience } = useAgeExperience();
  const [filter, setFilter] = useState<SavedFilter>('all');

  const favoriteIds = useFavoritesStore((state) => state.favoriteIds);
  const offlineEntries = useOfflineStore((state) => state.manifest.entries);
  const offlineCount = Object.keys(offlineEntries).length;
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
  const isOffline = (item: CatalogItem) => {
    const kind = offlineKindFor(item.contentType);
    return !!kind && !!offlineEntries[downloadId(kind, item.id)];
  };
  const open = (item: CatalogItem) => item.route && onPressItem(item.route);
  const unsave = (item: CatalogItem) => void toggleFavorite(item.contentType as FavoriteContentType, item.id);

  return (
    <View style={styles.root}>
      <LibraryHeader title={t('saved.title')} subtitle={t('library.savedSubtitle')} onPressBack={onPressBack}>
        {savedItems.length > 0 && experience !== 'child' ? (
          <LibraryFilterChips options={FILTERS} value={filter} label={(option) => t(`saved.filters.${option}`)} onChange={setFilter} />
        ) : null}
      </LibraryHeader>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]} showsVerticalScrollIndicator={false}>
        <AnimatedPressable style={styles.offlineEntry} onPress={() => onPressItem('/offline')} hoverEffect accessibilityRole="button" accessibilityLabel={`${t('offline.library.title')}${offlineCount ? `, ${offlineCount}` : ''}`}>
          <View style={styles.offlineIcon}>
            <ArrowDownToLine size={16} color={colors.primary} strokeWidth={2.25} />
          </View>
          <Text style={styles.offlineText}>{t('offline.library.title')}</Text>
          {offlineCount > 0 ? <Text style={styles.offlineCount}>{offlineCount}</Text> : null}
          <ChevronRight size={16} color={colors.textMuted} strokeWidth={2} />
        </AnimatedPressable>

        {savedItems.length === 0 ? (
          <LibraryEmptyState icon={Heart} tone={colors.accentTerracotta} title={t('saved.emptyTitle')} description={t('saved.emptyDescription')}>
            <AnimatedPressable style={styles.cta} onPress={() => onPressItem('/explore')} accessibilityRole="button" accessibilityLabel={t('library.browse.places')}>
              <Compass size={14} color={colors.primary} strokeWidth={2.25} />
              <Text style={styles.ctaText}>{t('library.browse.places')}</Text>
            </AnimatedPressable>
          </LibraryEmptyState>
        ) : visibleItems.length === 0 ? (
          <LibraryEmptyState icon={Heart} tone={colors.accentTerracotta} title={t('saved.emptyFilterTitle')} description={t('saved.emptyFilterDescription')} />
        ) : (
          <FadeSlideIn key={filter} style={styles.section}>
            <LibrarySectionHeader title={t(`saved.filters.${filter}`)} count={visibleItems.length} />
            {experience === 'preteen' ? (
              <View style={styles.grid}>
                {visibleItems.map((item) => (
                  <View key={`${item.contentType}:${item.id}`} style={styles.gridCell}>
                    <LibraryContentCard item={{ ...item, subtitle: item.metadata }} saved offline={isOffline(item)} onPress={() => open(item)} />
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.list}>
                {visibleItems.map((item) => (
                  <LibraryContentRow
                    key={`${item.contentType}:${item.id}`}
                    item={{ ...item, subtitle: item.metadata }}
                    experience={experience}
                    offline={isOffline(item)}
                    onPress={() => open(item)}
                    trailing={
                      <AnimatedPressable style={styles.unsave} onPress={() => unsave(item)} haptic="light" accessibilityRole="button" accessibilityLabel={`${t('saved.removeLabel')}: ${item.title}`}>
                        <Heart size={18} color={colors.accentTerracotta} fill={colors.accentTerracotta} strokeWidth={0} />
                      </AnimatedPressable>
                    }
                  />
                ))}
              </View>
            )}
          </FadeSlideIn>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: spacing.md, gap: spacing.md, paddingTop: spacing.xs },
  section: { gap: spacing.sm },
  list: { gap: spacing.xxs },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: spacing.md },
  gridCell: { width: '48%' },
  offlineEntry: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm, borderRadius: radii.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.surfaceBorder },
  offlineIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceAlt },
  offlineText: { ...typography.bodyBold, color: colors.textPrimary, flex: 1 },
  offlineCount: { ...typography.caption, fontWeight: '700', color: colors.textSecondary },
  unsave: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  cta: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 40, paddingHorizontal: spacing.md, borderRadius: radii.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.surfaceBorder },
  ctaText: { ...typography.caption, fontWeight: '700', color: colors.primary },
});
