import { ChevronRight } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { EditorialCard, FadeSlideIn, TextButton } from '@/components/ui';
import { colors, spacing, typography } from '@/theme';

import type { CultureCategory } from '../types';

type CultureCategoriesGridProps = {
  categories: CultureCategory[];
  onPressCategory?: (category: CultureCategory) => void;
  onPressSeeAll?: () => void;
};

/** Editorial "browse culture" section (Section "Replace the rigid
 * 3-column category grid... one large featured category + smaller
 * supporting cards") - the first category leads as a wide feature card,
 * the rest sit in a relaxed 2-column row underneath. Boz Uy/Oymo/Shyrdak/
 * etc. no longer all render as identical same-size database tiles; the
 * one featured slot rotates with whatever the catalog returns first
 * rather than hardcoding a specific category id. */
export function CultureCategoriesGrid({ categories, onPressCategory, onPressSeeAll }: CultureCategoriesGridProps) {
  const { t } = useTranslation();
  const [featured, ...rest] = categories;

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

      {featured ? (
        <FadeSlideIn style={styles.horizontalPad} index={0}>
          <EditorialCard
            imageSource={featured.imageSource}
            title={featured.title}
            meta={`${featured.current} / ${featured.total}`}
            aspectRatio={16 / 9}
            size="feature"
            onPress={() => onPressCategory?.(featured)}
          />
        </FadeSlideIn>
      ) : null}

      <View style={[styles.grid, styles.horizontalPad]}>
        {rest.map((category, index) => (
          <FadeSlideIn key={category.id} style={styles.cardWrap} index={index + 1}>
            <EditorialCard
              imageSource={category.imageSource}
              title={category.title}
              meta={`${category.current} / ${category.total}`}
              onPress={() => onPressCategory?.(category)}
            />
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
  horizontalPad: {
    paddingHorizontal: spacing.md,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  cardWrap: {
    flexBasis: '44%',
    flexGrow: 1,
  },
});
