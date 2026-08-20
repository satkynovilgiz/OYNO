import { ScrollView, StyleSheet, Text } from 'react-native';

import { AnimatedPressable } from '@/components/ui';
import { colors, radii, spacing, typography } from '@/theme';

import { mockGameCategories } from '../mockData';
import type { GameListItem } from '../types';

type CategoryFiltersProps = {
  active: GameListItem['category'] | 'all';
  onSelect: (category: GameListItem['category'] | 'all') => void;
};

export function CategoryFilters({ active, onSelect }: CategoryFiltersProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      {mockGameCategories.map((category) => {
        const isActive = category.id === active;
        return (
          <AnimatedPressable
            key={category.id}
            style={[styles.pill, isActive && styles.pillActive]}
            onPress={() => onSelect(category.id)}
            accessibilityRole="button"
            accessibilityLabel={category.label}
          >
            <Text style={[styles.label, isActive && styles.labelActive]}>{category.label}</Text>
          </AnimatedPressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingHorizontal: spacing.md,
    gap: spacing.xs,
  },
  pill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
  },
  pillActive: {
    backgroundColor: colors.primary,
  },
  label: {
    ...typography.caption,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  labelActive: {
    color: colors.textOnPrimary,
  },
});
