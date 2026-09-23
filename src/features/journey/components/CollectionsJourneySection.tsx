import { router } from 'expo-router';
import { Check, ChevronRight } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Image, StyleSheet, Text, View } from 'react-native';

import { AnimatedPressable } from '@/components/ui';
import type { CollectionProgress } from '@/features/collections/collectionProgress';
import type { Collection } from '@/features/collections/collectionsData';
import type { SupportedLanguage } from '@/i18n';
import { colors, fontFamily, radii, spacing, typography } from '@/theme';

type CollectionsJourneySectionProps = {
  entries: { collection: Collection; progress: CollectionProgress }[];
  editorial: boolean;
};

/**
 * Culture Collections inside My Journey - completed ones are pressed as
 * gold seals at the top; the rest follow with their real "1 / 2" count.
 * Reads the SAME `computeCollectionProgress` result the Culture card and
 * the Collection detail screen use (passed in), never its own tally.
 */
export function CollectionsJourneySection({ entries, editorial }: CollectionsJourneySectionProps) {
  const { t, i18n } = useTranslation();
  const language = i18n.language as SupportedLanguage;

  const tracked = entries.filter((entry) => entry.progress.total > 0);
  if (tracked.length === 0) return null;
  const sorted = [...tracked].sort((a, b) => Number(b.progress.status === 'completed') - Number(a.progress.status === 'completed'));
  const completedCount = tracked.filter((entry) => entry.progress.status === 'completed').length;

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <Text style={[styles.title, editorial && styles.titleEditorial]}>{t('collections.sectionTitle')}</Text>
        <Text style={styles.count}>
          {completedCount} / {tracked.length}
        </Text>
      </View>
      {completedCount === 0 ? <Text style={styles.hint}>{t('journey.collections.empty')}</Text> : null}

      {sorted.map(({ collection, progress }) => {
        const done = progress.status === 'completed';
        const title = collection.title[language] ?? collection.title.kg;
        return (
          <AnimatedPressable
            key={collection.id}
            style={[styles.row, done && styles.rowDone]}
            onPress={() => router.push(`/collections/${collection.id}` as never)}
            hoverEffect
            accessibilityRole="button"
            accessibilityLabel={title}
          >
            <View style={[styles.seal, done && styles.sealDone]}>
              <Image source={collection.heroImage} style={[styles.sealImage, !done && styles.sealImageFaded]} resizeMode="cover" />
            </View>
            <View style={styles.rowText}>
              <Text style={[styles.rowTitle, done && styles.rowTitleDone, editorial && styles.titleEditorial]} numberOfLines={2}>
                {title}
              </Text>
              <Text style={[styles.rowMeta, done && styles.rowMetaDone]}>
                {done ? t('collections.status.completed') : t('collections.progress', { completed: progress.completed, total: progress.total })}
              </Text>
            </View>
            {done ? (
              <View style={styles.check}>
                <Check size={13} color={colors.textPrimary} strokeWidth={3} />
              </View>
            ) : (
              <ChevronRight size={18} color={colors.textMuted} strokeWidth={2} />
            )}
          </AnimatedPressable>
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
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  title: {
    ...typography.h1,
    color: colors.textPrimary,
  },
  titleEditorial: {
    fontFamily: fontFamily.wordmark,
  },
  count: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  hint: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radii.xl,
    backgroundColor: colors.surface,
  },
  rowDone: {
    backgroundColor: colors.surfaceFeature,
  },
  seal: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: 'dashed',
    padding: 3,
  },
  sealDone: {
    borderColor: colors.accentGold,
    borderStyle: 'solid',
    transform: [{ rotate: '-5deg' }],
  },
  sealImage: {
    width: '100%',
    height: '100%',
    borderRadius: 25,
  },
  sealImageFaded: {
    opacity: 0.55,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    ...typography.bodyBold,
    color: colors.textPrimary,
  },
  rowTitleDone: {
    color: colors.textOnDark,
  },
  rowMeta: {
    ...typography.small,
    color: colors.textSecondary,
  },
  rowMetaDone: {
    color: colors.accentGold,
  },
  check: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.accentGold,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
