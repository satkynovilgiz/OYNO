import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { FadeSlideIn, ProgressRing } from '@/components/ui';
import { colors, radii, spacing, typography } from '@/theme';

import type { CultureProgress } from '../types';

type CultureProgressCardProps = {
  progress: CultureProgress;
};

/** Compact single-row progress strip (Section "PROGRESS CARD: compact,
 * data visualization, no giant empty container" / "Reduce the huge
 * Culture Progress card... support the experience, not dominate half the
 * screen"). The per-category breakdown this card used to show is now
 * redundant with each category card's own current/total label
 * (CultureCategoriesGrid), so this only surfaces the one number that
 * doesn't live anywhere else: overall progress. */
export function CultureProgressCard({ progress }: CultureProgressCardProps) {
  const { t } = useTranslation();

  return (
    <FadeSlideIn style={styles.card}>
      <ProgressRing progress={progress.overallPercent / 100} size={48} strokeWidth={4}>
        <Text style={styles.percent}>{progress.overallPercent}%</Text>
      </ProgressRing>
      <View style={styles.textBlock}>
        <Text style={styles.title}>{t('culture.progress.title')}</Text>
        <Text style={styles.subtitle}>{t('culture.progress.continueLabel')}</Text>
      </View>
    </FadeSlideIn>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surfaceWarm,
    borderRadius: radii.xl,
    padding: spacing.sm,
  },
  percent: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.primary,
  },
  textBlock: {
    flex: 1,
    gap: 1,
  },
  title: {
    ...typography.bodyBold,
    color: colors.textPrimary,
  },
  subtitle: {
    ...typography.small,
    color: colors.textMuted,
  },
});
