import { router } from 'expo-router';
import { GraduationCap } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { OymoOrnament } from '@/components/patterns/OymoOrnament';
import { AnimatedPressable, MediaCard, Rail, SectionHeader, useRailItemWidth } from '@/components/ui';
import { collectionQuestionIds } from '@/features/challenges/challengeLogic';
import { collections, type Collection } from '@/features/collections/collectionsData';
import type { SupportedLanguage } from '@/i18n';
import { useCultureItems } from '@/services/content/cultureItemsService';
import type { CultureItemRow } from '@/services/content/types';
import { cardRadii, colors, spacing, textStyles } from '@/theme';

import { cultureCategoryImages, cultureItemImages } from '../data';
import type { CultureCategoryId } from '../types';

/** Editorial section divider: a hairline with a small oymo in the middle. */
export function OymoDivider() {
  return (
    <View style={styles.divider} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={styles.rule} />
      <OymoOrnament size={10} color={colors.accentGoldPressed} strokeWidth={1.75} />
      <View style={styles.rule} />
    </View>
  );
}

/** The real collection that includes this item AND has a real Knowledge
 * Challenge (questions sourced from that collection) - or null. */
export function challengeCollectionFor(itemId: string): Collection | null {
  return collections.find((collection) => collection.sections.some((ref) => ref.kind === 'culture_item' && ref.id === itemId) && collectionQuestionIds(collection).length > 0) ?? null;
}

/** Subtle "Test your knowledge" link to an existing collection challenge. */
export function TestKnowledgeLink({ collection }: { collection: Collection }) {
  const { t, i18n } = useTranslation();
  const title = collection.title[i18n.language as SupportedLanguage] ?? collection.title.kg;
  const count = collectionQuestionIds(collection).length;
  return (
    <AnimatedPressable
      style={styles.test}
      onPress={() => router.push(`/challenges/collection-${collection.id}` as never)}
      press="soft"
      accessibilityRole="button"
      accessibilityLabel={`${t('culture.v2.testKnowledge')}. ${title}. ${t('challenges.questionCount', { count })}`}
    >
      <View style={styles.testIcon}>
        <GraduationCap size={18} color={colors.primary} strokeWidth={2.25} />
      </View>
      <View style={styles.testText}>
        <Text style={styles.testTitle}>{t('culture.v2.testKnowledge')}</Text>
        <Text style={styles.testMeta} numberOfLines={1}>
          {title} · {t('challenges.questionCount', { count })}
        </Text>
      </View>
    </AnimatedPressable>
  );
}

/** "Keep reading": other real items from the same category (the existing
 * relationship), as compact cards. Renders nothing when there are none. */
export function RelatedItemsRail({ item }: { item: CultureItemRow }) {
  const { t } = useTranslation();
  const { data } = useCultureItems(item.category_id);
  const width = useRailItemWidth('compact', 0.42);
  const related = (data ?? []).filter((row) => row.id !== item.id).slice(0, 6);
  if (related.length === 0) return null;
  const fallback = cultureCategoryImages[item.category_id as CultureCategoryId] ?? null;
  return (
    <View style={styles.section}>
      <SectionHeader title={t('culture.v2.relatedTitle')} size="sm" />
      <Rail itemWidth={width}>
        {related.map((row) => (
          <MediaCard
            key={row.id}
            variant="compact"
            width={width}
            aspectRatio={0.95}
            source={cultureItemImages[row.id]?.[0] ?? fallback}
            title={row.title}
            titleLines={3}
            onPress={() => router.push(`/culture/item/${row.id}` as never)}
            accessibilityLabel={row.title}
          />
        ))}
      </Rail>
    </View>
  );
}

const styles = StyleSheet.create({
  divider: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xs },
  rule: { flex: 1, height: StyleSheet.hairlineWidth * 2, backgroundColor: colors.borderSubtle },
  section: { gap: spacing.sm },
  test: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceElevated },
  testIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceMuted },
  testText: { flex: 1, gap: 1, minWidth: 0 },
  testTitle: { ...textStyles.title, fontSize: 16, color: colors.textPrimary },
  testMeta: { ...textStyles.caption, color: colors.textSecondary },
});
