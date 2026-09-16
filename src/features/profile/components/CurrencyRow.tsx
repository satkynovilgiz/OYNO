import { Award, Coins, Gem, Star } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { FadeSlideIn } from '@/components/ui';
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
      {items.map((item, index) => (
        <FadeSlideIn key={item.id} style={styles.cardWrap} index={index}>
          <View style={styles.card}>
            <View style={[styles.iconWrap, { backgroundColor: `${item.color}1F` }]}>
              <item.icon size={16} color={item.color} strokeWidth={2.25} />
            </View>
            <View style={styles.textBlock}>
              <Text style={styles.value} numberOfLines={1}>
                {item.value}
              </Text>
              <Text style={styles.label} numberOfLines={1}>
                {item.label}
              </Text>
            </View>
          </View>
        </FadeSlideIn>
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
  cardWrap: {
    flexGrow: 1,
    flexBasis: '45%',
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    ...shadows.card,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textBlock: {
    flexShrink: 1,
  },
  label: {
    ...typography.small,
    color: colors.textSecondary,
  },
  value: {
    ...typography.h2,
    color: colors.textPrimary,
  },
});
