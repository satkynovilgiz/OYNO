import { ChevronRight, Gift } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { Card, IconButton, IconChip } from '@/components/ui';
import { colors, spacing, typography } from '@/theme';

import type { DailyGift } from '../types';

type DailyGiftCardProps = {
  gift: DailyGift;
  onPress?: () => void;
};

export function DailyGiftCard({ gift, onPress }: DailyGiftCardProps) {
  const { t } = useTranslation();

  return (
    <Card style={styles.card}>
      <IconChip icon={Gift} size={48} iconSize={24} color={colors.primary} />

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
