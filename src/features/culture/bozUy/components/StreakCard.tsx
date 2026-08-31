import { Flame } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { Card } from '@/components/ui';
import { BOZ_UY_REWARD } from '@/store/useProgressStore';
import { colors, spacing, typography } from '@/theme';

type StreakCardProps = {
  streakDays: number;
};

/** Real streak_days (useProgressStore, same field the Culture Home header
 * already shows) + the real completion reward figure - not the design
 * mock's invented "+40 XP" bonus, which doesn't correspond to any actual
 * reward mechanic. */
export function StreakCard({ streakDays }: StreakCardProps) {
  const { t } = useTranslation();

  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <Flame size={16} color={colors.danger} strokeWidth={2.25} />
        <Text style={styles.title}>{t('culture.bozUy.streakCard.title')}</Text>
      </View>
      <Text style={styles.days}>{t('culture.bozUy.streakCard.days', { count: streakDays })}</Text>
      <Text style={styles.reward}>{t('culture.bozUy.streakCard.reward', { xp: BOZ_UY_REWARD.xp })}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.xxs,
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
  },
  title: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '700',
  },
  days: {
    ...typography.h2,
    color: colors.textPrimary,
  },
  reward: {
    ...typography.small,
    color: colors.accentGoldPressed,
    fontWeight: '700',
  },
});
