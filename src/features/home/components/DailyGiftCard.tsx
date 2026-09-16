import { Gift } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { AnimatedPressable, Card, IconChip } from '@/components/ui';
import { colors, spacing, typography } from '@/theme';

import type { DailyGift } from '../types';

type DailyGiftCardProps = {
  gift: DailyGift;
  onPress?: () => void;
  /** Not yet claimed today (Section "daily task/reward cards feel more
   * special") - a gold ring + a warmer icon chip instead of a generic
   * card border, the same "ready" cue as the other 2 daily cards. */
  claimed?: boolean;
};

/** Compact vertical layout so this reads consistently next to
 * DailyChallengeCard when the two sit side by side (Section "reduce
 * dashboard-box feeling" - was a wide horizontal strip that only worked
 * full-width). The whole card is the tap target instead of a separate
 * chevron button. */
export function DailyGiftCard({ gift, onPress, claimed = false }: DailyGiftCardProps) {
  const { t } = useTranslation();
  const ready = !claimed;

  return (
    <Card style={[styles.card, ready && styles.cardReady]} padded={false}>
      <AnimatedPressable
        style={styles.pressable}
        onPress={onPress}
        hoverEffect
        accessibilityRole="button"
        accessibilityLabel={t('home.dailyGift.openLabel')}
      >
        <IconChip icon={Gift} size={40} iconSize={20} color={ready ? colors.accentGold : colors.primary} />
        <View style={styles.textBlock}>
          <Text style={styles.title}>{t('home.dailyGift.title')}</Text>
          <Text style={styles.subtitle} numberOfLines={2}>
            {gift.subtitle}
          </Text>
        </View>
      </AnimatedPressable>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
  },
  cardReady: {
    borderWidth: 1.5,
    borderColor: colors.accentGold,
  },
  pressable: {
    padding: spacing.md,
    gap: spacing.xs,
  },
  textBlock: {
    gap: 1,
  },
  title: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  subtitle: {
    ...typography.small,
    color: colors.textSecondary,
  },
});
