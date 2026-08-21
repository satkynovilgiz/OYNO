import { ChevronRight } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Image, StyleSheet, Text, View } from 'react-native';

import { AnimatedPressable } from '@/components/ui';
import { colors, radii, shadows, spacing, typography } from '@/theme';

import type { CultureCategory } from '../types';

type CultureCategoriesGridProps = {
  categories: CultureCategory[];
  onPressCategory?: (category: CultureCategory) => void;
  onPressSeeAll?: () => void;
};

export function CultureCategoriesGrid({ categories, onPressCategory, onPressSeeAll }: CultureCategoriesGridProps) {
  const { t } = useTranslation();

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <Text style={styles.sectionTitle}>{t('culture.categoriesTitle')}</Text>
        <AnimatedPressable style={styles.seeAll} onPress={onPressSeeAll} accessibilityRole="button">
          <Text style={styles.seeAllText}>{t('common.seeAll')}</Text>
          <ChevronRight size={14} color={colors.primary} strokeWidth={2.25} />
        </AnimatedPressable>
      </View>

      <View style={styles.grid}>
        {categories.map((category) => (
          <AnimatedPressable
            key={category.id}
            style={styles.card}
            onPress={() => onPressCategory?.(category)}
            accessibilityRole="button"
            accessibilityLabel={category.title}
          >
            <Image source={category.imageSource} style={styles.image} resizeMode="cover" />
            <Text style={styles.title} numberOfLines={1}>
              {category.title}
            </Text>
            <Text style={styles.progress}>
              {category.current} / {category.total}
            </Text>
          </AnimatedPressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
  },
  sectionTitle: {
    ...typography.h1,
    color: colors.textPrimary,
  },
  seeAll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  seeAllText: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '700',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  card: {
    flexGrow: 1,
    flexBasis: '17%',
    minWidth: 90,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.xxs,
    gap: 2,
    ...shadows.card,
  },
  image: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceAlt,
  },
  title: {
    ...typography.caption,
    color: colors.textPrimary,
    fontWeight: '700',
    marginTop: 2,
  },
  progress: {
    ...typography.small,
    color: colors.textMuted,
  },
});
