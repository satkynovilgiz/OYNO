import { Target } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { Button, Card, IconChip, ProgressBar } from '@/components/ui';
import { colors, spacing, typography } from '@/theme';

import type { DailyProgress } from '../types';

type DailyProgressCardProps = {
  progress: DailyProgress;
  onPressClaim?: () => void;
};

export function DailyProgressCard({ progress, onPressClaim }: DailyProgressCardProps) {
  const { t } = useTranslation();
  const ratio = progress.progressMax > 0 ? progress.progressCurrent / progress.progressMax : 0;

  return (
    <Card style={styles.card}>
      <IconChip icon={Target} size={44} iconSize={22} />

      <View style={styles.textBlock}>
        <Text style={styles.title}>{t('home.dailyChallenge.title')}</Text>
        <Text style={styles.description}>{progress.description}</Text>
        <View style={styles.progressRow}>
          <ProgressBar progress={ratio} height={6} style={styles.progressBar} />
          <Text style={styles.progressLabel}>
            {progress.progressCurrent} / {progress.progressMax}
          </Text>
        </View>
      </View>

      <Button label={t('home.dailyProgress.claimLabel')} onPress={onPressClaim} />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  textBlock: {
    flex: 1,
    gap: spacing.xxs,
  },
  title: {
    ...typography.h2,
    color: colors.textPrimary,
  },
  description: {
    ...typography.caption,
    color: colors.textSecondary,
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
});
