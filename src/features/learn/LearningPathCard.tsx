import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Image, StyleSheet, Text, View } from 'react-native';

import { AnimatedPressable, ProgressBar } from '@/components/ui';
import { cultureItemImages } from '@/features/culture/data';
import type { AgeExperience } from '@/services/ageExperience/types';
import { cardRadii, colors, editorial, spacing, textStyles, typography } from '@/theme';

import { LEARNING_PATHS, learnRoute, pathProgress, pickHomePath, type LearningPath, type PathProgress } from './learningPaths';
import { usePathSignals } from './usePathSignals';

/** Home: ONE compact Learning Paths card - the active path, else the first
 * suggested one. Nothing when every path is done. */
export function HomeLearningPathCard({ experience }: { experience: AgeExperience }) {
  const { t } = useTranslation();
  const { signals } = usePathSignals();
  const pick = pickHomePath(LEARNING_PATHS, signals);
  if (!pick) return null;
  return (
    <View style={{ gap: spacing.xs }}>
      <Text style={styles.section}>{t('learningPaths.title')}</Text>
      <PathRow path={pick.path} progress={pick.progress} large={experience === 'child'} editorialTitle={experience === 'adult'} />
    </View>
  );
}

/** Culture: the paths as a small list (no new tab). */
export function CultureLearningPaths({ experience }: { experience: AgeExperience }) {
  const { t } = useTranslation();
  const { signals } = usePathSignals();
  return (
    <View style={{ gap: spacing.xs }}>
      <Text style={styles.section}>{t('learningPaths.title')}</Text>
      {LEARNING_PATHS.map((path) => (
        <PathRow key={path.id} path={path} progress={pathProgress(path, signals)} large={false} editorialTitle={experience === 'adult'} />
      ))}
    </View>
  );
}

function PathRow({ path, progress, large, editorialTitle }: { path: LearningPath; progress: PathProgress; large: boolean; editorialTitle: boolean }) {
  const { t } = useTranslation();
  const hero = path.heroItemId ? cultureItemImages[path.heroItemId]?.[0] : null;
  const status = progress.done ? t('learningPaths.completed') : t('learningPaths.progress', { completed: progress.completed, total: progress.total });
  return (
    <AnimatedPressable style={[styles.row, large && styles.rowLarge]} onPress={() => router.push(learnRoute(path.id) as never)} press="soft" accessibilityRole="button" accessibilityLabel={`${t(path.titleKey)}. ${status}.`}>
      {hero ? <Image source={hero} style={[styles.thumb, large && styles.thumbLarge]} resizeMode="cover" /> : <View style={[styles.thumb, styles.thumbFallback]} />}
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={[styles.title, editorialTitle && styles.titleEditorial]} numberOfLines={2}>
          {t(path.titleKey)}
        </Text>
        <Text style={styles.meta}>{status}</Text>
        <ProgressBar progress={progress.completed / progress.total} height={large ? 6 : 3} fillColor={colors.accentGold} trackColor={colors.surfaceMuted} />
      </View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  section: { ...typography.overline, color: colors.accentTerracottaText },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.borderSubtle },
  rowLarge: { padding: spacing.md },
  thumb: { width: 56, height: 56, borderRadius: 12 },
  thumbLarge: { width: 72, height: 72 },
  thumbFallback: { backgroundColor: colors.surfaceFeature },
  title: { ...textStyles.bodyMedium, fontWeight: '700', color: colors.textPrimary },
  titleEditorial: { ...editorial(textStyles.bodyMedium) },
  meta: { ...textStyles.small, color: colors.textSecondary },
});
