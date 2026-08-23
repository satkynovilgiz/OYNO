import { ChevronRight } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Image, StyleSheet, Text, View } from 'react-native';

import { AnimatedPressable, TextButton } from '@/components/ui';
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
        <TextButton
          label={t('common.seeAll')}
          onPress={onPressSeeAll}
          trailingIcon={<ChevronRight size={14} color={colors.primary} strokeWidth={2.25} />}
        />
      </View>

      <View style={styles.grid}>
        {categories.map((category) => (
          <AnimatedPressable
            key={category.id}
            style={styles.card}
            onPress={() => onPressCategory?.(category)}
            pressScale={0.98}
            hoverEffect
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
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  card: {
    flexGrow: 0,
    flexBasis: '30%',
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
