import { Flame } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { ProgressRing } from '@/components/ui';
import { colors, shadows, radii, spacing, typography } from '@/theme';

import type { DailyActivityItem, ProfileSummary } from '../types';

type DailyActivitySummaryCardProps = {
  profile: ProfileSummary;
  activity: DailyActivityItem[];
  completed: number;
  total: number;
};

export function DailyActivitySummaryCard({ profile, activity, completed, total }: DailyActivitySummaryCardProps) {
  const { t } = useTranslation();

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('profile.dailyActivity.title')}</Text>
        <View style={styles.streakChip}>
          <Flame size={13} color={colors.danger} strokeWidth={2.25} />
          <Text style={styles.streakText}>{t('profile.dailyActivity.streak', { count: profile.streakDays })}</Text>
        </View>
      </View>

      <View style={styles.body}>
        <View style={styles.list}>
          {activity.map(({ id, icon: Icon, label }) => (
            <View key={id} style={styles.item}>
              <Icon size={16} color={colors.primary} strokeWidth={1.75} />
              <Text style={styles.itemLabel} numberOfLines={1}>
                {label}
              </Text>
            </View>
          ))}
        </View>

        <ProgressRing progress={total > 0 ? completed / total : 0} size={64} strokeWidth={5}>
          <Text style={styles.ringValue}>
            {completed}/{total}
          </Text>
        </ProgressRing>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: spacing.sm,
    gap: spacing.sm,
    ...shadows.card,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    ...typography.h1,
    color: colors.textPrimary,
    flexShrink: 1,
  },
  streakChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: spacing.xs,
    paddingVertical: 4,
    borderRadius: radii.pill,
  },
  streakText: {
    ...typography.small,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  body: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  list: {
    flex: 1,
    gap: spacing.xxs,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
  },
  itemLabel: {
    ...typography.small,
    color: colors.textSecondary,
    flexShrink: 1,
  },
  ringValue: {
    ...typography.caption,
    color: colors.textPrimary,
    fontWeight: '700',
  },
});
