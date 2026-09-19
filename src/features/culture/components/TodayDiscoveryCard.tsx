import { LinearGradient } from 'expo-linear-gradient';
import { ArrowRight } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Image, StyleSheet, Text, View } from 'react-native';

import { AnimatedPressable, Badge, FadeSlideIn } from '@/components/ui';
import { colors, radii, spacing, typography } from '@/theme';

import type { CultureDiscovery } from '../types';

type TodayDiscoveryCardProps = {
  discovery: CultureDiscovery;
  onPress?: () => void;
};

/** Full-width "featured story" card (Section "Featured cultural story/
 * discovery") - promoted from a small side-by-side tile to its own
 * standalone HERO-tier moment, since this is meant to be the one thing on
 * the page that changes daily and deserves real visual weight instead of
 * competing for half a row with EnterBozUyCard. */
export function TodayDiscoveryCard({ discovery, onPress }: TodayDiscoveryCardProps) {
  const { t } = useTranslation();

  return (
    <FadeSlideIn>
      <AnimatedPressable style={styles.card} onPress={onPress} hoverEffect accessibilityRole="button" accessibilityLabel={discovery.title}>
        <Image source={discovery.imageSource} style={styles.artwork} resizeMode="cover" />
        <LinearGradient colors={['rgba(19,32,24,0)', 'rgba(19,32,24,0.9)']} locations={[0.3, 1]} style={StyleSheet.absoluteFill} />

        <View style={styles.overlay} pointerEvents="box-none">
          <View style={styles.header}>
            <Text style={styles.label}>{t('culture.discovery.label')}</Text>
            {discovery.isNew && <Badge label={t('culture.discovery.newBadge')} color={colors.accentGold} textColor={colors.textPrimary} />}
          </View>

          <View style={styles.content}>
            <Text style={styles.title}>{discovery.title}</Text>
            <Text style={styles.description} numberOfLines={2}>
              {discovery.description}
            </Text>

            <View style={styles.cta}>
              <Text style={styles.ctaLabel}>{t('culture.discovery.cta')}</Text>
              <ArrowRight size={14} color={colors.textPrimary} strokeWidth={2.5} />
            </View>
          </View>
        </View>
      </AnimatedPressable>
    </FadeSlideIn>
  );
}

const styles = StyleSheet.create({
  // Owns sizing/overflow only - no padding here. Yoga resolves an
  // absolute child's explicit `top/left/right/bottom: 0` inset against
  // this node's BORDER edge, but resolves that same child's percentage
  // width/height against its PADDING-reduced content box - so padding
  // directly on this node would make the full-bleed artwork/overlay
  // fall short of the true edge on the bottom/trailing side. Padding for
  // the actual content lives on `overlay` below instead, whose own
  // parent (this node) has none, so its 100%/100% sizing is exact.
  card: {
    width: '100%',
    aspectRatio: 1.6,
    borderRadius: radii.xxl,
    overflow: 'hidden',
  },
  // Explicit width/height alongside the absolute-fill insets - see
  // EditorialCard.tsx's own artwork style comment for why insets alone can
  // leave Image sized by its intrinsic pixels instead of the card.
  artwork: {
    ...StyleSheet.absoluteFill,
    width: '100%',
    height: '100%',
  },
  overlay: {
    ...StyleSheet.absoluteFill,
    width: '100%',
    height: '100%',
    justifyContent: 'space-between',
    padding: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  label: {
    ...typography.overline,
    color: 'rgba(255,255,255,0.85)',
  },
  content: {
    gap: 3,
  },
  title: {
    ...typography.h1,
    fontSize: 20,
    color: colors.textOnDark,
  },
  description: {
    ...typography.caption,
    color: 'rgba(255,255,255,0.85)',
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xxs,
    backgroundColor: colors.accentGold,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
    marginTop: spacing.xxs,
  },
  ctaLabel: {
    ...typography.caption,
    color: colors.textPrimary,
    fontWeight: '700',
  },
});
