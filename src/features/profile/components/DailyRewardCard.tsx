import { Coins, Star } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Image, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui';
import { colors, radii, shadows, spacing, typography } from '@/theme';
import chestImage from '@assets/img/OYNO_design/profile/reward_chest.png';

import type { DailyReward } from '../types';

type DailyRewardCardProps = {
  reward: DailyReward;
  onPressClaim?: () => void;
};

export function DailyRewardCard({ reward, onPressClaim }: DailyRewardCardProps) {
  const { t } = useTranslation();

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{t('profile.reward.title')}</Text>

      <View style={styles.body}>
        <Image source={chestImage} style={styles.chest} resizeMode="contain" />

        <View style={styles.rewardsBlock}>
          <View style={styles.rewardRow}>
            <Star size={16} color={colors.primary} strokeWidth={2} />
            <Text style={styles.rewardText}>+{reward.xp} XP</Text>
          </View>
          <View style={styles.rewardRow}>
            <Coins size={16} color={colors.accentGold} strokeWidth={2} />
            <Text style={styles.rewardText}>+{reward.coins}</Text>
          </View>

          <View style={styles.ctaWrap}>
            <Button label={t('profile.reward.cta')} onPress={onPressClaim} />
          </View>
        </View>
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
    gap: spacing.xs,
    ...shadows.card,
  },
  title: {
    ...typography.h1,
    color: colors.textPrimary,
  },
  body: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  chest: {
    width: 64,
    height: 64,
  },
  rewardsBlock: {
    flex: 1,
    gap: 2,
  },
  rewardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
  },
  rewardText: {
    ...typography.bodyBold,
    color: colors.textPrimary,
  },
  ctaWrap: {
    marginTop: spacing.xxs,
    alignItems: 'flex-start',
  },
});
