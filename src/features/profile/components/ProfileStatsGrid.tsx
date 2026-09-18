import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { FadeSlideIn, ProgressRing } from '@/components/ui';
import { resolveByCardScale } from '@/services/ageExperience/scale';
import { useAgeExperience } from '@/services/ageExperience/useAgeExperience';
import { colors, spacing, typography } from '@/theme';

import type { ProfileStat } from '../types';

type ProfileStatsGridProps = {
  stats: ProfileStat[];
};

const RING_SIZE_BY_CARD_SCALE = { large: 68, medium: 52, compact: 46, dense: 40 };

/** Borderless section (Section "reduce statistics-dashboard appearance") -
 * the rings themselves already carry the visual weight; boxing them in
 * another cream card on top of everything else on this screen just added
 * one more repetitive rectangle. */
export function ProfileStatsGrid({ stats }: ProfileStatsGridProps) {
  const { t } = useTranslation();
  const { config } = useAgeExperience();
  const ringSize = resolveByCardScale(config.cardScale, RING_SIZE_BY_CARD_SCALE);

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{t('profile.progress.title')}</Text>

      <View style={styles.row}>
        {stats.map(({ id, icon: Icon, label, valueLabel, ringProgress }, index) => (
          <FadeSlideIn key={id} style={styles.item} index={index}>
            <ProgressRing progress={ringProgress} size={ringSize} strokeWidth={3.5}>
              <Icon size={ringSize * 0.38} color={colors.primary} strokeWidth={1.75} />
            </ProgressRing>
            <Text style={styles.label} numberOfLines={1}>
              {label}
            </Text>
            <Text style={styles.value}>{valueLabel}</Text>
          </FadeSlideIn>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.sm,
  },
  title: {
    ...typography.h1,
    color: colors.textPrimary,
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
    color: colors.textSecondary,
  },
  value: {
    ...typography.bodyBold,
    color: colors.textPrimary,
  },
});
