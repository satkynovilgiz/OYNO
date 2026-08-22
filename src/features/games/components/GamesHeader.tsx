import { Plus } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { OymoOrnament } from '@/components/patterns/OymoOrnament';
import { AnimatedPressable } from '@/components/ui';
import { colors, radii, spacing, typography } from '@/theme';

type GamesHeaderProps = {
  coins: number;
  tokens: number;
  onPressAddCoins?: () => void;
  onPressAddTokens?: () => void;
};

export function GamesHeader({ coins, tokens, onPressAddCoins, onPressAddTokens }: GamesHeaderProps) {
  const { t } = useTranslation();

  return (
    <View style={styles.container}>
      <View style={styles.titleRow}>
        <Text style={styles.title}>{t('games.title')}</Text>
        <OymoOrnament size={20} color={colors.primary} strokeWidth={1.5} />
      </View>
      <Text style={styles.subtitle}>{t('games.subtitle')}</Text>

      <View style={styles.currencyRow}>
        <CurrencyChip label={coins.toLocaleString('ru-RU')} tone="gold" onPress={onPressAddCoins} />
        <CurrencyChip label={tokens.toLocaleString('ru-RU')} tone="silver" onPress={onPressAddTokens} />
      </View>
    </View>
  );
}

function CurrencyChip({
  label,
  tone,
  onPress,
}: {
  label: string;
  tone: 'gold' | 'silver';
  onPress?: () => void;
}) {
  const dotColor = tone === 'gold' ? colors.accentGold : colors.accentSilver;
  return (
    <View style={styles.chip}>
      <View style={[styles.chipDot, { backgroundColor: dotColor }]} />
      <Text style={styles.chipLabel}>{label}</Text>
      <AnimatedPressable
        style={styles.chipAdd}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel="Толуктоо"
      >
        <Plus size={12} color={colors.textOnPrimary} strokeWidth={2.5} />
      </AnimatedPressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.md,
    gap: spacing.xxs,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  title: {
    ...typography.display,
    color: colors.textPrimary,
  },
  subtitle: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  currencyRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
    backgroundColor: colors.surfaceAlt,
    paddingLeft: spacing.sm,
    paddingRight: spacing.xxs,
    paddingVertical: spacing.xxs,
    borderRadius: radii.pill,
  },
  chipDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  chipLabel: {
    ...typography.caption,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  chipAdd: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
