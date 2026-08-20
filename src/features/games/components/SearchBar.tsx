import { Search, SlidersHorizontal } from 'lucide-react-native';
import { StyleSheet, TextInput, View } from 'react-native';

import { AnimatedPressable } from '@/components/ui';
import { colors, radii, shadows, spacing, typography } from '@/theme';

type SearchBarProps = {
  value: string;
  onChangeText: (value: string) => void;
  onPressFilter?: () => void;
};

export function SearchBar({ value, onChangeText, onPressFilter }: SearchBarProps) {
  return (
    <View style={styles.row}>
      <View style={styles.field}>
        <Search size={16} color={colors.textSecondary} strokeWidth={2} />
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder="Оюн издеңиз..."
          placeholderTextColor={colors.textMuted}
          style={styles.input}
        />
      </View>

      <AnimatedPressable
        style={styles.filterButton}
        onPress={onPressFilter}
        accessibilityRole="button"
        accessibilityLabel="Фильтр"
      >
        <SlidersHorizontal size={16} color={colors.textPrimary} strokeWidth={2} />
      </AnimatedPressable>
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
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.card,
  },
});
