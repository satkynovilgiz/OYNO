import { router } from 'expo-router';
import { Check, ChevronRight } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Image, StyleSheet, Text, View } from 'react-native';

import { AnimatedPressable } from '@/components/ui';
import type { TrailProgress } from '@/features/trails/trailProgress';
import type { Trail } from '@/features/trails/trailsData';
import type { SupportedLanguage } from '@/i18n';
import { colors, fontFamily, radii, spacing, typography } from '@/theme';

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
  const shown = entries
    .filter((entry) => entry.progress.status === 'inProgress' || entry.progress.status === 'completed')
    .sort((a, b) => Number(b.progress.status === 'completed') - Number(a.progress.status === 'completed'));

  return (
    <View style={styles.section}>
      <Text style={[styles.title, editorial && styles.editorial]}>{t('trails.sectionTitle')}</Text>
      {shown.length === 0 ? <Text style={styles.hint}>{t('trails.journeyEmpty')}</Text> : null}
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
  title: { ...typography.h1, color: colors.textPrimary },
  editorial: { fontFamily: fontFamily.wordmark },
  hint: { ...typography.caption, color: colors.textSecondary },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm, borderRadius: radii.xl, backgroundColor: colors.surface },
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
