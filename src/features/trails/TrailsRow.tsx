import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { EditorialCard, FadeSlideIn } from '@/components/ui';
import type { SupportedLanguage } from '@/i18n';
import { colors, spacing, typography } from '@/theme';

import { computeTrailProgress, type TrailProgress } from './trailProgress';
import { trails } from './trailsData';
import { useTrailSignals } from './useTrailSignals';

/** Real status for a trail card - "Start" / "Continue · 1/2" / "Completed". */
export function trailStatusLabel(progress: TrailProgress, t: (key: string) => string): string | undefined {
  if (progress.status === 'untracked') return undefined;
  if (progress.status === 'completed') return `✓ ${t('trails.status.completed')}`;
  if (progress.status === 'inProgress') return `${t('trails.status.continue')} · ${progress.completed}/${progress.total}`;
  return t('trails.status.start');
}

/** "Guided Trails" on Explore - one card per trail, same EditorialCard
 * family as Culture's Collections row. */
export function TrailsRow() {
  const { t, i18n } = useTranslation();
  const language = i18n.language as SupportedLanguage;
  const signals = useTrailSignals();

  return (
    <FadeSlideIn style={styles.section}>
      <Text style={styles.title}>{t('trails.sectionTitle')}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {trails.map((trail) => {
          const progress = computeTrailProgress(trail, signals);
          return (
            <View key={trail.id} style={styles.card}>
              <EditorialCard
                imageSource={trail.heroImage}
                title={trail.title[language] ?? trail.title.kg}
                titleLines={2}
                meta={trailStatusLabel(progress, t)}
                progress={progress.total > 0 ? { current: progress.completed, total: progress.total } : undefined}
                aspectRatio={4 / 3}
                onPress={() => router.push(`/trails/${trail.id}` as never)}
              />
            </View>
          );
        })}
      </ScrollView>
    </FadeSlideIn>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm },
  title: { ...typography.h1, color: colors.textPrimary, paddingHorizontal: spacing.md },
  row: { paddingHorizontal: spacing.md, gap: spacing.sm },
  card: { width: 200 },
});
