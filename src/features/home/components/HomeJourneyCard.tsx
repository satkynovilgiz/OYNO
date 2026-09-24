import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { OymoOrnament } from '@/components/patterns/OymoOrnament';
import { HeroEntrance, MediaCard, ProgressBar } from '@/components/ui';
import type { HomeRecommendation } from '@/features/home/homeRecommendation';
import type { HomeRecommendationDisplay } from '@/features/home/useHomeRecommendation';
import { resolveByCardScale } from '@/services/ageExperience/scale';
import { useAgeExperience } from '@/services/ageExperience/useAgeExperience';
import { colors, spacing, textStyles } from '@/theme';

type HomeJourneyCardProps = {
  recommendation: HomeRecommendation;
  display: HomeRecommendationDisplay;
  onPress: () => void;
};

/** Width : height of the primary card per age. ~3:2 for teen/adult keeps
 * it at roughly 35-45% of the first usable viewport under the header; the
 * child tier is a little taller for a bigger picture and a bigger CTA. The
 * value is a *minimum* height, so a two-line KG/RU title grows the card
 * instead of pushing the CTA out. */
const RATIO_BY_CARD_SCALE = { large: 1.3, medium: 1.42, compact: 1.5, dense: 1.55 };

/**
 * Home's single primary recommendation. Renders only what
 * buildHomeJourneyRecommendation decided - never decides. Progress appears
 * only when the recommendation carries a real, measurable count.
 */
export function HomeJourneyCard({ recommendation, display, onPress }: HomeJourneyCardProps) {
  const { t } = useTranslation();
  const { experience, config } = useAgeExperience();
  const { width } = useWindowDimensions();
  const minHeight = Math.round((width - spacing.md * 2) / resolveByCardScale(config.cardScale, RATIO_BY_CARD_SCALE));
  const progress = recommendation.progress && recommendation.progress.total > 0 ? recommendation.progress : null;
  const isChild = experience === 'child';
  const subtitle = display.subtitle && !isChild ? display.subtitle : undefined;
  // The subtitle usually already *is* the progress sentence - show the
  // count text only when there's no subtitle, otherwise just the thin bar.
  const progressText = progress ? t('home.journey.progress', { completed: progress.completed, total: progress.total }) : null;

  return (
    <HeroEntrance>
      <MediaCard
        variant="hero"
        source={display.imageSource}
        backdrop={display.backdropSource}
        minHeight={minHeight}
        eyebrow={display.eyebrow}
        eyebrowIcon={<OymoOrnament size={11} color={colors.accentGold} strokeWidth={1.5} />}
        title={display.title}
        editorialTitle={experience === 'adult'}
        subtitle={subtitle}
        footer={
          progress ? (
            <View style={styles.progress}>
              {subtitle ? null : (
                <Text style={styles.progressLabel} numberOfLines={1}>
                  {progressText}
                </Text>
              )}
              <ProgressBar progress={progress.completed / progress.total} height={4} fillColor={colors.accentGold} trackColor="rgba(251,243,227,0.24)" />
            </View>
          ) : undefined
        }
        cta={display.ctaLabel}
        ctaSize={isChild ? 'lg' : 'md'}
        ctaPlacement={isChild ? 'below' : 'inline'}
        onPress={onPress}
        accessibilityLabel={`${display.eyebrow}: ${display.title}. ${progressText ? progressText + '. ' : ''}${display.ctaLabel}`}
      />
    </HeroEntrance>
  );
}

const styles = StyleSheet.create({
  progress: { gap: 6, maxWidth: 220 },
  progressLabel: { ...textStyles.caption, fontWeight: '600', color: colors.textOnDarkSecondary },
});
