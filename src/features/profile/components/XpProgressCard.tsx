import { Star } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { Card, IconChip, Pill, ProgressBar } from '@/components/ui';
import { colors, spacing, typography } from '@/theme';

import type { ProfileSummary } from '../types';

type XpProgressCardProps = {
  profile: ProfileSummary;
};

export function XpProgressCard({ profile }: XpProgressCardProps) {
  const { t } = useTranslation();
  const progress = profile.xpMax > 0 ? profile.xpCurrent / profile.xpMax : 0;
  const remaining = Math.max(0, profile.xpMax - profile.xpCurrent);

  return (
    <Card style={styles.card}>
      <IconChip icon={Star} size={44} iconSize={22} color={colors.accentGold} />

      <View style={styles.body}>
        <Text style={styles.xpLabel}>
          {profile.xpCurrent} / {profile.xpMax} XP
        </Text>
        <ProgressBar progress={progress} height={8} />
        <Text style={styles.remaining}>{t('profile.xpRemaining', { count: remaining })}</Text>
      </View>

      <Pill label={t('profile.level', { level: profile.level })} tone="surface" />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  body: {
    flex: 1,
    gap: spacing.xxs,
  },
  xpLabel: {
    ...typography.bodyBold,
    color: colors.textPrimary,
  },
  remaining: {
    ...typography.small,
    color: colors.textSecondary,
  },
});
