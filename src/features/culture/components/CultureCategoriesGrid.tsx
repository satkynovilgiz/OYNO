import { ChevronRight } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Image, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { AnimatedPressable, FadeSlideIn, TextButton } from '@/components/ui';
import { colors, radii, shadows, spacing, typography } from '@/theme';

import type { CultureCategory } from '../types';

type CultureCategoriesGridProps = {
  categories: CultureCategory[];
  onPressCategory?: (category: CultureCategory) => void;
  onPressSeeAll?: () => void;
};

/** Narrow phones (iPhone SE-class, ~375px and below) get 2 columns instead
 * of 3 - Kyrgyz category names like "Улуттук кийим"/"Кол өнөрчүлүк" need
 * more than a ~30%-width card to read as a real title instead of a
 * truncated fragment (Section "category title should never truncate
 * awkwardly"). */
export function CultureCategoriesGrid({ categories, onPressCategory, onPressSeeAll }: CultureCategoriesGridProps) {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const columns = width < 380 ? 2 : 3;
  const cardBasis = columns === 2 ? '47%' : '30%';

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
        {categories.map((category, index) => (
          <FadeSlideIn key={category.id} style={[styles.cardWrap, { flexBasis: cardBasis }]} index={index}>
            <AnimatedPressable
              style={styles.card}
              onPress={() => onPressCategory?.(category)}
              pressScale={1}
              hoverEffect
              accessibilityRole="button"
              accessibilityLabel={category.title}
            >
              <View style={styles.cardInner}>
                <Image source={category.imageSource} style={styles.image} resizeMode="cover" />
                <View style={styles.textBlock}>
                  <Text style={styles.title} numberOfLines={2}>
                    {category.title}
                  </Text>
                  <Text style={styles.progress}>
                    {category.current} / {category.total}
                  </Text>
                </View>
              </View>
            </AnimatedPressable>
          </FadeSlideIn>
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
  cardWrap: {
    flexGrow: 0,
  },
  card: {
    width: '100%',
    borderRadius: radii.lg,
    ...shadows.card,
  },
  cardInner: {
    width: '100%',
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    aspectRatio: 4 / 3,
    backgroundColor: colors.surfaceAlt,
  },
  textBlock: {
    padding: spacing.xs,
    gap: 2,
  },
  title: {
    ...typography.caption,
    color: colors.textPrimary,
    fontWeight: '700',
    lineHeight: 16,
  },
  progress: {
    ...typography.small,
    color: colors.textMuted,
  },
});
