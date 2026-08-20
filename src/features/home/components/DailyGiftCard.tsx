import { ChevronRight, Gift } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { Card, IconButton } from '@/components/ui';
import { colors, radii, spacing, typography } from '@/theme';

import type { DailyGift } from '../types';

type DailyGiftCardProps = {
  gift: DailyGift;
  onPress?: () => void;
};

export function DailyGiftCard({ gift, onPress }: DailyGiftCardProps) {
  const { t } = useTranslation();

  return (
    <Card style={styles.card}>
      <View style={styles.iconWrap}>
        <Gift size={26} color={colors.primary} strokeWidth={1.75} />
      </View>

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
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: radii.lg,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
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
