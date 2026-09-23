import { Coins, Star } from 'lucide-react-native';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';

import { Button, FadeSlideIn } from '@/components/ui';
import { useReducedMotion } from '@/services/motion/useReducedMotion';
import { colors, radii, shadows, spacing, typography } from '@/theme';
import chestImage from '@assets/img/OYNO_design/profile/reward_chest.png';

import type { DailyReward } from '../types';

type DailyRewardCardProps = {
  reward: DailyReward;
  claimed?: boolean;
  onPressClaim?: () => void;
};

export function DailyRewardCard({ reward, claimed = false, onPressClaim }: DailyRewardCardProps) {
  const { t } = useTranslation();
  const ready = !claimed;
  const chestScale = useSharedValue(1);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    // Reduce Motion: the chest stays still (no endless pulse).
    if (ready && !reducedMotion) {
      chestScale.value = withRepeat(withSequence(withTiming(1.06, { duration: 900 }), withTiming(1, { duration: 900 })), -1, true);
    } else {
      chestScale.value = withTiming(1, { duration: 200 });
    }
  }, [ready, reducedMotion, chestScale]);

  const chestStyle = useAnimatedStyle(() => ({ transform: [{ scale: chestScale.value }] }));

  return (
    <FadeSlideIn style={[styles.card, ready && styles.cardReady]}>
      <Text style={styles.title} numberOfLines={1}>
        {t('profile.reward.title')}
      </Text>

      <View style={styles.body}>
        <Animated.Image source={chestImage} style={[styles.chest, chestStyle]} resizeMode="contain" />

        <View style={styles.rewardsBlock}>
          <View style={styles.rewardRow}>
            <Star size={16} color={colors.primary} strokeWidth={2} />
            <Text style={styles.rewardText}>{t('profile.reward.xpValue', { xp: reward.xp })}</Text>
          </View>
          <View style={styles.rewardRow}>
            <Coins size={16} color={colors.accentGold} strokeWidth={2} />
            <Text style={styles.rewardText}>{t('profile.reward.coinsValue', { coins: reward.coins })}</Text>
          </View>
        </View>
      </View>

      <View style={styles.ctaWrap}>
        <Button
          label={t(claimed ? 'profile.reward.claimedLabel' : 'profile.reward.cta')}
          onPress={onPressClaim}
          disabled={claimed}
        />
      </View>
    </FadeSlideIn>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: spacing.sm,
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    ...shadows.card,
  },
  cardReady: {
    borderWidth: 1.5,
    borderColor: colors.accentGold,
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
