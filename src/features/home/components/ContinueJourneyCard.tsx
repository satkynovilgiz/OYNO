import { LinearGradient } from 'expo-linear-gradient';
import { ChevronRight } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Image, StyleSheet, Text, View } from 'react-native';

import { OymoOrnament } from '@/components/patterns/OymoOrnament';
import { AnimatedPressable, HeroEntrance, ProgressBar } from '@/components/ui';
import type { ContinueJourneyCardData } from '@/features/home/continueJourney';
import { resolveByCardScale } from '@/services/ageExperience/scale';
import { useAgeExperience } from '@/services/ageExperience/useAgeExperience';
import { colors, radii, spacing, typography } from '@/theme';
import questBackground from '@assets/img/OYNO_design/explore/quest_boru_shyrdak.png';

type ContinueJourneyCardProps = {
  data: ContinueJourneyCardData;
  onPress: (ctaRoute: string) => void;
};

const ASPECT_RATIO_BY_CARD_SCALE = { large: 1.2, medium: 1.6, compact: 1.75, dense: 1.95 };

/** Home's one primary personalized moment (spec "Task 7... Show ONE
 * strong primary continuation card rather than several competing cards")
 * - `data` already encodes which of the two genuinely-real states applies
 * (an in-progress quest, or a not-yet-tried interactive experience); this
 * component only renders it, never decides it (see continueJourney.ts).
 * Progress only ever renders for the `quest` variant, since that's the
 * only case with real progress to show. */
export function ContinueJourneyCard({ data, onPress }: ContinueJourneyCardProps) {
  const { t } = useTranslation();
  const { config } = useAgeExperience();
  const aspectRatio = resolveByCardScale(config.cardScale, ASPECT_RATIO_BY_CARD_SCALE);
  const isQuest = data.kind === 'quest';
  const imageSource = isQuest ? questBackground : data.imageSource;
  const title = isQuest ? data.title : t(data.titleKey);
  const eyebrow = isQuest ? t('home.continueJourney.continueLabel') : t('home.continueJourney.discoverLabel');
  const ctaLabel = isQuest ? t('home.continueJourney.continueCta') : t('home.continueJourney.discoverCta');

  return (
    <HeroEntrance>
      <AnimatedPressable
        style={[styles.card, { aspectRatio }]}
        onPress={() => onPress(data.ctaRoute)}
        pressScale={0.98}
        hoverEffect
        haptic="light"
        accessibilityRole="button"
        accessibilityLabel={title}
      >
        <Image source={imageSource} style={styles.artwork} resizeMode="cover" />
        <LinearGradient colors={['rgba(19,32,24,0.05)', 'rgba(19,32,24,0.88)']} locations={[0.35, 1]} style={StyleSheet.absoluteFill} />

        <View style={styles.overlay} pointerEvents="box-none">
          <View style={styles.eyebrowRow}>
            <OymoOrnament size={12} color={colors.accentGold} strokeWidth={1.5} />
            <Text style={styles.eyebrow}>{eyebrow}</Text>
          </View>

          <View style={styles.bottomBlock}>
            <Text style={styles.title} numberOfLines={2}>
              {title}
            </Text>
            {isQuest ? (
              <>
                <Text style={styles.subtitle} numberOfLines={1}>
                  {data.subtitle}
                </Text>
                <View style={styles.progressBlock}>
                  <ProgressBar progress={data.total > 0 ? data.current / data.total : 0} height={5} fillColor={colors.accentGold} />
                  <Text style={styles.progressLabel}>
                    {data.current} / {data.total}
                  </Text>
                </View>
              </>
            ) : null}

            <View style={styles.cta}>
              <Text style={styles.ctaLabel}>{ctaLabel}</Text>
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
  },
  ctaLabel: {
    ...typography.caption,
    color: colors.textPrimary,
    fontWeight: '700',
  },
});
