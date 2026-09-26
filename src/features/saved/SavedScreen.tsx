import { ChevronRight, CloudDownload, Heart } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LibraryEmptyState, LibraryFilterChips, LibraryHeader } from '@/components/library/LibraryChrome';
import { offlineKindFor } from '@/components/library/contentTypeMeta';
import { AnimatedPressable, Button, FadeSlideIn, Rail, SectionHeader, useRailItemWidth } from '@/components/ui';
import { mockGamesList } from '@/features/games/mockData';
import { buildRecentlyExplored } from '@/features/home/homeRecommendation';
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
import { useDailyDiscoveryStore } from '@/store/useDailyDiscoveryStore';
import { useFavoritesStore, type FavoriteContentType } from '@/store/useFavoritesStore';
import { useProgressStore } from '@/store/useProgressStore';
import { cardRadii, colors, spacing, textStyles } from '@/theme';

import { SavedContentCard } from './SavedContentCard';
import { buildSavedView, savedFilterOptions, visibleSections, type SavedEntry, type SavedFilter } from './savedModel';
import { toggleFavoriteWithFeedback } from './toggleFavoriteWithFeedback';

type SavedScreenProps = {
  onPressBack: () => void;
  onPressItem: (route: string) => void;
};

/**
 * Saved - the user's own OYNO library, over the ONE favorites store:
 *   header     "Your OYNO" / Saved + one line
 *   summary    real saved count, real "available offline" count, a link
 *              to the Offline manager (downloads are managed there only)
 *   Continue   saved items the user also explored recently (real dates)
 *   sections   Places / Culture / Games - only those with content
 * Removing is instant (local-first store, unchanged sync path) and only
 * un-saves: progress and offline copies are never touched.
 */
export function SavedScreen({ onPressBack, onPressItem }: SavedScreenProps) {
  const { t, i18n } = useTranslation();
  const language = i18n.language as SupportedLanguage;
  const insets = useSafeAreaInsets();
  const { experience } = useAgeExperience();
  const [filter, setFilter] = useState<SavedFilter>('all');
  const railWidth = useRailItemWidth('compact', experience === 'child' ? 0.6 : 0.5);

  const favoriteIds = useFavoritesStore((state) => state.favoriteIds);
  const offlineEntries = useOfflineStore((state) => state.manifest.entries);
  const regionVisitDates = useProgressStore((state) => state.regionVisitDates);
  const dailyCompletions = useDailyDiscoveryStore((state) => state.completions);

  const { data: categories } = useCultureCategories();
  const { data: materials } = useCultureMaterials();
  const { data: items } = useAllCultureItems();
  const { data: regions } = useExploreRegions();

  const catalog = useMemo<CatalogItem[]>(
    () => [
      ...buildExploreCatalog(regions ?? [], language),
      ...buildCultureItemCatalog(items ?? [], categories ?? [], language),
      ...buildInteractiveExperienceCatalog(t),
      ...buildCultureMaterialCatalog(materials ?? []),
      ...buildGameCatalog(mockGamesList, t),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [categories, materials, items, regions, language],
  );

  const view = useMemo(
    () =>
      buildSavedView({
        favoriteIds,
        catalog,
        isOffline: (item) => {
          const kind = offlineKindFor(item.contentType);
          return !!kind && !!offlineEntries[downloadId(kind, item.id)];
        },
        recent: buildRecentlyExplored(regionVisitDates, dailyCompletions, 20),
      }),
    [favoriteIds, catalog, offlineEntries, regionVisitDates, dailyCompletions],
  );

  const filters = experience === 'child' ? [] : savedFilterOptions(view);
  const activeFilter = filters.includes(filter) ? filter : 'all';
  const sections = visibleSections(view, activeFilter);
  const useTiles = experience === 'preteen';

  const open = (entry: SavedEntry) => entry.item.route && onPressItem(entry.item.route);
  const remove = (entry: SavedEntry) => void toggleFavoriteWithFeedback(entry.item.contentType as FavoriteContentType, entry.item.id);

  const card = (entry: SavedEntry, layout: 'row' | 'tile') => (
    <SavedContentCard key={entry.key} item={entry.item} offline={entry.offline} experience={experience} layout={layout} onOpen={() => open(entry)} onRemove={() => remove(entry)} />
  );

  return (
    <View style={styles.root}>
      <LibraryHeader title={t('saved.title')} subtitle={t('saved.v2.subtitle')} onPressBack={onPressBack}>
        {filters.length > 0 ? <LibraryFilterChips options={filters} value={activeFilter} label={(option) => t(option === 'all' ? 'saved.filters.all' : `saved.v2.sections.${option}`)} onChange={setFilter} /> : null}
      </LibraryHeader>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]} showsVerticalScrollIndicator={false}>
        {view.total === 0 ? (
          <LibraryEmptyState icon={Heart} tone={colors.accentTerracotta} title={t('saved.emptyTitle')} description={t('saved.v2.emptyBody')}>
            <Button label={t('saved.v2.explore')} variant="primary" onPress={() => onPressItem('/explore')} />
          </LibraryEmptyState>
        ) : (
          <>
            {/* Real counts only; downloads are managed in Offline. */}
            <View style={styles.summary}>
              <View style={styles.summaryText} accessible accessibilityLabel={[t('saved.v2.count', { count: view.total }), view.offlineCount > 0 ? t('saved.v2.offlineCount', { count: view.offlineCount }) : null].filter(Boolean).join('. ')}>
                <Text style={styles.summaryTitle}>{t('saved.v2.count', { count: view.total })}</Text>
                {view.offlineCount > 0 ? <Text style={styles.summaryMeta}>{t('saved.v2.offlineCount', { count: view.offlineCount })}</Text> : null}
              </View>
              <AnimatedPressable style={styles.downloads} onPress={() => onPressItem('/offline')} press="soft" accessibilityRole="button" accessibilityLabel={t('offline.library.title')}>
                <CloudDownload size={15} color={colors.primary} strokeWidth={2.25} />
                <Text style={styles.downloadsText} numberOfLines={1}>
                  {t('saved.v2.downloads')}
                </Text>
                <ChevronRight size={14} color={colors.textMuted} strokeWidth={2.25} />
              </AnimatedPressable>
            </View>

            {activeFilter === 'all' && view.continueExploring.length > 0 ? (
              <View style={styles.section}>
                <SectionHeader title={t('saved.v2.continueTitle')} size="sm" inset={0} />
                <Text style={styles.sectionHint}>{t('saved.v2.continueHint')}</Text>
                <Rail itemWidth={railWidth} style={styles.bleed}>
                  {view.continueExploring.map((entry) => (
                    <View key={entry.key} style={{ width: railWidth }}>
                      {card(entry, 'tile')}
                    </View>
                  ))}
                </Rail>
              </View>
            ) : null}

            {sections.map((section, index) => (
              <FadeSlideIn key={`${activeFilter}:${section.id}`} index={index} style={styles.section}>
                <SectionHeader title={t(`saved.v2.sections.${section.id}`)} count={section.entries.length} size="sm" inset={0} />
                {useTiles ? (
                  <View style={styles.grid}>
                    {section.entries.map((entry) => (
                      <View key={entry.key} style={styles.gridCell}>
                        {card(entry, 'tile')}
                      </View>
                    ))}
                  </View>
                ) : (
                  <View style={styles.list}>{section.entries.map((entry) => card(entry, 'row'))}</View>
                )}
              </FadeSlideIn>
            ))}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: spacing.md, gap: spacing.lg, paddingTop: spacing.xs },
  summary: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceMuted },
  summaryText: { flex: 1, gap: 2 },
  summaryTitle: { ...textStyles.title, color: colors.textPrimary },
  summaryMeta: { ...textStyles.caption, color: colors.textSecondary },
  downloads: { flexDirection: 'row', alignItems: 'center', gap: 5, minHeight: 44, paddingHorizontal: spacing.sm, borderRadius: cardRadii.chip, backgroundColor: colors.surfaceElevated, maxWidth: '55%' },
  downloadsText: { ...textStyles.small, fontWeight: '700', color: colors.primary, flexShrink: 1 },
  section: { gap: spacing.sm },
  sectionHint: { ...textStyles.caption, color: colors.textMuted, marginTop: -spacing.xs },
  bleed: { marginHorizontal: -spacing.md },
  list: { gap: spacing.xs },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: spacing.md },
  gridCell: { width: '48%' },
});
