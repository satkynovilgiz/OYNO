import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { MediaCard, ProgressBar, Rail, SectionHeader, useRailItemWidth } from '@/components/ui';
import type { SupportedLanguage } from '@/i18n';
import type { AgeExperience } from '@/services/ageExperience/types';
import { colors, spacing, textStyles } from '@/theme';

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

/** CTA word only (no count) for a trail card. */
function trailCta(progress: TrailProgress, t: (key: string) => string): string | undefined {
  if (progress.status === 'completed' || progress.status === 'untracked') return undefined;
  return t(progress.status === 'inProgress' ? 'trails.status.continue' : 'trails.status.start');
}

/**
 * Guided Trails as curated journeys: cinematic landscape card, trail
 * title, real stop count, real tracked progress and Start / Continue.
 * No durations (none exist in the data).
 */
export function TrailsRow({ experience = 'teen' }: { experience?: AgeExperience }) {
  const { t, i18n } = useTranslation();
  const language = i18n.language as SupportedLanguage;
  const signals = useTrailSignals();
  const width = useRailItemWidth('medium', experience === 'child' ? 0.8 : 0.74);

  return (
    <View style={styles.section}>
      <SectionHeader title={t('trails.sectionTitle')} editorialTitle={experience === 'adult'} />
      <Rail itemWidth={width} snap>
        {trails.map((trail) => {
          const progress = computeTrailProgress(trail, signals);
          const title = trail.title[language] ?? trail.title.kg;
          const done = progress.status === 'completed';
          return (
            <MediaCard
              key={trail.id}
              variant="landscape"
              width={width}
              aspectRatio={1.3}
              source={trail.heroImage}
              eyebrow={done ? `✓ ${t('trails.status.completed')}` : t('trails.kicker')}
              title={title}
              editorialTitle={experience === 'adult'}
              footer={
                <View style={styles.meta}>
                  <Text style={styles.metaText} numberOfLines={1}>
                    {t('explore.v2.stops', { count: trail.steps.length })}
                  </Text>
                  {progress.total > 0 ? <ProgressBar progress={progress.completed / progress.total} height={3} fillColor={colors.accentGold} trackColor="rgba(251,243,227,0.24)" /> : null}
                </View>
              }
              cta={trailCta(progress, t)}
              ctaSize="sm"
              ctaPlacement="inline"
              onPress={() => router.push(`/trails/${trail.id}` as never)}
              accessibilityLabel={`${title}. ${t('explore.v2.stops', { count: trail.steps.length })}. ${trailStatusLabel(progress, t) ?? ''}`}
            />
          );
        })}
      </Rail>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm },
  meta: { gap: 6, maxWidth: 200 },
  metaText: { ...textStyles.caption, fontWeight: '600', color: colors.textOnDarkSecondary },
});
