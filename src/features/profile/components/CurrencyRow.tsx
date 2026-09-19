import { Coins, Gem } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { FadeSlideIn } from '@/components/ui';
import { colors, radii, spacing, typography } from '@/theme';

import type { ProfileSummary } from '../types';

type CurrencyRowProps = {
  profile: ProfileSummary;
};

/** Just the two genuine wallet balances - XP already lives on the Hero's
 * own progress bar and badge count already lives in the Achievements
 * section below, so showing them a second time here was redundant
 * (Section "reduce... redundant labels"). Borderless pills instead of
 * bordered cards - two small chips don't need their own cream rectangles. */
export function CurrencyRow({ profile }: CurrencyRowProps) {
  const { t } = useTranslation();

  const items = [
    { id: 'coins', icon: Coins, color: colors.accentGold, label: t('profile.currencies.coins'), value: profile.coins.toLocaleString('ru-RU') },
    { id: 'tokens', icon: Gem, color: colors.discovery.animals, label: t('profile.currencies.tokens'), value: String(profile.tokens) },
  ] as const;

  return (
    <View style={styles.row}>
      {items.map((item, index) => (
        <FadeSlideIn key={item.id} style={styles.chip} index={index}>
          <item.icon size={16} color={item.color} strokeWidth={2.25} />
          <Text style={styles.value}>{item.value}</Text>
          <Text style={styles.label}>{item.label}</Text>
        </FadeSlideIn>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  label: {
    ...typography.small,
    color: colors.textSecondary,
  },
  value: {
    ...typography.bodyBold,
    color: colors.textPrimary,
  },
});
