import { ArrowRight } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { OymoOrnament } from '@/components/patterns/OymoOrnament';
import { AnimatedPressable, FadeSlideIn, ProgressRing } from '@/components/ui';
import { resolveByCardScale } from '@/services/ageExperience/scale';
import { useAgeExperience } from '@/services/ageExperience/useAgeExperience';
import { colors, radii, spacing, typography } from '@/theme';

import type { ProfileStat } from '../types';

type CulturalJourneyCardProps = {
  stats: ProfileStat[];
  /** Opens the full "My OYNO Journey" passport (/journey). */
  onPress?: () => void;
};

const RING_SIZE_BY_CARD_SCALE = { large: 64, medium: 52, compact: 46, dense: 42 };

/** "My journey through Kyrgyz culture" (spec "Task 5... rather than
 * analytics") - the same real per-user numbers `ProfileStatsGrid` used to
 * show (games played, exploration/culture/quest/collection progress), but
 * framed as one deliberate milestone banner instead of five identical
 * bordered stat boxes. Lives on OYNO's `surfaceFeature` deep-green surface
 * (Section "SPECIAL: deep green/dark surface... stop using beige bordered
 * rectangles as the default for everything") - the one section on Profile
 * that isn't another cream card, so it reads as a distinct, valued
 * moment rather than a dashboard tile. */
export function CulturalJourneyCard({ stats, onPress }: CulturalJourneyCardProps) {
  const { t } = useTranslation();
  const { config } = useAgeExperience();
  const ringSize = resolveByCardScale(config.cardScale, RING_SIZE_BY_CARD_SCALE);

  return (
    <AnimatedPressable
      style={styles.card}
      onPress={onPress}
      disabled={!onPress}
      pressScale={0.99}
      hoverEffect
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={t('journey.entryCta')}
    >
      <View style={styles.ornamentRow}>
        <OymoOrnament size={13} color={colors.accentGold} strokeWidth={1.5} />
      </View>

      <Text style={styles.title}>{t('profile.progress.title')}</Text>
      <Text style={styles.subtitle}>{t('profile.progress.subtitle')}</Text>

      <View style={styles.row}>
        {stats.map(({ id, icon: Icon, label, valueLabel, ringProgress }, index) => (
          <FadeSlideIn key={id} style={styles.item} index={index}>
            <ProgressRing progress={ringProgress} size={ringSize} strokeWidth={3.5} trackColor="rgba(255,255,255,0.16)" fillColor={colors.accentGold}>
              <Icon size={ringSize * 0.38} color={colors.textOnDark} strokeWidth={1.75} />
            </ProgressRing>
            <Text style={styles.value}>{valueLabel}</Text>
            <Text style={styles.label} numberOfLines={1}>
              {label}
            </Text>
          </FadeSlideIn>
        ))}
      </View>

      {onPress ? (
        <View style={styles.cta}>
          <Text style={styles.ctaLabel}>{t('journey.entryCta')}</Text>
          <ArrowRight size={14} color={colors.accentGold} strokeWidth={2.5} />
        </View>
      ) : null}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surfaceFeature,
    borderRadius: radii.xxl,
    padding: spacing.md,
    gap: spacing.xs,
  },
  ornamentRow: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
  },
  title: {
    ...typography.h1,
    color: colors.textOnDark,
    maxWidth: '85%',
  },
  subtitle: {
    ...typography.caption,
    color: 'rgba(255,255,255,0.7)',
    marginBottom: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: spacing.md,
  },
  item: {
    alignItems: 'center',
    gap: 4,
    minWidth: 64,
  },
  label: {
    ...typography.small,
    color: 'rgba(255,255,255,0.7)',
  },
  value: {
    ...typography.bodyBold,
    color: colors.textOnDark,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xxs,
    marginTop: spacing.sm,
  },
  ctaLabel: {
    ...typography.caption,
    color: colors.accentGold,
    fontWeight: '700',
  },
});
