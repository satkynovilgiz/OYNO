import { LinearGradient } from 'expo-linear-gradient';
import { ChevronRight } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Image, StyleSheet, Text, View } from 'react-native';

import { OymoOrnament } from '@/components/patterns/OymoOrnament';
import { AnimatedPressable, FadeSlideIn } from '@/components/ui';
import { GRADIENT_BY_ARTWORK_PROMINENCE } from '@/services/ageExperience/cardGradient';
import { resolveByCardScale } from '@/services/ageExperience/scale';
import { useAgeExperience } from '@/services/ageExperience/useAgeExperience';
import { colors, radii, shadows, spacing, typography } from '@/theme';

import type { CultureTile } from '../types';

type CultureGridProps = {
  tiles: CultureTile[];
  onPressTile?: (tile: CultureTile) => void;
};

const WIDTH_BY_CARD_SCALE = { large: '100%', medium: '47%', compact: '47%', dense: '31%' } as const;
const TITLE_FONT_SIZE_BY_CARD_SCALE = { large: 20, medium: 17, compact: 15, dense: 14 };

export function CultureGrid({ tiles, onPressTile }: CultureGridProps) {
  const { t } = useTranslation();
  const { config } = useAgeExperience();
  const gradient = GRADIENT_BY_ARTWORK_PROMINENCE[config.artworkProminence];

  return (
    <View style={styles.section}>
      {/* Previously had no heading at all, unlike GamesCarousel right above
       * it (Section "improve spacing and typography hierarchy") - the
       * оймо accent mirrors GamesHeader's own title-ornament pairing so
       * the same small motif reads consistently across the screen. */}
      <View style={styles.header}>
        <OymoOrnament size={16} color={colors.accentGold} strokeWidth={1.5} />
        <Text style={styles.sectionTitle}>{t('home.culture.sectionTitle')}</Text>
      </View>

      <View style={styles.grid}>
        {tiles.map((tile, index) => (
          <FadeSlideIn
            key={tile.id}
            style={{ width: resolveByCardScale(config.cardScale, WIDTH_BY_CARD_SCALE) }}
            index={index}
          >
            <AnimatedPressable
              style={styles.tile}
              onPress={() => onPressTile?.(tile)}
              hoverEffect
              accessibilityRole="button"
              accessibilityLabel={tile.title}
            >
              {tile.imageSource ? (
                <Image source={tile.imageSource} style={styles.artwork} resizeMode="cover" />
              ) : tile.imageUri ? (
                <Image source={{ uri: tile.imageUri }} style={styles.artwork} resizeMode="cover" />
              ) : (
                <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.tiles[tile.tone] }]} />
              )}

              <LinearGradient colors={gradient.colors} locations={gradient.locations} style={StyleSheet.absoluteFill} />

              <View style={styles.content}>
                <View style={styles.textBlock}>
                  <Text
                    style={[styles.title, { fontSize: resolveByCardScale(config.cardScale, TITLE_FONT_SIZE_BY_CARD_SCALE) }]}
                    numberOfLines={2}
                  >
                    {tile.title}
                  </Text>
                  <Text style={styles.subtitle} numberOfLines={1}>
                    {tile.subtitle}
                  </Text>
                </View>
                {/* Decorative only - the whole tile is already the tap target
                    (accessibilityRole/Label live on the outer AnimatedPressable
                    above), so this must not be its own Pressable: a Pressable
                    nested inside a Pressable triggers a web a11y warning and
                    double-fires the identical onPress on native. */}
                <View style={styles.chevronBadge}>
                  <ChevronRight size={14} color={colors.primary} strokeWidth={2.25} />
                </View>
              </View>
            </AnimatedPressable>
          </FadeSlideIn>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  sectionTitle: {
    ...typography.h1,
    color: colors.textPrimary,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  tile: {
    width: '100%',
    aspectRatio: 1.5,
    borderRadius: radii.xl,
    overflow: 'hidden',
    justifyContent: 'flex-end',
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    ...shadows.card,
  },
  // Explicit width/height alongside the absolute-fill insets - see
  // EditorialCard.tsx's own artwork style for why insets alone can leave
  // Image sized by its intrinsic pixels instead of the tile.
  artwork: {
    ...StyleSheet.absoluteFill,
    width: '100%',
    height: '100%',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    padding: spacing.sm,
    gap: spacing.xxs,
  },
  textBlock: {
    flex: 1,
    gap: 2,
  },
  title: {
    ...typography.h2,
    color: colors.textOnDark,
  },
  subtitle: {
    ...typography.small,
    color: colors.textOnDark,
    opacity: 0.9,
  },
  chevronBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    ...shadows.card,
  },
});
