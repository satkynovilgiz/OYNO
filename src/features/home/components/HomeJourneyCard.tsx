import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, View } from 'react-native';

import { OymoOrnament } from '@/components/patterns/OymoOrnament';
import { AnimatedPressable, HeroEntrance, ProgressBar } from '@/components/ui';
import type { HomeRecommendation } from '@/features/home/homeRecommendation';
import type { HomeRecommendationDisplay } from '@/features/home/useHomeRecommendation';
import { resolveByCardScale } from '@/services/ageExperience/scale';
import { useAgeExperience } from '@/services/ageExperience/useAgeExperience';
import { colors, fontFamily, radii, spacing, typography } from '@/theme';

import { HOME_RADIUS, HomeArtwork, HomePrimaryPill } from './homeKit';

type HomeJourneyCardProps = {
  recommendation: HomeRecommendation;
  display: HomeRecommendationDisplay;
  onPress: () => void;
};

/** Minimum card height per card scale - child gets the biggest picture.
 * A minimum (not a fixed aspect ratio): long KG/RU titles that wrap to two
 * lines grow the card instead of pushing the CTA out of view. */
const MIN_HEIGHT_BY_CARD_SCALE = { large: 340, medium: 270, compact: 236, dense: 224 };

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
  const minHeight = resolveByCardScale(config.cardScale, MIN_HEIGHT_BY_CARD_SCALE);
  const progress = recommendation.progress;
  const isChild = experience === 'child';

  return (
    <HeroEntrance>
      <AnimatedPressable
        style={[styles.card, { minHeight }]}
        onPress={onPress}
        pressScale={0.98}
        hoverEffect
        haptic="light"
        accessibilityRole="button"
        accessibilityLabel={`${display.eyebrow}: ${display.title}. ${display.ctaLabel}`}
      >
        <HomeArtwork source={display.imageSource} backdrop={display.backdropSource} />
        {/* Stronger lower scrim: the title and CTA always read over any photo. */}
        <LinearGradient colors={['rgba(19,32,24,0.25)', 'rgba(19,32,24,0)', 'rgba(19,32,24,0.94)']} locations={[0, 0.3, 1]} style={StyleSheet.absoluteFill} />

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

            <View style={styles.ctaRow}>
              <HomePrimaryPill label={display.ctaLabel} large={isChild} />
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
    borderRadius: HOME_RADIUS.hero,
    overflow: 'hidden',
    backgroundColor: colors.surfaceAlt,
  },
  artwork: {
    ...StyleSheet.absoluteFill,
    width: '100%',
    height: '100%',
  },
  overlay: {
    flex: 1,
    justifyContent: 'space-between',
    gap: spacing.lg,
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
    fontSize: 27,
    lineHeight: 32,
    color: colors.textOnDark,
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowRadius: 6,
  },
  titleEditorial: {
    fontFamily: fontFamily.wordmark,
  },
  subtitle: {
    ...typography.body,
    color: 'rgba(255,255,255,0.85)',
  },
  progressBlock: {
    gap: 3,
    marginTop: spacing.xs,
    maxWidth: '75%',
  },
  progressLabel: {
    ...typography.small,
    color: 'rgba(255,255,255,0.75)',
  },
  ctaRow: {
    marginTop: spacing.sm,
  },
});
