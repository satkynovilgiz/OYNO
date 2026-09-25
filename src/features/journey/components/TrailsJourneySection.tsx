import { router } from 'expo-router';
import { Check, ChevronRight } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Image, StyleSheet, Text, View } from 'react-native';

import { AnimatedPressable, MediaCard, ProgressBar } from '@/components/ui';
import type { TrailProgress } from '@/features/trails/trailProgress';
import type { Trail } from '@/features/trails/trailsData';
import type { SupportedLanguage } from '@/i18n';
import { colors, fontFamily, radii, spacing, textStyles, typography } from '@/theme';

type TrailsJourneySectionProps = {
  entries: { trail: Trail; progress: TrailProgress }[];
  editorial: boolean;
};

/** Active and completed Guided Trails inside My Journey - reads the SAME
 * `computeTrailProgress` result the trail screen uses (passed in). Trails
 * not started yet aren't listed here; they live on Explore. */
export function TrailsJourneySection({ entries, editorial }: TrailsJourneySectionProps) {
  const { t, i18n } = useTranslation();
  const language = i18n.language as SupportedLanguage;
  // The active trail (in progress) is the prominent card; with none active,
  // the first real trail not yet started is offered as "Start". Completed
  // trails move to the smaller history rows below.
  const active = entries.find((entry) => entry.progress.status === 'inProgress') ?? entries.find((entry) => entry.progress.status === 'unstarted') ?? null;
  const shown = entries.filter((entry) => entry.progress.status === 'completed');

  return (
    <View style={styles.section}>
      <Text style={[styles.title, editorial && styles.editorial]}>{t('trails.sectionTitle')}</Text>
      {active ? (
        <MediaCard
          variant="landscape"
          aspectRatio={1.7}
          source={active.trail.heroImage}
          eyebrow={active.progress.status === 'inProgress' ? t('journey.v2.activeTrail') : t('journey.v2.startTrail')}
          title={active.trail.title[language] ?? active.trail.title.kg}
          editorialTitle={editorial}
          footer={
            active.progress.total > 0 ? (
              <View style={styles.activeMeta}>
                <Text style={styles.activeText}>{t('trails.progress', { completed: active.progress.completed, total: active.progress.total })}</Text>
                <ProgressBar progress={active.progress.completed / active.progress.total} height={3} fillColor={colors.accentGold} trackColor="rgba(251,243,227,0.24)" />
              </View>
            ) : undefined
          }
          cta={t(active.progress.status === 'inProgress' ? 'trails.status.continue' : 'trails.status.start')}
          ctaSize="sm"
          ctaPlacement="inline"
          onPress={() => router.push(`/trails/${active.trail.id}` as never)}
          accessibilityLabel={`${active.trail.title[language] ?? active.trail.title.kg}. ${t('trails.progress', { completed: active.progress.completed, total: active.progress.total })}`}
        />
      ) : null}
      {!active && shown.length === 0 ? <Text style={styles.hint}>{t('trails.journeyEmpty')}</Text> : null}
      {shown.map(({ trail, progress }) => {
        const done = progress.status === 'completed';
        const title = trail.title[language] ?? trail.title.kg;
        return (
          <AnimatedPressable
            key={trail.id}
            style={[styles.row, done && styles.rowDone]}
            onPress={() => router.push(`/trails/${trail.id}` as never)}
            hoverEffect
            accessibilityRole="button"
            accessibilityLabel={`${title}, ${done ? t('trails.status.completed') : t('trails.progress', { completed: progress.completed, total: progress.total })}`}
          >
            <Image source={trail.heroImage} style={[styles.thumb, done && styles.thumbDone]} resizeMode="cover" />
            <View style={styles.text}>
              <Text style={[styles.rowTitle, done && styles.rowTitleDone, editorial && styles.editorial]} numberOfLines={2}>
                {title}
              </Text>
              <Text style={[styles.meta, done && styles.metaDone]}>
                {done ? t('trails.status.completed') : t('trails.progress', { completed: progress.completed, total: progress.total })}
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
  section: { gap: spacing.sm },
  title: { ...textStyles.h2, color: colors.textPrimary },
  activeMeta: { gap: 5, maxWidth: 220 },
  activeText: { ...textStyles.caption, fontWeight: '600', color: colors.textOnDarkSecondary },
  editorial: { fontFamily: fontFamily.wordmark },
  hint: { ...typography.caption, color: colors.textSecondary },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm, borderRadius: radii.xl, backgroundColor: colors.surfaceElevated },
  rowDone: { backgroundColor: colors.surfaceFeature },
  thumb: { width: 56, height: 56, borderRadius: 28, borderWidth: 2, borderColor: colors.border },
  thumbDone: { borderColor: colors.accentGold },
  text: { flex: 1, gap: 2 },
  rowTitle: { ...typography.bodyBold, color: colors.textPrimary },
  rowTitleDone: { color: colors.textOnDark },
  meta: { ...typography.small, color: colors.textSecondary },
  metaDone: { color: colors.accentGold },
  check: { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.accentGold, alignItems: 'center', justifyContent: 'center' },
});
