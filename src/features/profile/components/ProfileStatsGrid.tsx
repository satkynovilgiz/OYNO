import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { Card, ProgressRing } from '@/components/ui';
import { colors, spacing, typography } from '@/theme';

import type { ProfileStat } from '../types';

type ProfileStatsGridProps = {
  stats: ProfileStat[];
};

export function ProfileStatsGrid({ stats }: ProfileStatsGridProps) {
  const { t } = useTranslation();

  return (
    <Card style={styles.card}>
      <Text style={styles.title}>{t('profile.progress.title')}</Text>

      <View style={styles.row}>
        {stats.map(({ id, icon: Icon, label, valueLabel, ringProgress }) => (
          <View key={id} style={styles.item}>
            <ProgressRing progress={ringProgress} size={52} strokeWidth={3.5}>
              <Icon size={20} color={colors.primary} strokeWidth={1.75} />
            </ProgressRing>
            <Text style={styles.label} numberOfLines={1}>
              {label}
            </Text>
            <Text style={styles.value}>{valueLabel}</Text>
          </View>
        ))}
      </View>
    </Card>
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
