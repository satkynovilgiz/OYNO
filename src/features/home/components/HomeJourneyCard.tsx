import { LinearGradient } from 'expo-linear-gradient';
import { ChevronRight } from 'lucide-react-native';
import { Image, StyleSheet, Text, View } from 'react-native';

import { OymoOrnament } from '@/components/patterns/OymoOrnament';
import { AnimatedPressable, HeroEntrance, ProgressBar } from '@/components/ui';
import type { HomeRecommendation } from '@/features/home/homeRecommendation';
import type { HomeRecommendationDisplay } from '@/features/home/useHomeRecommendation';
import { resolveByCardScale } from '@/services/ageExperience/scale';
import { useAgeExperience } from '@/services/ageExperience/useAgeExperience';
import { colors, fontFamily, radii, spacing, typography } from '@/theme';

type HomeJourneyCardProps = {
  recommendation: HomeRecommendation;
  display: HomeRecommendationDisplay;
  onPress: () => void;
};

/** Artwork proportion per card scale - child gets the biggest picture. */
const ASPECT_RATIO_BY_CARD_SCALE = { large: 1.05, medium: 1.45, compact: 1.75, dense: 1.95 };

/**
 * Home's single "Continue Your Journey" card (spec "Do not render several
 * competing continue cards") - it only renders what
 * buildHomeJourneyRecommendation decided; it never decides. Progress is
 * drawn only when the recommendation carries a real, measurable count.
 * Age: child - biggest artwork, one clear action; teen - compact progress
 * card; adult - calmer editorial serif title.
 */
export function HomeJourneyCard({ recommendation, display, onPress }: HomeJourneyCardProps) {
  const { experience, config } = useAgeExperience();
  const aspectRatio = resolveByCardScale(config.cardScale, ASPECT_RATIO_BY_CARD_SCALE);
  const progress = recommendation.progress;
  const isChild = experience === 'child';

  return (
    <HeroEntrance>
      <AnimatedPressable
        style={[styles.card, { aspectRatio }]}
        onPress={onPress}
        pressScale={0.98}
        hoverEffect
        haptic="light"
        accessibilityRole="button"
        accessibilityLabel={`${display.eyebrow}: ${display.title}. ${display.ctaLabel}`}
      >
        <Image source={display.imageSource} style={styles.artwork} resizeMode="cover" />
        <LinearGradient colors={['rgba(19,32,24,0.05)', 'rgba(19,32,24,0.9)']} locations={[0.3, 1]} style={StyleSheet.absoluteFill} />

        <View style={styles.overlay} pointerEvents="box-none">
          <View style={styles.eyebrowRow}>
            <OymoOrnament size={12} color={colors.accentGold} strokeWidth={1.5} />
            <Text style={styles.eyebrow}>{display.eyebrow}</Text>
          </View>

          <View style={styles.bottomBlock}>
            <Text style={[styles.title, experience === 'adult' && styles.titleEditorial]} numberOfLines={2}>
              {display.title}
            </Text>
            {display.subtitle && !isChild ? (
              <Text style={styles.subtitle} numberOfLines={1}>
                {display.subtitle}
              </Text>
            ) : null}
            {progress && progress.total > 0 ? (
              <View style={styles.progressBlock}>
                <ProgressBar progress={progress.completed / progress.total} height={5} fillColor={colors.accentGold} />
                <Text style={styles.progressLabel}>
                  {progress.completed} / {progress.total}
                </Text>
              </View>
            ) : null}

            <View style={[styles.cta, isChild && styles.ctaChild]}>
              <Text style={styles.ctaLabel} numberOfLines={1}>
                {display.ctaLabel}
              </Text>
              <ChevronRight size={16} color={colors.textPrimary} strokeWidth={2.5} />
            </View>
          </View>
        </View>
      </AnimatedPressable>
    </HeroEntrance>
  );
}

const styles = StyleSheet.create({
  // Owns sizing/overflow only - no padding here. Padding for the content
  // lives on `overlay` instead - see TodayDiscoveryCard's `card`/`overlay`
  // comment for why padding directly on this node would make the
  // absolute-fill artwork/gradient fall short of the true edge.
  card: {
    width: '100%',
    borderRadius: radii.xl,
    overflow: 'hidden',
    backgroundColor: colors.surfaceAlt,
  },
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
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(19,32,24,0.5)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radii.pill,
  },
  eyebrow: {
    ...typography.overline,
    color: colors.accentGold,
  },
  bottomBlock: {
    gap: 3,
  },
  title: {
    ...typography.display,
    color: colors.textOnDark,
  },
  titleEditorial: {
    fontFamily: fontFamily.wordmark,
  },
  subtitle: {
    ...typography.body,
    color: 'rgba(255,255,255,0.85)',
  },
  progressBlock: {
    gap: 2,
    marginTop: spacing.xxs,
    maxWidth: 200,
  },
  progressLabel: {
    ...typography.small,
    color: 'rgba(255,255,255,0.75)',
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xxs,
    backgroundColor: colors.accentGold,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
    marginTop: spacing.sm,
    maxWidth: '100%',
  },
  ctaChild: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  ctaLabel: {
    ...typography.caption,
    color: colors.textPrimary,
    fontWeight: '700',
    flexShrink: 1,
  },
});
