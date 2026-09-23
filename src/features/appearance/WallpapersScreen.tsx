import { router } from 'expo-router';
import { ChevronLeft, Heart } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnimatedPressable, EmptyState, IconButton, Pill } from '@/components/ui';
import { useTrackScreenView } from '@/services/analytics/useTrackScreenView';
import { useWallpaperFavoritesStore } from '@/store/useWallpaperFavoritesStore';
import { colors, fontFamily, spacing, typography } from '@/theme';

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

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <IconButton icon={ChevronLeft} shape="roundedSquare" accessibilityLabel={t('common.back')} onPress={onPressBack} />
        <Text style={styles.title}>{t('appearance.wallpapers.title')}</Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters} style={styles.filtersScroll}>
        {filters.map((option) => (
          <AnimatedPressable
            key={option}
            onPress={() => setFilter(option)}
            haptic="light"
            accessibilityRole="button"
            accessibilityState={{ selected: filter === option }}
            accessibilityLabel={t(`appearance.wallpapers.filters.${option}`)}
          >
            <Pill label={t(`appearance.wallpapers.filters.${option}`)} tone={filter === option ? 'primary' : 'surface'} />
          </AnimatedPressable>
        ))}
      </ScrollView>

      <ScrollView contentContainerStyle={[styles.grid, { paddingBottom: insets.bottom + spacing.xl }]} showsVerticalScrollIndicator={false}>
        {visible.length === 0 ? (
          <View style={styles.empty}>
            <EmptyState icon={Heart} title={t('appearance.wallpapers.noFavoritesTitle')} description={t('appearance.wallpapers.noFavoritesDescription')} compact />
          </View>
        ) : (
          visible.map((wallpaper) => {
            const favorite = favoriteIds.includes(wallpaper.id);
            const name = t(wallpaper.titleKey);
            return (
              <AnimatedPressable
                key={wallpaper.id}
                style={[styles.phone, { width: cardWidth, height: Math.round(cardWidth / PHONE_ASPECT) }]}
                onPress={() => router.push(`/appearance/wallpapers/${wallpaper.id}` as never)}
                pressScale={0.97}
                hoverEffect
                accessibilityRole="button"
                accessibilityLabel={t('appearance.wallpapers.a11yCard', { name, category: t(`appearance.wallpapers.filters.${wallpaper.category}`) })}
              >
                <Image source={wallpaper.image} style={styles.phoneImage} resizeMode="cover" />
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
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  title: { ...typography.h1, fontFamily: fontFamily.wordmark, color: colors.textPrimary, flex: 1 },
  // Never let the chip row shrink under the grid below it.
  filtersScroll: { flexGrow: 0, flexShrink: 0 },
  filters: { paddingHorizontal: spacing.md, gap: spacing.xs, paddingBottom: spacing.md, alignItems: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, paddingHorizontal: spacing.md },
  empty: { width: '100%' },
  phone: { borderRadius: 24, overflow: 'hidden', backgroundColor: colors.surfaceAlt, borderWidth: 3, borderColor: colors.surface },
  phoneImage: { ...StyleSheet.absoluteFill, width: '100%', height: '100%' },
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
