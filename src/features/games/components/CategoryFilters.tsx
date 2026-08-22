import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text } from 'react-native';

import { AnimatedPressable } from '@/components/ui';
import { colors, radii, spacing, typography } from '@/theme';

import type { GameListItem } from '../types';

type CategoryFiltersProps = {
  active: GameListItem['category'] | 'all';
  onSelect: (category: GameListItem['category'] | 'all') => void;
};

const CATEGORY_IDS: (GameListItem['category'] | 'all')[] = [
  'all',
  'national',
  'horse',
  'team',
  'logic',
  'skill',
  'cooking',
];

export function CategoryFilters({ active, onSelect }: CategoryFiltersProps) {
  const { t } = useTranslation();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      {CATEGORY_IDS.map((categoryId) => {
        const isActive = categoryId === active;
        const label = t(`games.categories.${categoryId}`);
        return (
          <AnimatedPressable
            key={categoryId}
            style={[styles.pill, isActive && styles.pillActive]}
            onPress={() => onSelect(categoryId)}
            accessibilityRole="button"
            accessibilityLabel={label}
          >
            <Text style={[styles.label, isActive && styles.labelActive]}>{label}</Text>
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
