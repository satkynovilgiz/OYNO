import { router } from 'expo-router';
import { Check, ChevronLeft, ChevronRight, Circle, Share2, Link2 } from 'lucide-react-native';
import { useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { OymoOrnament } from '@/components/patterns/OymoOrnament';
import { NotFoundState } from '@/components/system/NotFoundState';
import { AnimatedPressable, Button, IconButton, MediaImage, ProgressBar, Skeleton } from '@/components/ui';
import { cultureItemImages } from '@/features/culture/data';
import { useAgeExperience } from '@/services/ageExperience/useAgeExperience';
import { useShareCard } from '@/services/share/useShareCard';
import { useLearningPathStore } from '@/store/useLearningPathStore';
import { colors, editorial, radii, spacing, textStyles, typography } from '@/theme';

import { buildPathShareCard } from './learningPathShare';
import { isManualStep, LEARNING_PATHS, pathProgress, type StepState } from './learningPaths';
import { usePathSignals } from './usePathSignals';
import { useStepCatalog, useStepDisplay } from './useStepDisplay';
import { shareContentLink } from '@/services/links/shareContentLink';
import { isRouteAvailableOffline } from '@/services/offline/offlineAvailability';
import { useNetworkStatus } from '@/services/offline/networkStatus';
import { buildLearningPathOfflineManifest, learningPathPackState, offlineContinue } from '@/services/offline/pathPacks';
import { useOfflineStore } from '@/services/offline/useOfflineStore';

import { stepHref } from './PathContinueCard';
import { PathOfflineRow } from './PathOfflineRow';

/** Opens a step with `fromPath` so the app can offer "Back to Learning Path" and "Continue learning". */
export function openStep(route: string, pathId: string) {
  router.push(stepHref(route, pathId) as never);
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
  const { signals, owner, ready } = usePathSignals();
  const display = useStepDisplay();
  const { share, shareHost } = useShareCard();
  const { isOffline } = useNetworkStatus();
  const queryClient = useQueryClient();
  const manifest = useOfflineStore((state) => state.manifest);
  const inFlight = useOfflineStore((state) => state.inFlight);
  const failed = useOfflineStore((state) => state.failed);
  const path = LEARNING_PATHS.find((candidate) => candidate.id === pathId);
  const pack = useMemo(() => (path ? buildLearningPathOfflineManifest(path) : null), [path]);
  if (!path || !pack) return <NotFoundState onPressBack={onPressBack} />;
  const packState = learningPathPackState(pack, manifest, inFlight, failed);

  const progress = pathProgress(path, signals);
  const hero = path.heroItemId ? (cultureItemImages[path.heroItemId]?.[0] ?? null) : null;
  const title = t(path.titleKey);
  // Offline: each step says whether it opens on this device (the existing
  // offline check over the query cache - downloads, Region packs or simply
  // read before); Continue picks the first unfinished step that does.
  const displays = path.steps.map((step) => display(step));
  const routes = displays.map((entry) => entry.route);
  const availableOffline = routes.map((route) => !!route && isRouteAvailableOffline(route, queryClient));
  // Continue: the first unfinished step that opens now - it still exists
  // (removed content is skipped, not opened into a dead end) and, offline,
  // is saved on this device. Same rule as before, one more condition.
  const reachable = routes.map((route, index) => !!route && (!isOffline || availableOffline[index]));
  const pick = offlineContinue(progress.nextIndex, progress.states.map((state) => state === 'completed'), reachable);
  const continueIndex = pick.index;
  const nextRoute = continueIndex !== null ? routes[continueIndex] : null;
  const trueNext = progress.nextIndex !== null ? path.steps[progress.nextIndex] : null;
  const trueNextRemoved = progress.nextIndex !== null && displays[progress.nextIndex].status === 'missing';
  const stateLabel = (state: StepState) => t(`learningPaths.state.${state}`);
  const stepLabel = (step: (typeof path.steps)[number]) => `${display(step).verb}: ${display(step).title}`;
  const catalog = useStepCatalog();

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
          {/* The link opens /learn/<id> - it never carries anyone's progress. */}
          <View style={{ alignSelf: 'flex-start' }}>
            <Button label={t('contentLinks.sharePath')} variant="text" icon={<Link2 size={16} color={colors.primary} strokeWidth={2} />} onPress={() => void shareContentLink({ type: 'learning_path', id: path.id, title })} />
          </View>
          {/* Saved progress first: until every signal store has loaded, completed
              steps would read as not started (and Start would reopen step 1). */}
          {!ready ? (
            <View accessible accessibilityLabel={t('common.loading')} aria-busy testID="path-progress-loading" style={{ gap: spacing.xs }}>
              <Skeleton width="40%" height={14} />
              <Skeleton height={isChild ? 8 : 4} />
              <Skeleton height={isChild ? 52 : 44} borderRadius={radii.pill} />
            </View>
          ) : (
            <View accessible accessibilityLabel={t('learningPaths.progress', { completed: progress.completed, total: progress.total })} testID="path-progress">
              <Text style={styles.progressText}>{t('learningPaths.progress', { completed: progress.completed, total: progress.total })}</Text>
              <ProgressBar progress={progress.completed / progress.total} height={isChild ? 8 : 4} fillColor={colors.accentGold} trackColor={colors.surfaceMuted} />
            </View>
          )}

          {!ready ? null : progress.done ? (
            <View style={styles.done} accessibilityLiveRegion="polite">
              <OymoOrnament size={18} color={colors.accentGold} strokeWidth={1.5} />
              <Text style={styles.doneText}>{t('learningPaths.completed')}</Text>
              <IconButton
                icon={Share2}
                size={36}
                iconSize={16}
                shape="roundedSquare"
                accessibilityLabel={t('share.action')}
                onPress={() => void share(buildPathShareCard({ title, completedLabel: t('learningPaths.completed'), hero }), `${title} · ${t('learningPaths.completed')}`, { link: { type: 'learning_path', id: path.id, title } })}
              />
            </View>
          ) : nextRoute ? (
            <Button label={progress.started ? t('learningPaths.continue') : t('learningPaths.start')} size={isChild ? 'lg' : 'md'} onPress={() => openStep(nextRoute, path.id)} testID="path-start" />
          ) : null}
          {ready && pick.trueNextUnavailable && trueNext && progress.nextIndex !== null ? (
            <Text style={styles.offlineNote} accessibilityLiveRegion="polite" testID={trueNextRemoved ? 'path-next-removed' : 'path-next-offline'}>
              {trueNextRemoved
                ? pick.index !== null
                  ? t('pathJourney.nextRemoved', { index: progress.nextIndex + 1, other: stepLabel(path.steps[pick.index]) })
                  : t('pathJourney.nextRemovedNone', { index: progress.nextIndex + 1 })
                : pick.index !== null
                  ? t('pathOffline.nextUnavailable', { step: stepLabel(trueNext), other: stepLabel(path.steps[pick.index]) })
                  : t('pathOffline.nextUnavailableNone', { step: stepLabel(trueNext) })}
            </Text>
          ) : null}
          {catalog.failed ? (
            <View style={styles.catalogFailed} accessibilityLiveRegion="polite">
              <Text style={styles.offlineNote}>{t('pathJourney.loadFailed')}</Text>
              <Button label={t('common.retry')} size="sm" variant="secondary" onPress={catalog.retry} testID="path-catalog-retry" />
            </View>
          ) : null}

          <PathOfflineRow pack={pack} state={packState} title={title} />

          <View style={{ gap: spacing.xs }}>
            {path.steps.map((step, index) => {
              const { verb, title: stepTitle, route, status } = displays[index];
              const removed = status === 'missing';
              const state = progress.states[index];
              // Not loaded yet: no state shown and nothing to mark (a tap would act on a guess).
              const manual = ready && isManualStep(step);
              return (
                <View key={step.id} style={[styles.step, isChild && styles.stepChild, ready && state === 'completed' && styles.stepDone]}>
                  <AnimatedPressable
                    style={styles.stepMain}
                    onPress={() => route && openStep(route, path.id)}
                    disabled={removed}
                    accessibilityRole="button"
                    accessibilityState={{ disabled: removed }}
                    aria-disabled={removed}
                    accessibilityLabel={`${t('learningPaths.step', { index: index + 1 })}. ${verb}: ${stepTitle}.${ready && !removed ? ` ${stateLabel(state)}.` : ''}${isOffline && !removed ? ` ${availableOffline[index] ? t('pathOffline.stepAvailable') : t('pathOffline.stepUnavailable')}.` : ''}`}
                  >
                    <View style={[styles.badge, ready && state === 'completed' && styles.badgeDone]}>
                      {!ready ? <Text style={styles.badgeText}>{index + 1}</Text> : state === 'completed' ? <Check size={14} color={colors.textOnDark} strokeWidth={3} /> : state === 'in_progress' ? <Circle size={12} color={colors.accentGold} fill={colors.accentGold} /> : <Text style={styles.badgeText}>{index + 1}</Text>}
                    </View>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={styles.stepVerb}>{verb}</Text>
                      <Text style={[styles.stepTitle, isChild && styles.stepTitleChild]} numberOfLines={2}>
                        {stepTitle}
                      </Text>
                      {!isChild && ready && !removed ? <Text style={styles.stepState}>{stateLabel(state)}</Text> : null}
                      {isOffline && !removed ? <Text style={[styles.stepOffline, !availableOffline[index] && styles.stepOfflineNo]}>{availableOffline[index] ? t('pathOffline.stepAvailable') : t('pathOffline.stepUnavailable')}</Text> : null}
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
  kicker: { ...typography.overline, color: colors.accentTerracottaText },
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
  stepVerb: { ...typography.overline, fontSize: 10, color: colors.accentTerracottaText },
  stepTitle: { ...textStyles.bodyMedium, fontWeight: '700', color: colors.textPrimary },
  stepTitleChild: { fontSize: 18 },
  stepState: { ...textStyles.small, color: colors.textSecondary },
  mark: { alignSelf: 'flex-start', minHeight: 36, justifyContent: 'center', paddingHorizontal: spacing.sm, borderRadius: radii.pill, backgroundColor: colors.surfaceElevated },
  markText: { ...textStyles.small, fontWeight: '700', color: colors.primary },
  stepOffline: { ...textStyles.small, fontWeight: '600', color: colors.primary },
  stepOfflineNo: { color: colors.textMuted },
  catalogFailed: { gap: spacing.xs, alignItems: 'flex-start' },
  offlineNote: { ...textStyles.small, color: colors.textSecondary },
});
