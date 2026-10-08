import { useFocusEffect } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AppState, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnimatedPressable, Button, IconButton } from '@/components/ui';
import { announce } from '@/services/a11y/announce';
import { useAgeExperience } from '@/services/ageExperience/useAgeExperience';
import { useReducedMotion } from '@/services/motion/useReducedMotion';
import { useSettingsStore } from '@/store/useSettingsStore';
import { cardRadii, colors, radii, spacing, textStyles, typography } from '@/theme';

import { useKomuzPlayerStore } from '../../listening/useKomuzPlayerStore';
import { createRepeatAudio, playExample } from '../repeat/repeatAudio';
import { attemptTimeoutMs, EXAMPLES, MAX_NOTES, MIN_NOTES, playbackTimes, START_WORKSHOP, STEPS, TEMPOS, validateComposition, visibleSteps, workshopReducer, type Composition } from './workshopModel';

/**
 * /culture/komuz/workshop - compose a rhythm, hand the phone over, and the
 * player taps it back (workshopModel.ts). Reuses Repeat the Rhythm's audio
 * (GameAudioManager, existing CC0 tap), scheduler and relative-timing
 * scoring. Leaving or backgrounding cancels every scheduled note at once.
 * No microphone, no backend, no sharing.
 */
export function RhythmWorkshopScreen({ onPressBack }: { onPressBack: () => void }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { experience } = useAgeExperience();
  const large = experience === 'child';
  const reducedMotion = useReducedMotion();
  const effectsOn = useSettingsStore((state) => state.game.soundEffects);
  const [state, dispatch] = useReducer(workshopReducer, START_WORKSHOP);
  const [lit, setLit] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [paused, setPaused] = useState(false);
  const audio = useRef<ReturnType<typeof createRepeatAudio> | null>(null);
  const cancel = useRef<(() => void) | null>(null);

  useEffect(() => {
    audio.current = createRepeatAudio();
    return () => {
      cancel.current?.();
      cancel.current = null;
      audio.current?.dispose();
      audio.current = null;
    };
  }, []);

  const stop = useCallback(() => {
    cancel.current?.();
    cancel.current = null;
    setLit(-1);
    setPlaying(false);
  }, []);

  const interrupt = useCallback(() => {
    stop();
    dispatch({ type: 'interrupt' });
    setPaused(true);
  }, [stop]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next) => next !== 'active' && interrupt());
    return () => subscription.remove();
  }, [interrupt]);
  useFocusEffect(useCallback(() => () => interrupt(), [interrupt]));

  /** Plays a composition; `onNote(index)` lights the step / the beat light. */
  const play = useCallback(
    (composition: Composition, onDone: () => void) => {
      stop();
      useKomuzPlayerStore.getState().pause();
      setPlaying(true);
      let alt = false;
      cancel.current = playExample(playbackTimes(composition), {
        onNote: (index) => {
          setLit(index);
          audio.current?.play((alt = !alt) ? 'note' : 'noteAlt', 0.8);
        },
        onDone: () => {
          cancel.current = null;
          setLit(-1);
          setPlaying(false);
          onDone();
        },
      });
    },
    [stop],
  );

  // The player's listening phase plays the LOCKED rhythm.
  useEffect(() => {
    if (state.phase !== 'listen' || !state.locked) return;
    play(state.locked, () => dispatch({ type: 'demoDone' }));
    return () => {
      cancel.current?.();
      cancel.current = null;
    };
  }, [state.phase, state.locked, play]);

  useEffect(() => {
    if (state.phase === 'ready') announce(t('rhythmWorkshop.yourTurn'));
    if (state.phase === 'feedback' && state.result) announce(t('rhythmWorkshop.feedbackScore', { points: state.result.points, max: state.result.maxPoints }));
  }, [state.phase, state.result, t]);

  // A long silence ends the attempt - long enough for the rhythm's own rests (attemptTimeoutMs).
  // Any phase change (Done, replay, backgrounding -> handoff, leaving) clears the pending timer.
  const tapCount = state.taps.length;
  useEffect(() => {
    if (state.phase !== 'tapping' || !state.locked) return;
    const timer = setTimeout(() => dispatch({ type: 'finish' }), attemptTimeoutMs(state.locked, state.taps));
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.phase, tapCount, state.locked]);

  const leave = () => {
    stop();
    onPressBack();
  };
  const problem = validateComposition(state.composition);
  const shown = visibleSteps(state);
  const tapping = state.phase === 'ready' || state.phase === 'tapping';
  const notes = state.locked?.steps.length ?? 0;
  const litStep = state.phase === 'compose' && lit >= 0 ? [...state.composition.steps].sort((a, b) => a - b)[lit] : -1;

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <IconButton icon={ChevronLeft} shape="roundedSquare" accessibilityLabel={t('common.back')} onPress={leave} />
        <Text style={styles.title} accessibilityRole="header" numberOfLines={1}>
          {t('rhythmWorkshop.title')}
        </Text>
      </View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]}>
        {paused && state.phase === 'handoff' ? (
          <Text style={styles.notice} testID="ws-paused">
            {t('rhythmWorkshop.paused')}
          </Text>
        ) : null}
        {!effectsOn ? <Text style={styles.meta}>{t('rhythmWorkshop.soundsOffSetting')}</Text> : null}

        {state.phase === 'compose' ? (
          <View style={styles.stack} testID="ws-compose">
            <Text style={[styles.body, large && styles.bodyLarge]}>{t('rhythmWorkshop.intro')}</Text>
            <Text style={styles.note}>{t('rhythmWorkshop.practiceNote')}</Text>
            <Text style={styles.section} accessibilityRole="header">
              {t('rhythmWorkshop.gridTitle')}
            </Text>
            <StepGrid steps={state.composition.steps} litStep={litStep} reducedMotion={reducedMotion} onToggle={(step) => dispatch({ type: 'toggle', step })} />
            <Text style={styles.meta} testID="ws-count">
              {t('rhythmWorkshop.notes', { count: state.composition.steps.length, max: MAX_NOTES })}
            </Text>

            <Text style={styles.section}>{t('rhythmWorkshop.tempoTitle')}</Text>
            <View style={styles.chips} accessibilityRole="radiogroup" accessibilityLabel={t('rhythmWorkshop.tempoTitle')}>
              {TEMPOS.map((bpm) => {
                const on = state.composition.tempo === bpm;
                return (
                  <AnimatedPressable key={bpm} style={[styles.chip, on && styles.chipOn]} onPress={() => dispatch({ type: 'tempo', tempo: bpm })} accessibilityRole="radio" accessibilityState={{ checked: on }} aria-checked={on} accessibilityLabel={t('rhythmWorkshop.tempo', { bpm })} testID={`ws-tempo-${bpm}`}>
                    <Text style={[styles.chipText, on && styles.chipTextOn]}>{bpm}</Text>
                  </AnimatedPressable>
                );
              })}
            </View>

            <Text style={styles.section}>{t('rhythmWorkshop.examplesTitle')}</Text>
            <View style={styles.chips}>
              {EXAMPLES.map((example) => (
                <AnimatedPressable key={example.id} style={styles.chip} onPress={() => { stop(); dispatch({ type: 'example', id: example.id }); }} accessibilityRole="button" accessibilityLabel={t(`rhythmWorkshop.examples.${example.id}`)} testID={`ws-example-${example.id}`}>
                  <Text style={styles.chipText}>{t(`rhythmWorkshop.examples.${example.id}`)}</Text>
                </AnimatedPressable>
              ))}
            </View>
            <Text style={styles.meta}>{t('rhythmWorkshop.examplesNote')}</Text>

            <View style={styles.row}>
              {playing ? <Button label={t('rhythmWorkshop.stop')} variant="secondary" onPress={stop} testID="ws-stop" /> : <Button label={t('rhythmWorkshop.play')} variant="secondary" disabled={problem !== null} onPress={() => play(state.composition, () => undefined)} testID="ws-play" />}
              <Button label={t('rhythmWorkshop.clear')} variant="text" onPress={() => { stop(); dispatch({ type: 'clear' }); }} testID="ws-clear" />
            </View>
            {problem ? (
              <Text style={styles.meta} accessibilityLiveRegion="polite" testID="ws-problem">
                {t(`rhythmWorkshop.problems.${problem}`, { min: MIN_NOTES, max: MAX_NOTES })}
              </Text>
            ) : null}
            <Button label={t('rhythmWorkshop.handOver')} size="lg" disabled={problem !== null} onPress={() => { stop(); setPaused(false); dispatch({ type: 'handOver' }); }} testID="ws-hand-over" />
            <Text style={styles.meta}>{t('rhythmWorkshop.localNote')}</Text>
          </View>
        ) : null}

        {state.phase === 'handoff' ? (
          <View style={styles.stack} testID="ws-handoff">
            <Text style={styles.heading} accessibilityRole="header">
              {t('rhythmWorkshop.handoffTitle')}
            </Text>
            <Text style={[styles.body, large && styles.bodyLarge]}>{t('rhythmWorkshop.handoffBody')}</Text>
            <Button label={t('rhythmWorkshop.playerReady')} size="lg" onPress={() => { setPaused(false); dispatch({ type: 'playerReady' }); }} testID="ws-player-ready" />
            <Button label={t('rhythmWorkshop.backToCompose')} variant="text" onPress={() => dispatch({ type: 'backToCompose' })} testID="ws-back-compose" />
          </View>
        ) : null}

        {state.phase === 'listen' || tapping ? (
          <View style={[styles.stack, styles.center]} testID="ws-player">
            {/* One light that flashes on each note: a visual cue that doesn't draw the grid. */}
            <View style={[styles.beatLight, lit >= 0 && styles.beatLightOn, lit >= 0 && !reducedMotion && styles.beatLightPulse]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" testID={lit >= 0 ? 'ws-light-on' : 'ws-light'} />
            <Text style={[styles.status, large && styles.bodyLarge]} accessibilityLiveRegion="polite" testID="ws-status">
              {state.phase === 'listen' ? t('rhythmWorkshop.listen') : state.phase === 'ready' ? t('rhythmWorkshop.yourTurn') : t('rhythmWorkshop.tapped', { count: state.taps.length, total: notes })}
            </Text>
            <Pressable
              style={({ pressed }) => [styles.pad, large && styles.padLarge, pressed && tapping && styles.padPressed, !tapping && styles.padWaiting]}
              {...(Platform.OS === 'web' ? ({ delayPressIn: 0 } as object) : null)}
              onPressIn={() => tapping && dispatch({ type: 'tap', at: performance.now() })}
              accessibilityRole="button"
              accessibilityLabel={t('rhythmWorkshop.pad')}
              accessibilityHint={t('rhythmWorkshop.padHint')}
              accessibilityState={{ disabled: !tapping }}
              testID="ws-pad"
            >
              <Text style={styles.padText}>{t('rhythmWorkshop.pad')}</Text>
            </Pressable>
            {state.phase === 'tapping' ? <Button label={t('rhythmWorkshop.done')} variant="secondary" onPress={() => dispatch({ type: 'finish' })} testID="ws-done" /> : null}
            {tapping ? <Button label={effectsOn ? t('rhythmWorkshop.hearAgain') : t('rhythmWorkshop.showAgain')} variant="text" onPress={() => dispatch({ type: 'replay' })} testID="ws-replay" /> : null}
          </View>
        ) : null}

        {state.phase === 'feedback' && state.result ? (
          <View style={styles.stack} testID="ws-feedback">
            <Text style={styles.heading} accessibilityRole="header">
              {t('rhythmWorkshop.feedbackTitle')}
            </Text>
            <Text style={styles.big} testID="ws-score">
              {t('rhythmWorkshop.feedbackScore', { points: state.result.points, max: state.result.maxPoints })}
            </Text>
            {state.result.tempo === null ? <Text style={styles.body}>{t('rhythmRepeat.tooFew')}</Text> : null}
            {state.result.beats.map((beat, index) => (
              <Text key={index} style={styles.meta}>
                {beat.deviation !== null && beat.grade !== 'onTime'
                  ? t('rhythmRepeat.noteResultTimed', { n: index + 1, grade: t(`rhythmRepeat.grade.${beat.grade}`), direction: beat.deviation < 0 ? t('rhythmRepeat.early') : t('rhythmRepeat.late') })
                  : t('rhythmRepeat.noteResult', { n: index + 1, grade: t(`rhythmRepeat.grade.${beat.grade}`) })}
              </Text>
            ))}
            {state.result.tempo ? <Text style={styles.meta}>{t(`rhythmRepeat.tempo.${state.result.tempo}`)}</Text> : null}
            <Text style={styles.note} testID="ws-feedback-note">
              {t('rhythmWorkshop.feedbackNote')}
            </Text>
            {shown ? (
              <View style={styles.stack} testID="ws-revealed">
                <Text style={styles.section}>{t('rhythmWorkshop.revealedTitle')}</Text>
                <StepGrid steps={shown} litStep={-1} reducedMotion={reducedMotion} />
              </View>
            ) : (
              <Button label={t('rhythmWorkshop.reveal')} variant="secondary" onPress={() => dispatch({ type: 'reveal' })} testID="ws-reveal" />
            )}
            <Button label={t('rhythmWorkshop.tryAgain')} onPress={() => dispatch({ type: 'tryAgain' })} testID="ws-try-again" />
            <Button label={t('rhythmWorkshop.backToCompose')} variant="text" onPress={() => dispatch({ type: 'backToCompose' })} testID="ws-back-compose" />
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

/** 16 half-beat steps in two rows of four beats; editable when `onToggle` is given, otherwise a read-only reveal. */
function StepGrid({ steps, litStep, reducedMotion, onToggle }: { steps: number[]; litStep: number; reducedMotion: boolean; onToggle?: (step: number) => void }) {
  const { t } = useTranslation();
  const rows = [Array.from({ length: STEPS / 2 }, (_, index) => index), Array.from({ length: STEPS / 2 }, (_, index) => index + STEPS / 2)];
  return (
    <View style={styles.gridRows} testID={onToggle ? 'ws-grid' : 'ws-grid-revealed'}>
      {rows.map((row, rowIndex) => (
        <View key={rowIndex} style={styles.gridRow}>
          {row.map((step) => {
            const on = steps.includes(step);
            const label = t('rhythmWorkshop.stepA11y', { beat: Math.floor(step / 2) + 1, half: step % 2 === 0 ? t('rhythmWorkshop.onBeat') : t('rhythmWorkshop.offBeat'), state: on ? t('rhythmWorkshop.on') : t('rhythmWorkshop.off') });
            const style = [styles.step, step % 2 === 0 && styles.stepOnBeat, on && styles.stepOn, litStep === step && styles.stepLit, litStep === step && !reducedMotion && styles.stepPulse];
            return onToggle ? (
              <AnimatedPressable key={step} style={style} onPress={() => onToggle(step)} accessibilityRole="checkbox" accessibilityState={{ checked: on }} aria-checked={on} accessibilityLabel={label} testID={`ws-step-${step}`}>
                {null}
              </AnimatedPressable>
            ) : (
              <View key={step} style={style} accessibilityLabel={label} testID={`ws-revealed-${step}${on ? '-on' : ''}`} />
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  title: { ...typography.h1, color: colors.textPrimary, flex: 1 },
  content: { paddingHorizontal: spacing.lg, gap: spacing.md },
  stack: { gap: spacing.sm },
  center: { alignItems: 'center' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, alignItems: 'center' },
  section: { ...typography.overline, color: colors.textSecondary },
  heading: { ...textStyles.h2, color: colors.textPrimary },
  big: { ...textStyles.h2, color: colors.primary },
  body: { ...textStyles.body, color: colors.textPrimary },
  bodyLarge: { fontSize: 19, lineHeight: 28 },
  meta: { ...textStyles.small, color: colors.textSecondary },
  note: { ...textStyles.small, color: colors.textPrimary, padding: spacing.sm, borderRadius: radii.md, backgroundColor: colors.surfaceMuted },
  notice: { ...textStyles.body, color: colors.textPrimary, padding: spacing.sm, borderRadius: radii.md, backgroundColor: colors.surfaceAlt },
  status: { ...textStyles.bodyMedium, fontWeight: '700', color: colors.primary, textAlign: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: { minHeight: 44, paddingHorizontal: spacing.md, justifyContent: 'center', borderRadius: 22, borderWidth: 1, borderColor: colors.borderSubtle, backgroundColor: colors.surface },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { ...textStyles.bodyMedium, color: colors.textPrimary },
  chipTextOn: { color: colors.textOnPrimary, fontWeight: '700' },
  gridRows: { gap: spacing.sm },
  gridRow: { flexDirection: 'row', gap: 4 },
  step: { flex: 1, minHeight: 44, borderRadius: cardRadii.compact, borderWidth: 1, borderColor: colors.borderSubtle, backgroundColor: colors.surface },
  stepOnBeat: { borderColor: colors.textSecondary },
  stepOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  stepLit: { backgroundColor: colors.accentGold, borderColor: colors.accentGold },
  stepPulse: { transform: [{ scale: 1.08 }] },
  beatLight: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.surfaceMuted, borderWidth: 2, borderColor: colors.surfaceBorder },
  beatLightOn: { backgroundColor: colors.accentGold, borderColor: colors.accentGold },
  beatLightPulse: { transform: [{ scale: 1.2 }] },
  pad: { width: 240, height: 240, borderRadius: 120, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accentGold },
  padLarge: { width: 280, height: 280, borderRadius: 140 },
  padPressed: { opacity: 0.85 },
  padWaiting: { backgroundColor: colors.surfaceMuted },
  padText: { ...textStyles.h2, color: colors.textPrimary },
});
