import { Calendar, ChevronRight, Coins, Star } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { Card, IconButton, IconChip, ProgressBar } from '@/components/ui';
import { colors, spacing, typography } from '@/theme';

import type { DailyChallenge } from '../types';

type DailyChallengeCardProps = {
  challenge: DailyChallenge;
  onPress?: () => void;
};

export function DailyChallengeCard({ challenge, onPress }: DailyChallengeCardProps) {
  const { t } = useTranslation();
  const progress =
    challenge.progressMax > 0 ? challenge.progressCurrent / challenge.progressMax : 0;

  return (
    <Card style={styles.card}>
      <View style={styles.headerRow}>
        <IconChip icon={Calendar} size={28} iconSize={14} />
        <Text style={styles.title}>{t('home.dailyChallenge.title')}</Text>
        <IconButton
          icon={ChevronRight}
          variant="primary"
          size={32}
          accessibilityLabel={t('home.dailyChallenge.openLabel')}
          onPress={onPress}
        />
      </View>

      <Text style={styles.description} numberOfLines={2}>
        {challenge.description}
      </Text>

      <View style={styles.progressRow}>
        <ProgressBar progress={progress} height={6} style={styles.progressBar} />
        <Text style={styles.progressLabel}>
          {challenge.progressCurrent} / {challenge.progressMax}
        </Text>
      </View>

      <View style={styles.rewardRow}>
        <Text style={styles.rewardLabel}>{t('home.dailyChallenge.rewardLabel')}</Text>
        <View style={styles.rewardChip}>
          <Star size={13} color={colors.primaryMuted} strokeWidth={2} />
          <Text style={styles.rewardText}>{challenge.rewardXp}</Text>
        </View>
        <View style={styles.rewardChip}>
          <Coins size={13} color={colors.accentGold} strokeWidth={2} />
          <Text style={styles.rewardText}>{challenge.rewardCoins}</Text>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    gap: spacing.xs,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
  },
  title: {
    ...typography.caption,
    color: colors.textPrimary,
    fontWeight: '700',
    flex: 1,
  },
  description: {
    ...typography.small,
    color: colors.textSecondary,
    lineHeight: 15,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  progressBar: {
    flex: 1,
  },
  progressLabel: {
    ...typography.small,
    color: colors.textSecondary,
  },
  rewardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
  },
  rewardLabel: {
    ...typography.small,
    color: colors.textSecondary,
  },
  rewardChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  rewardText: {
    ...typography.small,
    color: colors.textPrimary,
  },
});
