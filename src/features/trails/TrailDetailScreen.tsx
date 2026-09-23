import { router } from 'expo-router';
import { ArrowDownToLine, ArrowRight, BookOpen, Check, ChevronLeft, ChevronRight, Compass, Gamepad2, Layers, Map as MapIcon, RotateCw, Sparkles, type LucideIcon } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { OymoOrnament } from '@/components/patterns/OymoOrnament';
import { AnimatedPressable, HeroCard, IconButton, ProgressBar } from '@/components/ui';
import { natureSiteCoordinates } from '@/features/explore/data';
import type { SupportedLanguage } from '@/i18n';
import type { AgeExperience } from '@/services/ageExperience/types';
import { useAgeExperience } from '@/services/ageExperience/useAgeExperience';
import { useTrackScreenView } from '@/services/analytics/useTrackScreenView';
import { useAllCultureItems } from '@/services/content/cultureItemsService';
import { useCultureMaterials } from '@/services/content/cultureService';
import { useExploreRegions } from '@/services/content/exploreService';
import { downloadId, type OfflineKind } from '@/services/offline/offlineManifest';
import { useOfflineStore } from '@/services/offline/useOfflineStore';
import { useShareCard } from '@/services/share/useShareCard';
import { colors, fontFamily, radii, spacing, typography } from '@/theme';

import { resolveTrailStep } from './trailDisplay';
import { computeTrailProgress, type TrailStepState } from './trailProgress';
import { stepKey, type Trail, type TrailStepRef } from './trailsData';
import { useTrailSignals } from './useTrailSignals';

/** Shown only when a step's content has no artwork (e.g. a game without
 * cover art yet) - says what kind of stop it is instead of an empty box. */
const STEP_ICON: Record<TrailStepRef['type'], LucideIcon> = {
  destination: Compass,
  culture_item: BookOpen,
  culture_material: BookOpen,
  interactive_experience: Sparkles,
  game: Gamepad2,
  collection: Layers,
};

/** How many steps a child sees before "Show all steps" - fewer at once. */
const CHILD_VISIBLE_STEPS = 3;

/** The offline download that covers a step, if its type is downloadable. */
function offlineTargetFor(step: TrailStepRef): { kind: OfflineKind; id: string } | null {
  if (step.type === 'destination' && natureSiteCoordinates[step.id]) return { kind: 'nature', id: step.id };
  if (step.type === 'collection') return { kind: 'collection', id: step.id };
  if (step.type === 'culture_item') return { kind: 'culture_item', id: step.id };
  return null;
}

type TrailDetailScreenProps = {
  trail: Trail;
  onPressBack: () => void;
};

/**
 * One reusable trail screen - a journey timeline, not a checklist: every
 * step shows its real photo and opens its EXISTING screen; progress,
 * "Continue Journey" and the completion seal all come from the single
 * `computeTrailProgress`. Informational steps (culture reading, games that
 * don't record plays) are part of the path but never marked done.
 */
export function TrailDetailScreen({ trail, onPressBack }: TrailDetailScreenProps) {
  useTrackScreenView('trail_detail');
  const { t, i18n } = useTranslation();
  const language = i18n.language as SupportedLanguage;
  const insets = useSafeAreaInsets();
  const { experience } = useAgeExperience();
  const isAdult = experience === 'adult';
  const isChild = experience === 'child';

  const signals = useTrailSignals();
  const progress = useMemo(() => computeTrailProgress(trail, signals), [trail, signals]);
  const { data: regions } = useExploreRegions();
  const { data: cultureItems } = useAllCultureItems();
  const { data: cultureMaterials } = useCultureMaterials();
  const sources = { regions: regions ?? [], cultureItems: cultureItems ?? [], cultureMaterials: cultureMaterials ?? [] };

  // Derived, not initial state: the age group can finish loading after the
  // first render, and a child must still get the short window.
  const [expanded, setExpanded] = useState(false);
  const showAll = !isChild || expanded;
  const nextIndex = progress.nextStep ? trail.steps.findIndex((step) => stepKey(step) === stepKey(progress.nextStep!)) : -1;
  // Child: a short window around where they are (from the next step on).
  const visibleSteps = showAll
    ? progress.steps
    : progress.steps.slice(Math.max(0, nextIndex === -1 ? 0 : nextIndex), Math.max(0, nextIndex === -1 ? 0 : nextIndex) + CHILD_VISIBLE_STEPS);

  const nextDisplay = progress.nextStep ? resolveTrailStep(progress.nextStep, sources, t, language) : null;
  const hasPlaces = trail.steps.some((step) => step.type === 'destination');
  const title = trail.title[language] ?? trail.title.kg;
  const isComplete = progress.status === 'completed';

  // "Download Trail" = request the existing offline downloads for every
  // downloadable step. State is derived from those same downloads.
  const offlineTargets = trail.steps.map(offlineTargetFor).filter((target): target is { kind: OfflineKind; id: string } => !!target);
  const offlineIds = offlineTargets.map((target) => downloadId(target.kind, target.id));
  const downloadState = useOfflineStore((state) => {
    if (offlineIds.some((id) => state.inFlight.includes(id))) return 'downloading';
    if (offlineIds.length > 0 && offlineIds.every((id) => !!state.manifest.entries[id])) return 'downloaded';
    if (offlineIds.some((id) => state.failed.includes(id))) return 'error';
    return 'not_downloaded';
  });
  async function downloadTrail() {
    for (const target of offlineTargets) {
      if (!useOfflineStore.getState().manifest.entries[downloadId(target.kind, target.id)]) {
        await useOfflineStore.getState().download(target.kind, target.id);
      }
    }
  }

  const { share, shareHost } = useShareCard();

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xl, gap: spacing.lg }} showsVerticalScrollIndicator={false}>
        <HeroCard imageSource={trail.heroImage} title={title} aspectRatio={isChild ? 1 : 4 / 3}>
          <View style={{ paddingTop: insets.top }}>
            <IconButton icon={ChevronLeft} shape="roundedSquare" variant="surface" accessibilityLabel={t('common.back')} onPress={onPressBack} />
          </View>
        </HeroCard>

        <View style={styles.pad}>
          <Text style={styles.kicker}>{t('trails.kicker')}</Text>
          <Text style={[styles.intro, isAdult && styles.introEditorial]}>{trail.intro[language] ?? trail.intro.kg}</Text>
        </View>

        {progress.total > 0 ? (
          <View style={[styles.pad, styles.progressBlock]}>
            <View style={styles.progressRow}>
              <OymoOrnament size={11} color={colors.accentGoldPressed} strokeWidth={1.75} />
              <Text style={styles.progressText}>{t('trails.progress', { completed: progress.completed, total: progress.total })}</Text>
            </View>
            <ProgressBar progress={progress.completed / progress.total} height={5} fillColor={colors.accentGold} trackColor={colors.surfaceAlt} />
            <Text style={styles.scope}>{t('trails.progressScope')}</Text>
          </View>
        ) : null}

        {isComplete ? (
          <View style={[styles.pad]}>
            <View style={styles.complete}>
              <View style={styles.seal}>
                <Image source={trail.heroImage} style={styles.sealImage} resizeMode="cover" />
                <View style={styles.sealCheck}>
                  <Check size={14} color={colors.textPrimary} strokeWidth={3} />
                </View>
              </View>
              <Text style={styles.completeEyebrow}>{t('trails.completeEyebrow')}</Text>
              <Text style={[styles.completeTitle, isAdult && styles.introEditorial]}>{title}</Text>
              <Text style={styles.completeBody}>{t('trails.completeBody')}</Text>
              <AnimatedPressable
                style={styles.completeShare}
                onPress={() =>
                  void share({ title, label: t('trails.kicker'), imageSource: trail.heroImage, completedLabel: t('trails.completedLabel') }, t('share.message', { title }))
                }
                accessibilityRole="button"
                accessibilityLabel={t('share.action')}
              >
                <Text style={styles.completeShareText}>{t('share.action')}</Text>
              </AnimatedPressable>
            </View>
          </View>
        ) : nextDisplay?.route ? (
          <View style={styles.pad}>
            <AnimatedPressable
              style={[styles.continue, isChild && styles.continueChild]}
              onPress={() => router.push(nextDisplay.route as never)}
              pressScale={0.98}
              haptic="light"
              accessibilityRole="button"
              accessibilityLabel={`${t('trails.continue')}: ${nextDisplay.title}`}
            >
              <View style={styles.continueText}>
                <Text style={styles.continueLabel}>{t('trails.continue')}</Text>
                <Text style={styles.continueTitle} numberOfLines={1}>
                  {nextDisplay.title || t(nextDisplay.typeLabelKey)}
                </Text>
              </View>
              <ArrowRight size={20} color={colors.accentGold} strokeWidth={2.5} />
            </AnimatedPressable>
          </View>
        ) : null}

        <View style={[styles.pad, styles.actions]}>
          {hasPlaces ? (
            <AnimatedPressable
              style={styles.actionChip}
              onPress={() => router.push(`/explore/map?trail=${trail.id}` as never)}
              accessibilityRole="button"
              accessibilityLabel={t('trails.seeOnMap')}
            >
              <MapIcon size={15} color={colors.primary} strokeWidth={2.25} />
              <Text style={styles.actionText}>{t('trails.seeOnMap')}</Text>
            </AnimatedPressable>
          ) : null}
          {offlineTargets.length > 0 ? (
            <AnimatedPressable
              style={styles.actionChip}
              onPress={() => void downloadTrail()}
              disabled={downloadState === 'downloading' || downloadState === 'downloaded'}
              accessibilityRole="button"
              accessibilityState={{ busy: downloadState === 'downloading' }}
              accessibilityLabel={downloadState === 'downloaded' ? t('offline.a11y.available', { title }) : t('offline.a11y.download', { title })}
            >
              {downloadState === 'downloading' ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : downloadState === 'downloaded' ? (
                <Check size={15} color={colors.primary} strokeWidth={3} />
              ) : downloadState === 'error' ? (
                <RotateCw size={15} color={colors.accentTerracotta} strokeWidth={2.25} />
              ) : (
                <ArrowDownToLine size={15} color={colors.primary} strokeWidth={2.25} />
              )}
              <Text style={styles.actionText}>
                {downloadState === 'downloading'
                  ? t('offline.downloading')
                  : downloadState === 'downloaded'
                    ? t('offline.available')
                    : downloadState === 'error'
                      ? t('offline.retry')
                      : t('trails.download')}
              </Text>
            </AnimatedPressable>
          ) : null}
        </View>

        <View style={styles.pad}>
          {visibleSteps.map(({ step, state }, index) => (
            <TrailStepRow
              key={stepKey(step)}
              step={step}
              state={state}
              isNext={progress.nextStep ? stepKey(step) === stepKey(progress.nextStep) : false}
              isLast={index === visibleSteps.length - 1}
              experience={experience}
              display={resolveTrailStep(step, sources, t, language)}
            />
          ))}
          {!showAll ? (
            <AnimatedPressable style={styles.showAll} onPress={() => setExpanded(true)} accessibilityRole="button" accessibilityLabel={t('trails.showAll', { count: progress.steps.length })}>
              <Text style={styles.showAllText}>{t('trails.showAll', { count: progress.steps.length })}</Text>
            </AnimatedPressable>
          ) : null}
        </View>
      </ScrollView>
      {shareHost}
    </View>
  );
}

function TrailStepRow({
  step,
  state,
  isNext,
  isLast,
  experience,
  display,
}: {
  step: TrailStepRef;
  state: TrailStepState;
  isNext: boolean;
  isLast: boolean;
  experience: AgeExperience;
  display: ReturnType<typeof resolveTrailStep>;
}) {
  const { t } = useTranslation();
  const large = experience === 'child';
  const stateLabel = state === 'completed' ? t('trails.state.completed') : state === 'todo' ? t('trails.state.todo') : t('trails.state.info');

  return (
    <View style={styles.stepRow}>
      {/* Timeline rail: gold node when done, ring when to do, small oymo
          diamond for informational stops. */}
      <View style={styles.rail}>
        <View style={[styles.node, state === 'completed' && styles.nodeDone, state === 'todo' && styles.nodeTodo, isNext && styles.nodeNext]}>
          {state === 'completed' ? (
            <Check size={12} color={colors.textPrimary} strokeWidth={3} />
          ) : state === 'info' ? (
            <OymoOrnament size={10} color={colors.accentBrown} strokeWidth={1.75} />
          ) : null}
        </View>
        {!isLast ? <View style={[styles.line, state === 'completed' && styles.lineDone]} /> : null}
      </View>

      <AnimatedPressable
        style={[styles.stepCard, isNext && styles.stepCardNext, large && styles.stepCardLarge]}
        onPress={() => display.route && router.push(display.route as never)}
        disabled={!display.route}
        hoverEffect
        accessibilityRole="button"
        accessibilityLabel={`${display.title || t(display.typeLabelKey)}, ${stateLabel}`}
      >
        {display.imageSource ? (
          <Image source={display.imageSource} style={[styles.stepImage, large && styles.stepImageLarge]} resizeMode="cover" />
        ) : (
          <View style={[styles.stepImage, large && styles.stepImageLarge, styles.stepImageFallback]}>
            {(() => {
              const Icon = STEP_ICON[step.type];
              return <Icon size={large ? 26 : 20} color={colors.accentGold} strokeWidth={1.75} />;
            })()}
          </View>
        )}
        <View style={styles.stepText}>
          <Text style={styles.stepType}>{t(display.typeLabelKey)}</Text>
          <Text style={[styles.stepTitle, experience === 'adult' && styles.stepTitleEditorial, large && styles.stepTitleLarge]} numberOfLines={2}>
            {display.title || '…'}
          </Text>
          <Text style={[styles.stepState, state === 'completed' && styles.stepStateDone]}>{isNext ? t('trails.state.next') : stateLabel}</Text>
        </View>
        {display.route ? <ChevronRight size={16} color={colors.textMuted} strokeWidth={2} /> : null}
      </AnimatedPressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  pad: { paddingHorizontal: spacing.md },
  kicker: { ...typography.overline, color: colors.accentTerracotta, marginBottom: spacing.xxs },
  intro: { ...typography.body, lineHeight: 23, color: colors.textPrimary },
  introEditorial: { fontFamily: fontFamily.wordmark },
  progressBlock: { gap: spacing.xs },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  progressText: { ...typography.bodyBold, color: colors.textPrimary },
  scope: { ...typography.small, fontWeight: '500', color: colors.textMuted },
  continue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.xl,
    backgroundColor: colors.surfaceFeature,
  },
  continueChild: { paddingVertical: spacing.lg },
  continueText: { flex: 1, gap: 2 },
  continueLabel: { ...typography.overline, color: colors.accentGold },
  continueTitle: { ...typography.h2, color: colors.textOnDark },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  actionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: 'rgba(47,82,51,0.35)',
    backgroundColor: colors.surface,
  },
  actionText: { ...typography.caption, fontWeight: '700', color: colors.primary },
  complete: { padding: spacing.lg, borderRadius: radii.xxl, backgroundColor: colors.surfaceFeature, alignItems: 'center', gap: spacing.xs },
  seal: { width: 92, height: 92, borderRadius: 46, borderWidth: 2, borderColor: colors.accentGold, padding: 4, marginBottom: spacing.xs, transform: [{ rotate: '-5deg' }] },
  sealImage: { width: '100%', height: '100%', borderRadius: 42 },
  sealCheck: {
    position: 'absolute',
    right: -4,
    bottom: -4,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.accentGold,
    borderWidth: 2,
    borderColor: colors.surfaceFeature,
    alignItems: 'center',
    justifyContent: 'center',
  },
  completeEyebrow: { ...typography.overline, color: colors.accentGold },
  completeTitle: { ...typography.h1, color: colors.textOnDark, textAlign: 'center' },
  completeBody: { ...typography.caption, color: 'rgba(255,255,255,0.75)', textAlign: 'center' },
  completeShare: { paddingVertical: spacing.xs, marginTop: spacing.xs },
  completeShareText: { ...typography.bodyBold, color: colors.accentGold },
  stepRow: { flexDirection: 'row', gap: spacing.sm },
  rail: { width: 24, alignItems: 'center' },
  node: {
    width: 22,
    height: 22,
    borderRadius: 11,
    marginTop: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  nodeDone: { backgroundColor: colors.accentGold, borderColor: colors.accentGoldPressed },
  nodeTodo: { borderColor: colors.primary },
  nodeNext: { borderColor: colors.accentTerracotta, borderWidth: 2.5 },
  line: { flex: 1, width: 2, backgroundColor: colors.surfaceAlt, marginTop: 2 },
  lineDone: { backgroundColor: colors.accentGold },
  stepCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    marginBottom: spacing.sm,
    borderRadius: radii.xl,
    backgroundColor: colors.surface,
  },
  stepCardNext: { borderWidth: 1.5, borderColor: 'rgba(185,98,47,0.45)' },
  stepCardLarge: { padding: spacing.md },
  stepImage: { width: 56, height: 56, borderRadius: radii.lg },
  stepImageLarge: { width: 76, height: 76 },
  stepImageFallback: { backgroundColor: colors.surfaceFeature, alignItems: 'center', justifyContent: 'center' },
  stepText: { flex: 1, gap: 2 },
  stepType: { ...typography.overline, color: colors.accentTerracotta },
  stepTitle: { ...typography.bodyBold, color: colors.textPrimary },
  stepTitleEditorial: { fontFamily: fontFamily.wordmark },
  stepTitleLarge: { fontSize: 17 },
  stepState: { ...typography.small, fontWeight: '500', color: colors.textMuted },
  stepStateDone: { color: colors.primary, fontWeight: '700' },
  showAll: { alignSelf: 'center', paddingVertical: spacing.sm },
  showAllText: { ...typography.bodyBold, color: colors.primary },
});
