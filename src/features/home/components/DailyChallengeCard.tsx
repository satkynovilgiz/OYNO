import { Calendar, ChevronRight, Coins, Star } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { Card, IconButton, IconChip, ProgressBar } from '@/components/ui';
import { resolveByCardScale } from '@/services/ageExperience/scale';
import { useAgeExperience } from '@/services/ageExperience/useAgeExperience';
import { colors, radii, spacing, typography } from '@/theme';

import type { DailyChallenge } from '../types';

type DailyChallengeCardProps = {
  challenge: DailyChallenge;
  onPress?: () => void;
  /** Complete but not yet claimed (Section "daily task/reward cards feel
   * more special") - a gold ring instead of a generic card border, the
   * same "ready" cue `DailyGiftCard`/`DailyProgressCard` use. */
  ready?: boolean;
};

const ICON_CHIP_SIZE_BY_CARD_SCALE = { large: 40, medium: 28, compact: 26, dense: 24 };
const TITLE_FONT_SIZE_BY_CARD_SCALE = { large: 17, medium: 13, compact: 13, dense: 12 };
const DESCRIPTION_FONT_SIZE_BY_CARD_SCALE = { large: 15, medium: 11, compact: 11, dense: 10 };

export function DailyChallengeCard({ challenge, onPress, ready = false }: DailyChallengeCardProps) {
  const { t } = useTranslation();
  const { config } = useAgeExperience();
  const progress =
    challenge.progressMax > 0 ? challenge.progressCurrent / challenge.progressMax : 0;

  return (
    <Card style={[styles.card, ready && styles.cardReady]}>
      <View style={styles.headerRow}>
        <IconChip
          icon={Calendar}
          size={resolveByCardScale(config.cardScale, ICON_CHIP_SIZE_BY_CARD_SCALE)}
          iconSize={resolveByCardScale(config.cardScale, { large: 20, medium: 14, compact: 13, dense: 12 })}
        />
        <Text style={[styles.title, { fontSize: resolveByCardScale(config.cardScale, TITLE_FONT_SIZE_BY_CARD_SCALE) }]}>
          {t('home.dailyChallenge.title')}
        </Text>
        <IconButton
          icon={ChevronRight}
          variant="primary"
          size={32}
          accessibilityLabel={t('home.dailyChallenge.openLabel')}
          onPress={onPress}
        />
      </View>

      <Text
        style={[styles.description, { fontSize: resolveByCardScale(config.cardScale, DESCRIPTION_FONT_SIZE_BY_CARD_SCALE) }]}
        numberOfLines={2}
      >
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
  cardReady: {
    borderWidth: 1.5,
    borderColor: colors.accentGold,
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
