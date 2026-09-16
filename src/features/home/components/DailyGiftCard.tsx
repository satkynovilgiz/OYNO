import { ChevronRight, Gift } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { Card, IconButton, IconChip } from '@/components/ui';
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

export function DailyGiftCard({ gift, onPress, claimed = false }: DailyGiftCardProps) {
  const { t } = useTranslation();
  const ready = !claimed;

  return (
    <Card style={[styles.card, ready && styles.cardReady]}>
      <IconChip icon={Gift} size={48} iconSize={24} color={ready ? colors.accentGold : colors.primary} />

      <View style={styles.textBlock}>
        <Text style={styles.title}>{t('home.dailyGift.title')}</Text>
        <Text style={styles.subtitle}>{gift.subtitle}</Text>
      </View>

      <IconButton
        icon={ChevronRight}
        variant="primary"
        size={36}
        accessibilityLabel={t('home.dailyGift.openLabel')}
        onPress={onPress}
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
    gap: 2,
  },
  title: {
    ...typography.h2,
    color: colors.textPrimary,
  },
  subtitle: {
    ...typography.caption,
    color: colors.textSecondary,
  },
});
