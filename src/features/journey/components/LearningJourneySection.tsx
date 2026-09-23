import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { OymoOrnament } from '@/components/patterns/OymoOrnament';
import { AnimatedPressable } from '@/components/ui';
import { getCollection } from '@/features/collections/collectionsData';
import { formatDayLabel } from '@/features/daily/formatDayLabel';
import type { SupportedLanguage } from '@/i18n';
import { useChallengeStore } from '@/store/useChallengeStore';
import { colors, fontFamily, radii, spacing, typography } from '@/theme';

const MAX_ROWS = 5;

/**
 * "Learning" in My Journey - completed Knowledge Challenges with their real
 * scores, newest first. Deliberately separate from Passport stamps and
 * discovery progress (a quiz answer never counts as a discovery).
 */
export function LearningJourneySection({ editorial }: { editorial: boolean }) {
  const { t, i18n } = useTranslation();
  const language = i18n.language as SupportedLanguage;
  const results = useChallengeStore((state) => state.results);

  const completed = Object.entries(results)
    .filter(([, result]) => !!result.completedAt)
    .sort(([, a], [, b]) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''))
    .slice(0, MAX_ROWS);

  function label(id: string): string {
    if (id.startsWith('daily:')) return `${t('challenges.daily.title')} · ${formatDayLabel(id.slice('daily:'.length), language)}`;
    if (id.startsWith('collection:')) {
      const collection = getCollection(id.slice('collection:'.length));
      return collection ? (collection.title[language] ?? collection.title.kg) : id;
    }
    return t('challenges.journey.title');
  }

  return (
    <View style={styles.section}>
      <Text style={[styles.title, editorial && styles.editorial]}>{t('challenges.journeySection')}</Text>
      {completed.length === 0 ? (
        <AnimatedPressable onPress={() => router.push('/challenges' as never)} accessibilityRole="button" accessibilityLabel={t('challenges.journeyEmpty')}>
          <Text style={styles.hint}>{t('challenges.journeyEmpty')} →</Text>
        </AnimatedPressable>
      ) : (
        completed.map(([id, result]) => (
          <AnimatedPressable
            key={id}
            style={styles.row}
            onPress={() => router.push('/challenges' as never)}
            hoverEffect
            accessibilityRole="button"
            accessibilityLabel={`${label(id)}, ${t('challenges.resultTitle', { correct: result.lastCorrect, total: result.lastTotal })}`}
          >
            <OymoOrnament size={12} color={colors.accentGoldPressed} strokeWidth={1.75} />
            <Text style={styles.rowTitle} numberOfLines={1}>
              {label(id)}
            </Text>
            <Text style={styles.score}>
              {result.lastCorrect} / {result.lastTotal}
            </Text>
          </AnimatedPressable>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm },
  title: { ...typography.h1, color: colors.textPrimary },
  editorial: { fontFamily: fontFamily.wordmark },
  hint: { ...typography.caption, color: colors.primary, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm, borderRadius: radii.lg, backgroundColor: colors.surface },
  rowTitle: { ...typography.bodyBold, color: colors.textPrimary, flex: 1 },
  score: { ...typography.bodyBold, color: colors.primary },
});
