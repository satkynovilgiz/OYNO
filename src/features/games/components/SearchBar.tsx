import { Search, SlidersHorizontal, X } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet, TextInput, View } from 'react-native';

import { AnimatedPressable } from '@/components/ui';
import { colors, radii, shadows, spacing, typography } from '@/theme';

type SearchBarProps = {
  value: string;
  onChangeText: (value: string) => void;
  onPressFilter?: () => void;
};

export function SearchBar({ value, onChangeText, onPressFilter }: SearchBarProps) {
  const { t } = useTranslation();

  return (
    <View style={styles.row}>
      <View style={styles.field}>
        <Search size={16} color={colors.textSecondary} strokeWidth={2} />
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={t('games.searchPlaceholder')}
          placeholderTextColor={colors.textMuted}
          style={styles.input}
        />
        {value.length > 0 ? (
          <AnimatedPressable
            onPress={() => onChangeText('')}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t('common.cancel')}
          >
            <X size={16} color={colors.textMuted} strokeWidth={2.25} />
          </AnimatedPressable>
        ) : null}
      </View>

      {/* Only shown when a caller actually handles it - never a dead button. */}
      {onPressFilter ? (
        <AnimatedPressable
          style={styles.filterButton}
          onPress={onPressFilter}
          haptic="light"
          accessibilityRole="button"
          accessibilityLabel={t('games.filterLabel')}
        >
          <SlidersHorizontal size={16} color={colors.textPrimary} strokeWidth={2} />
        </AnimatedPressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  field: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    height: 48,
    borderRadius: radii.pill,
    borderWidth: 1.5,
    borderColor: colors.surfaceBorder,
    ...shadows.card,
  },
  input: {
    flex: 1,
    ...typography.body,
    color: colors.textPrimary,
  },
  filterButton: {
    width: 48,
    height: 48,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.surfaceBorder,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.card,
  },
});
