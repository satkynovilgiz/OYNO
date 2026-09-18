import { Target } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { Button, Card, IconChip, ProgressBar } from '@/components/ui';
import { resolveByCardScale } from '@/services/ageExperience/scale';
import { useAgeExperience } from '@/services/ageExperience/useAgeExperience';
import { colors, spacing, typography } from '@/theme';

import type { DailyProgress } from '../types';

type DailyProgressCardProps = {
  progress: DailyProgress;
  claimable?: boolean;
  claimed?: boolean;
  onPressClaim?: () => void;
};

const ICON_CHIP_SIZE_BY_CARD_SCALE = { large: 60, medium: 44, compact: 40, dense: 36 };
const TITLE_FONT_SIZE_BY_CARD_SCALE = { large: 21, medium: 17, compact: 16, dense: 15 };
const DESCRIPTION_FONT_SIZE_BY_CARD_SCALE = { large: 16, medium: 13, compact: 12, dense: 12 };

export function DailyProgressCard({ progress, claimable = false, claimed = false, onPressClaim }: DailyProgressCardProps) {
  const { t } = useTranslation();
  const { config } = useAgeExperience();
  const ratio = progress.progressMax > 0 ? progress.progressCurrent / progress.progressMax : 0;
  const ready = claimable && !claimed;

  return (
    <Card style={[styles.card, ready && styles.cardReady]}>
      <IconChip
        icon={Target}
        size={resolveByCardScale(config.cardScale, ICON_CHIP_SIZE_BY_CARD_SCALE)}
        iconSize={resolveByCardScale(config.cardScale, { large: 30, medium: 22, compact: 20, dense: 18 })}
        color={ready ? colors.accentGold : undefined}
      />

      <View style={styles.textBlock}>
        <Text style={[styles.title, { fontSize: resolveByCardScale(config.cardScale, TITLE_FONT_SIZE_BY_CARD_SCALE) }]}>
          {t('home.dailyProgress.title')}
        </Text>
        <Text style={[styles.description, { fontSize: resolveByCardScale(config.cardScale, DESCRIPTION_FONT_SIZE_BY_CARD_SCALE) }]}>
          {progress.description}
        </Text>
        <View style={styles.progressRow}>
          <ProgressBar progress={ratio} height={6} style={styles.progressBar} />
          <Text style={styles.progressLabel}>
            {progress.progressCurrent} / {progress.progressMax}
          </Text>
        </View>
      </View>

      <Button
        label={t(claimed ? 'home.dailyProgress.claimedLabel' : 'home.dailyProgress.claimLabel')}
        onPress={onPressClaim}
        disabled={!claimable || claimed}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  cardReady: {
    borderWidth: 1.5,
    borderColor: colors.accentGold,
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
