import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { EditorialCard, FadeSlideIn } from '@/components/ui';
import type { SupportedLanguage } from '@/i18n';
import { colors, spacing, typography } from '@/theme';

import { computeCollectionProgress, type CollectionProgress } from '../collectionProgress';
import type { Collection } from '../collectionsData';
import { useCollectionSignals } from '../useCollectionProgress';

type CollectionsRowProps = {
  collections: Collection[];
  onPressCollection: (id: string) => void;
};

function resolveLocalized(text: { kg: string; ru: string; en: string }, language: SupportedLanguage): string {
  return text[language] ?? text.kg;
}

/** Small, additive integration into Culture (spec "Integrate a small
 * 'Collections' section into Culture without redesigning the existing
 * Culture page") - one more horizontal row using the same `EditorialCard`
 * family the category grid already uses, not a new visual language. */
export function CollectionsRow({ collections, onPressCollection }: CollectionsRowProps) {
  const { t, i18n } = useTranslation();
  const language = i18n.language as SupportedLanguage;
  const signals = useCollectionSignals();

  /** "Explore" / "Continue · 1/2" / "Completed" - only from real progress;
   * a collection with nothing trackable shows no badge at all. */
  function statusLabel(progress: CollectionProgress): string | undefined {
    if (progress.status === 'untracked') return undefined;
    if (progress.status === 'completed') return `✓ ${t('collections.status.completed')}`;
    if (progress.status === 'inProgress') return `${t('collections.status.continue')} · ${progress.completed}/${progress.total}`;
    return t('collections.status.explore');
  }

  if (collections.length === 0) return null;

  return (
    <FadeSlideIn style={styles.section}>
      <Text style={styles.sectionTitle}>{t('collections.sectionTitle')}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {collections.map((collection) => (
          <View key={collection.id} style={styles.card}>
            {(() => {
              const progress = computeCollectionProgress(collection, signals);
              return (
                <EditorialCard
                  imageSource={collection.heroImage}
                  title={resolveLocalized(collection.title, language)}
                  titleLines={2}
                  meta={statusLabel(progress)}
                  progress={progress.total > 0 ? { current: progress.completed, total: progress.total } : undefined}
                  aspectRatio={4 / 3}
                  onPress={() => onPressCollection(collection.id)}
                />
              );
            })()}
          </View>
        ))}
      </ScrollView>
    </FadeSlideIn>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.sm,
  },
  sectionTitle: {
    ...typography.h1,
    color: colors.textPrimary,
    paddingHorizontal: spacing.md,
  },
  row: {
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  card: {
    width: 200,
  },
});
