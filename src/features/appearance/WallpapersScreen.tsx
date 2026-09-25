import { router } from 'expo-router';
import { ChevronLeft, Heart } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnimatedPressable, Chip, EmptyState, IconButton, MediaImage } from '@/components/ui';
import { useTrackScreenView } from '@/services/analytics/useTrackScreenView';
import { useWallpaperFavoritesStore } from '@/store/useWallpaperFavoritesStore';
import { cardRadii, colors, editorial, fontFamily, spacing, textStyles, typography } from '@/theme';

import { WALLPAPER_CATEGORIES, wallpapers, type WallpaperCategory } from './wallpapers';

type Filter = 'all' | 'favorites' | WallpaperCategory;

/** Phone-screen proportion for the preview cards (≈ 9 : 19.5). */
const PHONE_ASPECT = 9 / 19.5;

export function WallpapersScreen({ onPressBack }: { onPressBack: () => void }) {
  useTrackScreenView('appearance_wallpapers');
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [filter, setFilter] = useState<Filter>('all');
  const favoriteIds = useWallpaperFavoritesStore((state) => state.ids);

  useEffect(() => {
    if (!useWallpaperFavoritesStore.getState().isLoaded) void useWallpaperFavoritesStore.getState().load();
  }, []);

  const filters: Filter[] = ['all', 'favorites', ...WALLPAPER_CATEGORIES];
  const visible = wallpapers.filter((wallpaper) => (filter === 'all' ? true : filter === 'favorites' ? favoriteIds.includes(wallpaper.id) : wallpaper.category === filter));
  // Two columns on every phone width; the gap and gutters are fixed so the
  // cards stay tall and even at 375, 390 and 430.
  const cardWidth = Math.floor((Math.min(width, 520) - spacing.md * 2 - spacing.sm) / 2);
  const featured = wallpapers.find((wallpaper) => wallpaper.featured && wallpaper.portrait) ?? wallpapers[0];
  const heroHeight = Math.min(250, Math.round(width * 0.58));

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <IconButton icon={ChevronLeft} size={40} iconSize={20} shape="roundedSquare" elevated={false} accessibilityLabel={t('common.back')} onPress={onPressBack} />
        <Text style={styles.title}>{t('appearance.wallpapers.title')}</Text>
      </View>

      <ScrollView contentContainerStyle={[styles.page, { paddingBottom: insets.bottom + spacing.xl }]} showsVerticalScrollIndicator={false}>
        {/* Featured: one large real wallpaper, only in the "All" view. */}
        {filter === 'all' && featured ? (
          <AnimatedPressable
            style={styles.hero}
            onPress={() => router.push(`/appearance/wallpapers/${featured.id}` as never)}
            press="soft"
            accessibilityRole="button"
            accessibilityLabel={`${t('appearance.v2.featured')}: ${t(featured.titleKey)}`}
          >
            <View style={[styles.heroPhone, { width: Math.round(heroHeight * PHONE_ASPECT), height: heroHeight }]}>
              <MediaImage source={featured.image} />
            </View>
            <View style={styles.heroText}>
              <Text style={styles.heroEyebrow}>{t('appearance.v2.featured')}</Text>
              <Text style={styles.heroTitle}>{t(featured.titleKey)}</Text>
              <Text style={styles.heroHow}>{t('appearance.v2.howTo')}</Text>
              <Text style={styles.heroLink}>{t('appearance.wallpapers.save')} ›</Text>
            </View>
          </AnimatedPressable>
        ) : null}

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters} style={styles.filtersBleed}>
          {filters.map((option) => (
            <Chip key={option} label={t(`appearance.wallpapers.filters.${option}`)} selected={filter === option} onPress={() => setFilter(option)} accessibilityRole="tab" />
          ))}
        </ScrollView>

        <View style={styles.grid}>
          {visible.length === 0 ? (
            <View style={styles.empty}>
              <EmptyState icon={Heart} title={t('appearance.wallpapers.noFavoritesTitle')} description={t('appearance.wallpapers.noFavoritesDescription')} compact />
            </View>
          ) : (
            visible.filter((wallpaper) => !(filter === 'all' && wallpaper.id === featured?.id)).map((wallpaper) => {
              const favorite = favoriteIds.includes(wallpaper.id);
              const name = t(wallpaper.titleKey);
              return (
                <AnimatedPressable
                  key={wallpaper.id}
                  style={[styles.phone, { width: cardWidth, height: Math.round(cardWidth / PHONE_ASPECT) }]}
                  onPress={() => router.push(`/appearance/wallpapers/${wallpaper.id}` as never)}
                  press="soft"
                  accessibilityRole="button"
                  accessibilityLabel={`${t('appearance.wallpapers.a11yCard', { name, category: t(`appearance.wallpapers.filters.${wallpaper.category}`) })}${favorite ? `. ${t('appearance.wallpapers.filters.favorites')}` : ''}`}
                >
                  {/* expo-image decodes at card size (not full resolution) and caches. */}
                  <MediaImage source={wallpaper.image} />
                  {favorite ? (
                    <View style={styles.favoriteBadge}>
                      <Heart size={12} color={colors.textOnDark} fill={colors.textOnDark} strokeWidth={2} />
                    </View>
                  ) : null}
                  <View style={styles.nameTag}>
                    <Text style={styles.name} numberOfLines={1}>
                      {name}
                    </Text>
                  </View>
                </AnimatedPressable>
              );
            })
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  title: { ...typography.h1, fontFamily: fontFamily.wordmark, color: colors.textPrimary, flex: 1 },
  page: { gap: spacing.md },
  hero: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginHorizontal: spacing.md, padding: spacing.sm, borderRadius: cardRadii.media, backgroundColor: colors.surfaceFeature },
  heroPhone: { borderRadius: 18, overflow: 'hidden', borderWidth: 3, borderColor: 'rgba(251,243,227,0.9)' },
  heroText: { flex: 1, gap: 4, paddingRight: spacing.xs },
  heroEyebrow: { ...textStyles.overline, color: colors.accentGold },
  heroTitle: { ...editorial(textStyles.h2), color: colors.textOnDark },
  heroHow: { ...textStyles.caption, color: colors.textOnDarkSecondary },
  heroLink: { ...textStyles.caption, fontWeight: '700', color: colors.accentGold, marginTop: spacing.xs },
  filtersBleed: { flexGrow: 0 },
  filters: { paddingHorizontal: spacing.md, gap: spacing.xs, alignItems: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, paddingHorizontal: spacing.md },
  empty: { width: '100%' },
  phone: { borderRadius: 24, overflow: 'hidden', backgroundColor: colors.surfaceAlt, borderWidth: 3, borderColor: colors.surface },
  favoriteBadge: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(19,32,24,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // A small label strip below the photo edge - kept off the artwork so the
  // wallpaper itself stays text-free.
  nameTag: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingVertical: 6, paddingHorizontal: spacing.sm, backgroundColor: 'rgba(19,32,24,0.55)' },
  name: { ...typography.small, color: colors.textOnDark, textAlign: 'center' },
});
