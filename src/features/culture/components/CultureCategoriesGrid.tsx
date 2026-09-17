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

/** Editorial "browse culture" section (Section "one large featured
 * category + smaller supporting cards... should NOT all look like
 * identical database tiles"). One featured card alone wasn't enough -
 * with 10 categories, the other 9 still read as one long repeated
 * template. Instead, after the lead feature, the rest are grouped in
 * threes: one wide "spotlight" card + a square pair, repeating - so the
 * rhythm keeps breaking instead of settling into a flat grid. */
export function CultureCategoriesGrid({ categories, onPressCategory, onPressSeeAll }: CultureCategoriesGridProps) {
  const { t } = useTranslation();
  const [featured, ...rest] = categories;

  const groups: CultureCategory[][] = [];
  for (let i = 0; i < rest.length; i += 3) {
    groups.push(rest.slice(i, i + 3));
  }

  let cardIndex = 1;

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
            progress={{ current: featured.current, total: featured.total }}
            aspectRatio={16 / 9}
            size="feature"
            onPress={() => onPressCategory?.(featured)}
          />
        </FadeSlideIn>
      ) : null}

      {groups.map((group, groupIndex) => {
        const [spotlight, ...pair] = group;
        return (
          <View key={groupIndex} style={[styles.horizontalPad, styles.group]}>
            {spotlight ? (
              <FadeSlideIn index={cardIndex++}>
                <EditorialCard
                  imageSource={spotlight.imageSource}
                  title={spotlight.title}
                  meta={`${spotlight.current} / ${spotlight.total}`}
                  progress={{ current: spotlight.current, total: spotlight.total }}
                  aspectRatio={2}
                  onPress={() => onPressCategory?.(spotlight)}
                />
              </FadeSlideIn>
            ) : null}

            {pair.length > 0 ? (
              <View style={styles.grid}>
                {pair.map((category) => (
                  <FadeSlideIn key={category.id} style={styles.cardWrap} index={cardIndex++}>
                    <EditorialCard
                      imageSource={category.imageSource}
                      title={category.title}
                      meta={`${category.current} / ${category.total}`}
                      progress={{ current: category.current, total: category.total }}
                      onPress={() => onPressCategory?.(category)}
                    />
                  </FadeSlideIn>
                ))}
              </View>
            ) : null}
          </View>
        );
      })}
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
  group: {
    gap: spacing.sm,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  cardWrap: {
    flexBasis: '44%',
    flexGrow: 1,
  },
});
