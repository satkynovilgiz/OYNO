import { router } from 'expo-router';
import { Check, ChevronLeft, ChevronRight, Circle, Share2 } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { OymoOrnament } from '@/components/patterns/OymoOrnament';
import { NotFoundState } from '@/components/system/NotFoundState';
import { AnimatedPressable, Button, IconButton, MediaImage, ProgressBar } from '@/components/ui';
import { cultureItemImages } from '@/features/culture/data';
import { useAgeExperience } from '@/services/ageExperience/useAgeExperience';
import { useShareCard } from '@/services/share/useShareCard';
import { useLearningPathStore } from '@/store/useLearningPathStore';
import { colors, editorial, radii, spacing, textStyles, typography } from '@/theme';

import { buildPathShareCard } from './learningPathShare';
import { isManualStep, LEARNING_PATHS, pathProgress, type StepState } from './learningPaths';
import { usePathSignals } from './usePathSignals';
import { useStepDisplay } from './useStepDisplay';

/** Opens a step with `fromPath` so the app can offer "Back to Learning Path". */
export function openStep(route: string, pathId: string) {
  router.push(`${route}${route.includes('?') ? '&' : '?'}fromPath=${pathId}` as never);
}

/**
 * /learn/[id] - one Learning Path: hero, title, description, real
 * progress, ordered steps (any step can be opened - no locking), Continue
 * -> the first unfinished step. Completion comes from existing signals;
 * steps without one offer "Mark step complete".
 */
export function LearningPathScreen({ pathId, onPressBack }: { pathId: string; onPressBack: () => void }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { experience } = useAgeExperience();
  const isChild = experience === 'child';
  const isAdult = experience === 'adult';
  const { signals, owner } = usePathSignals();
  const display = useStepDisplay();
  const { share, shareHost } = useShareCard();
  const path = LEARNING_PATHS.find((candidate) => candidate.id === pathId);
  if (!path) return <NotFoundState onPressBack={onPressBack} />;

  const progress = pathProgress(path, signals);
  const hero = path.heroItemId ? (cultureItemImages[path.heroItemId]?.[0] ?? null) : null;
  const title = t(path.titleKey);
  const next = progress.nextIndex !== null ? path.steps[progress.nextIndex] : null;
  const nextRoute = next ? display(next).route : null;
  const stateLabel = (state: StepState) => t(`learningPaths.state.${state}`);

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xl }}>
        <View style={[styles.hero, isChild && styles.heroChild]}>
          {hero ? <MediaImage source={hero} /> : null}
          <View style={[styles.heroTop, { paddingTop: insets.top + spacing.sm }]}>
            <IconButton icon={ChevronLeft} shape="roundedSquare" accessibilityLabel={t('common.back')} onPress={onPressBack} />
          </View>
        </View>
        <View style={styles.body}>
          <Text style={styles.kicker}>{t('learningPaths.title')}</Text>
          <Text style={[styles.title, isAdult && styles.titleEditorial]} accessibilityRole="header">
            {title}
          </Text>
          {!isChild ? <Text style={styles.description}>{t(path.descriptionKey)}</Text> : null}
          <View accessible accessibilityLabel={t('learningPaths.progress', { completed: progress.completed, total: progress.total })}>
            <Text style={styles.progressText}>{t('learningPaths.progress', { completed: progress.completed, total: progress.total })}</Text>
            <ProgressBar progress={progress.completed / progress.total} height={isChild ? 8 : 4} fillColor={colors.accentGold} trackColor={colors.surfaceMuted} />
          </View>

          {progress.done ? (
            <View style={styles.done} accessibilityLiveRegion="polite">
              <OymoOrnament size={18} color={colors.accentGold} strokeWidth={1.5} />
              <Text style={styles.doneText}>{t('learningPaths.completed')}</Text>
              <IconButton
                icon={Share2}
                size={36}
                iconSize={16}
                shape="roundedSquare"
                accessibilityLabel={t('share.action')}
                onPress={() => void share(buildPathShareCard({ title, completedLabel: t('learningPaths.completed'), hero }), `${title} · ${t('learningPaths.completed')}`)}
              />
            </View>
          ) : nextRoute ? (
            <Button label={progress.started ? t('learningPaths.continue') : t('learningPaths.start')} size={isChild ? 'lg' : 'md'} onPress={() => openStep(nextRoute, path.id)} />
          ) : null}

          <View style={{ gap: spacing.xs }}>
            {path.steps.map((step, index) => {
              const { verb, title: stepTitle, route } = display(step);
              const state = progress.states[index];
              const manual = isManualStep(step);
              return (
                <View key={step.id} style={[styles.step, isChild && styles.stepChild, state === 'completed' && styles.stepDone]}>
                  <AnimatedPressable
                    style={styles.stepMain}
                    onPress={() => route && openStep(route, path.id)}
                    accessibilityRole="button"
                    accessibilityLabel={`${t('learningPaths.step', { index: index + 1 })}. ${verb}: ${stepTitle}. ${stateLabel(state)}.`}
                  >
                    <View style={[styles.badge, state === 'completed' && styles.badgeDone]}>
                      {state === 'completed' ? <Check size={14} color={colors.textOnDark} strokeWidth={3} /> : state === 'in_progress' ? <Circle size={12} color={colors.accentGold} fill={colors.accentGold} /> : <Text style={styles.badgeText}>{index + 1}</Text>}
                    </View>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={styles.stepVerb}>{verb}</Text>
                      <Text style={[styles.stepTitle, isChild && styles.stepTitleChild]} numberOfLines={2}>
                        {stepTitle}
                      </Text>
                      {!isChild ? <Text style={styles.stepState}>{stateLabel(state)}</Text> : null}
                    </View>
                    <ChevronRight size={16} color={colors.textMuted} strokeWidth={2} />
                  </AnimatedPressable>
                  {manual ? (
                    <AnimatedPressable
                      style={styles.mark}
                      onPress={() => useLearningPathStore.getState().setManual(owner, path.id, step.id, state !== 'completed')}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: state === 'completed' }}
                      aria-checked={state === 'completed'}
                      accessibilityLabel={t('learningPaths.markComplete')}
                    >
                      <Text style={styles.markText}>{state === 'completed' ? `✓ ${t('learningPaths.state.completed')}` : t('learningPaths.markComplete')}</Text>
                    </AnimatedPressable>
                  ) : null}
                </View>
              );
            })}
          </View>
        </View>
      </ScrollView>
      {shareHost}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  hero: { width: '100%', aspectRatio: 1.7, backgroundColor: colors.surfaceFeature, overflow: 'hidden' },
  heroChild: { aspectRatio: 1.3 },
  heroTop: { position: 'absolute', left: spacing.md, top: 0 },
  body: { padding: spacing.md, gap: spacing.md },
  kicker: { ...typography.overline, color: colors.accentTerracotta },
  title: { ...textStyles.display, color: colors.textPrimary, marginTop: -spacing.sm },
  titleEditorial: { ...editorial(textStyles.display) },
  description: { ...textStyles.body, color: colors.textSecondary },
  progressText: { ...textStyles.small, fontWeight: '700', color: colors.textSecondary, marginBottom: 4 },
  done: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderRadius: radii.lg, backgroundColor: colors.surfaceAlt },
  doneText: { ...textStyles.bodyMedium, fontWeight: '700', color: colors.textPrimary, flex: 1 },
  step: { borderRadius: radii.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.surfaceBorder, padding: spacing.sm, gap: spacing.xs },
  stepChild: { padding: spacing.md },
  stepDone: { borderColor: colors.primary },
  stepMain: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 48 },
  badge: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceMuted },
  badgeDone: { backgroundColor: colors.primary },
  badgeText: { ...textStyles.small, fontWeight: '700', color: colors.textSecondary },
  stepVerb: { ...typography.overline, fontSize: 10, color: colors.accentTerracotta },
  stepTitle: { ...textStyles.bodyMedium, fontWeight: '700', color: colors.textPrimary },
  stepTitleChild: { fontSize: 18 },
  stepState: { ...textStyles.small, color: colors.textSecondary },
  mark: { alignSelf: 'flex-start', minHeight: 36, justifyContent: 'center', paddingHorizontal: spacing.sm, borderRadius: radii.pill, backgroundColor: colors.surfaceElevated },
  markText: { ...textStyles.small, fontWeight: '700', color: colors.primary },
});
