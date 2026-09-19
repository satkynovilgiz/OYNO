import { LinearGradient } from 'expo-linear-gradient';
import { ChevronRight } from 'lucide-react-native';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AnimatedPressable, Badge, FadeSlideIn, TextButton } from '@/components/ui';
import { colors, radii, shadows, spacing, typography } from '@/theme';

import type { ExploreDiscovery } from '../types';

type DiscoveriesRowProps = {
  discoveries: ExploreDiscovery[];
  discoveredIds?: string[];
  onPressDiscovery?: (discovery: ExploreDiscovery) => void;
  onPressSeeAll?: () => void;
  /** Overrides the default "New discoveries" home-screen title - used by
   * LocationDetailScreen to show "Discoveries" for this region instead. */
  title?: string;
};

/** Falls back to a flat category color when a discovery has no imageSource
 * yet (same convention used elsewhere on this screen for missing art). The
 * "see all" link only renders when a real destination is provided, so this
 * never ships a tappable-looking button with nothing behind it. */
export function DiscoveriesRow({ discoveries, discoveredIds = [], onPressDiscovery, onPressSeeAll, title }: DiscoveriesRowProps) {
  const { t } = useTranslation();

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <Text style={styles.sectionTitle}>{title ?? t('explore.discoveries.title')}</Text>
        {onPressSeeAll && (
          <TextButton
            label={t('explore.discoveries.seeAll')}
            onPress={onPressSeeAll}
            trailingIcon={<ChevronRight size={14} color={colors.primary} strokeWidth={2.25} />}
          />
        )}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.list}
      >
        {discoveries.map((discovery, index) => {
          const categoryColor = colors.discovery[discovery.category];
          const discovered = discoveredIds.includes(discovery.id);
          return (
            <FadeSlideIn key={discovery.id} style={shadows.card} index={index}>
              <AnimatedPressable
                style={[styles.card, discovered && styles.cardDiscovered]}
                onPress={() => onPressDiscovery?.(discovery)}
                hoverEffect
                accessibilityRole="button"
                accessibilityLabel={discovery.title}
              >
                {discovery.imageSource ? (
                  <Image source={discovery.imageSource} style={styles.artwork} resizeMode="cover" />
                ) : (
                  <View style={[styles.artwork, { backgroundColor: categoryColor }]} />
                )}
                <LinearGradient
                  colors={['transparent', 'rgba(0,0,0,0.65)']}
                  locations={[0.35, 1]}
                  style={StyleSheet.absoluteFill}
                />

                <View style={styles.topRow}>
                  <Badge label={t(`explore.discoveries.categories.${discovery.category}`)} color={categoryColor} />
                </View>
                <View style={styles.bottomBlock}>
                  <Text style={styles.discoveryTitle} numberOfLines={2}>
                    {discovery.title}
                  </Text>
                  <Text style={[styles.xpText, discovered && styles.xpTextDiscovered]}>
                    {discovered ? t('explore.discoveries.discoveredLabel') : `+${discovery.xpReward} XP`}
                  </Text>
                </View>
              </AnimatedPressable>
            </FadeSlideIn>
          );
        })}
      </ScrollView>
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
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
  },
  sectionTitle: {
    ...typography.h1,
    color: colors.textPrimary,
  },
  list: {
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  card: {
    width: 150,
    height: 130,
    borderRadius: radii.xl,
    overflow: 'hidden',
    justifyContent: 'space-between',
    padding: spacing.xs,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  // Explicit width/height alongside the absolute-fill insets - see
  // EditorialCard.tsx's own artwork style comment for why insets alone can
  // leave Image sized by its intrinsic pixels instead of the card.
  artwork: {
    ...StyleSheet.absoluteFill,
    width: '100%',
    height: '100%',
  },
  cardDiscovered: {
    borderWidth: 2,
    borderColor: colors.accentGold,
  },
  topRow: {
    flexDirection: 'row',
  },
  bottomBlock: {
    gap: 1,
  },
  discoveryTitle: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.textOnDark,
  },
  xpText: {
    ...typography.small,
    color: colors.textOnDark,
    fontWeight: '700',
  },
  xpTextDiscovered: {
    color: colors.accentGold,
  },
});
