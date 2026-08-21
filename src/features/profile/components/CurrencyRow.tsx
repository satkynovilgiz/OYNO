import { Award, Coins, Gem, Star } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { colors, radii, shadows, spacing, typography } from '@/theme';

import type { ProfileSummary } from '../types';

type CurrencyRowProps = {
  profile: ProfileSummary;
};

export function CurrencyRow({ profile }: CurrencyRowProps) {
  const { t } = useTranslation();

  const items = [
    { id: 'coins', icon: Coins, color: colors.accentGold, label: t('profile.currencies.coins'), value: profile.coins.toLocaleString('ru-RU') },
    { id: 'xp', icon: Star, color: colors.primary, label: t('profile.currencies.xp'), value: profile.xpCurrent.toLocaleString('ru-RU') },
    { id: 'badges', icon: Award, color: colors.accentBrown, label: t('profile.currencies.badges'), value: String(profile.badges) },
    { id: 'tokens', icon: Gem, color: colors.discovery.animals, label: t('profile.currencies.tokens'), value: String(profile.tokens) },
  ] as const;

  return (
    <View style={styles.row}>
      {items.map((item) => (
        <View key={item.id} style={styles.card}>
          <View style={styles.headerRow}>
            <item.icon size={16} color={item.color} strokeWidth={2} />
            <Text style={styles.label} numberOfLines={1}>
              {item.label}
            </Text>
          </View>
          <Text style={styles.value}>{item.value}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  card: {
    flexGrow: 1,
    flexBasis: '45%',
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.sm,
    gap: spacing.xxs,
    ...shadows.card,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
  },
  label: {
    ...typography.small,
    color: colors.textSecondary,
  },
  value: {
    ...typography.h1,
    color: colors.textPrimary,
  },
});
