import { router } from 'expo-router';
import { ChevronLeft, ChevronRight, Heart, Share2, X } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, Image, Modal, Pressable, ScrollView, StyleSheet, Text, View, type ImageSourcePropType } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { KyrgyzOnlyNote } from '@/components/content/KyrgyzOnlyNote';
import { SourcesAndNotes } from '@/components/content/SourcesAndNotes';
import { OfflineUnavailable } from '@/components/offline/OfflineUnavailable';
import { AnimatedPressable, Button, IconButton, MediaImage } from '@/components/ui';
import { cultureItemImages, cultureMaterialImages } from '@/features/culture/data';
import { AddToCollectionButton } from '@/features/myCollections/AddToCollection';
import { toggleFavoriteWithFeedback } from '@/features/saved/toggleFavoriteWithFeedback';
import { useAgeExperience } from '@/services/ageExperience/useAgeExperience';
import { track } from '@/services/analytics/analytics';
import type { SupportedLanguage } from '@/i18n';
import { cultureCategoryTitle } from '@/services/content/cultureCategoryTitles';
import { useAllCultureItems } from '@/services/content/cultureItemsService';
import { useCultureCategories, useCultureMaterials } from '@/services/content/cultureService';
import { useReducedMotion } from '@/services/motion/useReducedMotion';
import { isWaitingForNetwork } from '@/services/offline/offlineManifest';
import { useNetworkStatus } from '@/services/offline/networkStatus';
import { useShareCard } from '@/services/share/useShareCard';
import { favoriteKey, useFavoritesStore } from '@/store/useFavoritesStore';
import { cardRadii, colors, editorial, radii, spacing, textStyles, typography } from '@/theme';

import { buildGallery, filterGallery, GALLERY_PRESENTATION, galleryFilters, MATERIALS_FILTER, neighbour, tileAspect, type GalleryEntry } from './galleryModel';

function aspectOf(source: ImageSourcePropType): number {
  // Bundled assets report their real size; remote images use a calm default.
  if (typeof source === 'number') {
    const asset = Image.resolveAssetSource(source);
    return tileAspect(asset?.width, asset?.height);
  }
  return tileAspect(undefined, undefined);
}

/**
 * /culture/gallery - Explore by image: a virtualized image-first grid of
 * existing culture items/materials that have real images; tap -> a focused
 * preview (larger image, title, category, a short EXISTING authored text,
 * verification, Save, Add to collection, Share, Open story); tap the image
 * -> fullscreen with previous/next in the current filtered order.
 */
export function CultureGalleryScreen({ onPressBack }: { onPressBack: () => void }) {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const { experience } = useAgeExperience();
  const presentation = GALLERY_PRESENTATION[experience];
  const { isOffline } = useNetworkStatus();
  const itemsQuery = useAllCultureItems();
  const materialsQuery = useCultureMaterials();
  const { data: categories } = useCultureCategories();
  const [filter, setFilter] = useState('all');
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    track('culture_gallery_opened');
  }, []);

  const entries = useMemo(
    () => buildGallery({ items: itemsQuery.data, materials: materialsQuery.data, categories, itemImages: cultureItemImages, materialImages: cultureMaterialImages, language: i18n.language, offline: isOffline }),
    [itemsQuery.data, materialsQuery.data, categories, i18n.language, isOffline],
  );
  const filters = useMemo(() => galleryFilters(entries, categories), [entries, categories]);
  const activeFilter = filter === 'all' || filters.some((entry) => entry.id === filter) ? filter : 'all';
  const shown = useMemo(() => filterGallery(entries, activeFilter), [entries, activeFilter]);
  // Category names localized the same way the Culture screen does it.
  const categoryName = (id: string) => {
    const row = categories?.find((category) => category.id === id);
    return row ? cultureCategoryTitle(row, i18n.language as SupportedLanguage) : id;
  };
  const categoryTitle = (entry: GalleryEntry) => (entry.categoryId ? categoryName(entry.categoryId) : t('library.types.material'));
  const selected = previewIndex !== null ? (shown[previewIndex] ?? null) : null;

  if (isWaitingForNetwork(itemsQuery)) return <OfflineUnavailable onRetry={() => void itemsQuery.refetch()} />;

  const open = (index: number) => {
    const entry = shown[index];
    track('culture_gallery_item_opened', { content_type: entry.contentType, content_id: entry.contentId, category_id: entry.categoryId ?? MATERIALS_FILTER });
    setPreviewIndex(index);
  };

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <IconButton icon={ChevronLeft} shape="roundedSquare" accessibilityLabel={t('common.back')} onPress={onPressBack} />
        <Text style={[styles.title, presentation.editorial && styles.titleEditorial]} accessibilityRole="header" numberOfLines={1}>
          {t('cultureGallery.title')}
        </Text>
      </View>

      <FlatList
        key={presentation.columns}
        data={shown}
        numColumns={presentation.columns}
        keyExtractor={(entry) => entry.key}
        initialNumToRender={6}
        maxToRenderPerBatch={6}
        windowSize={5}
        removeClippedSubviews
        columnWrapperStyle={presentation.columns > 1 ? styles.columns : undefined}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}
        ListHeaderComponent={
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters} accessibilityRole="radiogroup">
            {[{ id: 'all', count: entries.length }, ...filters].map((option) => {
              const selectedFilter = activeFilter === option.id;
              const label = option.id === 'all' ? t('cultureGallery.all') : option.id === MATERIALS_FILTER ? t('library.types.material') : categoryName(option.id);
              return (
                <AnimatedPressable
                  key={option.id}
                  style={[styles.chip, selectedFilter && styles.chipOn]}
                  onPress={() => setFilter(option.id)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selectedFilter }}
                  aria-checked={selectedFilter}
                  accessibilityLabel={`${label}, ${option.count}`}
                >
                  <Text style={[styles.chipText, selectedFilter && styles.chipTextOn]}>
                    {label} {option.count}
                  </Text>
                </AnimatedPressable>
              );
            })}
          </ScrollView>
        }
        ListEmptyComponent={itemsQuery.isLoading ? null : <Text style={styles.empty}>{t('cultureGallery.emptyCategory')}</Text>}
        renderItem={({ item: entry, index }) => (
          <AnimatedPressable
            style={[styles.tile, presentation.columns > 1 && styles.tileHalf]}
            onPress={() => open(index)}
            press="soft"
            accessibilityRole="button"
            accessibilityLabel={`${entry.title}. ${categoryTitle(entry)}. ${t('cultureGallery.openPreview')}`}
          >
            <View style={[styles.tileImage, { aspectRatio: aspectOf(entry.image) }]}>
              <MediaImage source={entry.image} />
            </View>
            <Text style={[styles.tileTitle, presentation.editorial && styles.tileTitleEditorial, experience === 'child' && styles.tileTitleChild]} numberOfLines={2}>
              {entry.title}
            </Text>
            {presentation.showCategory ? <Text style={styles.tileMeta}>{categoryTitle(entry)}</Text> : null}
          </AnimatedPressable>
        )}
      />

      {selected && previewIndex !== null ? (
        <GalleryPreview
          entry={selected}
          category={categoryTitle(selected)}
          language={i18n.language}
          onClose={() => {
            setFullscreen(false);
            setPreviewIndex(null);
          }}
          onOpenImage={() => setFullscreen(true)}
          fullscreen={
            fullscreen ? (
              <GalleryFullscreen
                entry={selected}
                category={categoryTitle(selected)}
                hasPrevious={neighbour(shown.length, previewIndex, -1) !== null}
                hasNext={neighbour(shown.length, previewIndex, 1) !== null}
                onPrevious={() => setPreviewIndex(neighbour(shown.length, previewIndex, -1) ?? previewIndex)}
                onNext={() => setPreviewIndex(neighbour(shown.length, previewIndex, 1) ?? previewIndex)}
                onClose={() => setFullscreen(false)}
              />
            ) : null
          }
        />
      ) : null}
    </View>
  );
}

function GalleryPreview({
  entry,
  category,
  language,
  onClose,
  onOpenImage,
  fullscreen,
}: {
  entry: GalleryEntry;
  category: string;
  language: string;
  onClose: () => void;
  onOpenImage: () => void;
  /** Rendered INSIDE this modal so it opens on top of it (iOS-safe). */
  fullscreen: React.ReactNode;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const { share, shareHost } = useShareCard();
  // Save = the existing Favorites (no gallery-specific store).
  const isSaved = useFavoritesStore((state) => state.favoriteIds.includes(favoriteKey(entry.contentType, entry.contentId)));
  return (
    <Modal visible transparent animationType={reducedMotion ? 'none' : 'slide'} onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityRole="button" accessibilityLabel={t('cultureGallery.close')} />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.md }]} accessibilityViewIsModal>
        <ScrollView contentContainerStyle={{ gap: spacing.sm }}>
          <AnimatedPressable onPress={onOpenImage} accessibilityRole="button" accessibilityLabel={`${entry.title}. ${t('cultureGallery.fullscreen')}`}>
            <View style={styles.previewImage}>
              <MediaImage source={entry.image} />
            </View>
          </AnimatedPressable>
          <Text style={styles.previewCategory}>{category}</Text>
          <Text style={styles.previewTitle} accessibilityRole="header">
            {entry.title}
          </Text>
          <KyrgyzOnlyNote status={entry.translationStatus} language={language} />
          {/* Existing authored text only - visually shortened, never rewritten. */}
          {entry.context ? (
            <Text style={styles.previewContext} numberOfLines={4}>
              {entry.context}
            </Text>
          ) : null}
          <SourcesAndNotes contentType={entry.contentType} level={entry.accuracy} sources={entry.sources} />
          <View style={styles.previewActions}>
            <IconButton
              icon={Heart}
              shape="roundedSquare"
              variant={isSaved ? 'primary' : 'surface'}
              accessibilityLabel={isSaved ? t('cultureGallery.saved') : t('cultureGallery.save')}
              onPress={() => void toggleFavoriteWithFeedback(entry.contentType, entry.contentId)}
            />
            <AddToCollectionButton contentType={entry.contentType} contentId={entry.contentId} title={entry.title} />
            <IconButton
              icon={Share2}
              shape="roundedSquare"
              accessibilityLabel={t('share.action')}
              onPress={() => void share({ title: entry.title, label: category, imageSource: entry.image, fallbackTone: colors.surfaceFeature }, entry.title)}
            />
          </View>
          <Button
            label={t('cultureGallery.openStory')}
            onPress={() => {
              onClose();
              router.push(entry.route as never);
            }}
          />
          <Button label={t('cultureGallery.close')} variant="secondary" onPress={onClose} />
        </ScrollView>
        {shareHost}
      </View>
      {fullscreen}
    </Modal>
  );
}

function GalleryFullscreen({ entry, category, hasPrevious, hasNext, onPrevious, onNext, onClose }: { entry: GalleryEntry; category: string; hasPrevious: boolean; hasNext: boolean; onPrevious: () => void; onNext: () => void; onClose: () => void }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  // Only the current image is mounted (no preloading of the whole gallery).
  return (
    <Modal visible animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.fullscreen}>
        <View style={StyleSheet.absoluteFill} accessible accessibilityRole="image" accessibilityLabel={entry.title}>
          <MediaImage source={entry.image} fill />
        </View>
        <View style={[styles.fullTop, { paddingTop: insets.top + spacing.sm }]}>
          <IconButton icon={X} shape="roundedSquare" accessibilityLabel={t('cultureGallery.close')} onPress={onClose} />
        </View>
        <View style={[styles.fullBottom, { paddingBottom: insets.bottom + spacing.md }]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.caption} numberOfLines={2}>
              {entry.title}
            </Text>
            <Text style={styles.captionMeta}>{category}</Text>
          </View>
          <IconButton icon={ChevronLeft} shape="roundedSquare" disabled={!hasPrevious} accessibilityLabel={t('cultureGallery.previous')} onPress={onPrevious} />
          <IconButton icon={ChevronRight} shape="roundedSquare" disabled={!hasNext} accessibilityLabel={t('cultureGallery.next')} onPress={onNext} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  title: { ...typography.h1, color: colors.textPrimary, flex: 1 },
  titleEditorial: { ...editorial(typography.h1) },
  content: { paddingHorizontal: spacing.md, gap: spacing.md },
  filters: { gap: spacing.xs, paddingBottom: spacing.sm },
  chip: { minHeight: 36, justifyContent: 'center', paddingHorizontal: spacing.sm, borderRadius: cardRadii.chip, backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.borderSubtle },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { ...textStyles.caption, fontWeight: '700', color: colors.textPrimary },
  chipTextOn: { color: colors.textOnDark },
  columns: { gap: spacing.sm, alignItems: 'flex-start' },
  tile: { gap: 4 },
  tileHalf: { flex: 1, maxWidth: '48.5%' },
  tileImage: { width: '100%', borderRadius: radii.lg, overflow: 'hidden', backgroundColor: colors.surfaceMuted },
  tileTitle: { ...textStyles.bodyMedium, fontWeight: '700', color: colors.textPrimary },
  tileTitleEditorial: { ...editorial(textStyles.bodyMedium) },
  tileTitleChild: { fontSize: 18 },
  tileMeta: { ...textStyles.small, color: colors.textSecondary },
  empty: { ...textStyles.body, color: colors.textSecondary, textAlign: 'center', paddingVertical: spacing.xl },
  backdrop: { flex: 1, backgroundColor: 'rgba(20,24,18,0.5)' },
  sheet: { maxHeight: '88%', padding: spacing.md, borderTopLeftRadius: radii.xl, borderTopRightRadius: radii.xl, backgroundColor: colors.background },
  previewImage: { width: '100%', aspectRatio: 1.3, borderRadius: radii.lg, overflow: 'hidden', backgroundColor: colors.surfaceMuted },
  previewCategory: { ...typography.overline, color: colors.accentTerracotta },
  previewTitle: { ...textStyles.h2, color: colors.textPrimary },
  previewContext: { ...textStyles.body, color: colors.textSecondary },
  previewActions: { flexDirection: 'row', gap: spacing.xs },
  fullscreen: { flex: 1, backgroundColor: '#000' },
  fullTop: { position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: spacing.md, alignItems: 'flex-end' },
  fullBottom: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.md, paddingTop: spacing.md, backgroundColor: 'rgba(0,0,0,0.45)' },
  caption: { ...textStyles.bodyMedium, fontWeight: '700', color: colors.textOnDark },
  captionMeta: { ...textStyles.small, color: 'rgba(255,255,255,0.75)' },
});
