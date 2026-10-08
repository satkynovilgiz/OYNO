import { useFocusEffect } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AppState, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnimatedPressable, Button, IconButton, Toggle } from '@/components/ui';
import { useRecordsOwner } from '@/features/games/records/useGameRecords';
import { announce } from '@/services/a11y/announce';
import { useAgeExperience } from '@/services/ageExperience/useAgeExperience';
import { useReducedMotion } from '@/services/motion/useReducedMotion';
import { ownerRepeat, useRhythmRepeatStore } from '@/store/useRhythmRepeatStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { colors, radii, spacing, textStyles, typography } from '@/theme';

import { useKomuzPlayerStore } from '../../listening/useKomuzPlayerStore';
import { createRepeatAudio, playExample } from './repeatAudio';
import { beatMs, buildRounds, DIFFICULTIES, exampleTimes, LEVELS, PATTERNS, ROUNDS, sessionReducer, startSession, summarize, type Difficulty, type RoundScore, type SessionAction, type SessionState } from './repeatModel';

/** No tap for this long (or 2.5 beats, if longer) ends the attempt. */
const SILENCE_MS = 2000;

type Reducer = (state: SessionState | null, action: SessionAction | { type: 'begin'; state: SessionState } | { type: 'quit' }) => SessionState | null;
const reducer: Reducer = (state, action) => {
  if (action.type === 'begin') return action.state;
  if (action.type === 'quit') return null;
  return state ? sessionReducer(state, action) : state;
};

/**
 * /culture/komuz/repeat - "Repeat the Rhythm", a mode of the Rhythm
 * Trainer: hear (or watch) a short authored PRACTICE EXERCISE, tap it back
 * on one large pad, get relative-timing feedback; five rounds and a
 * summary. Taps use the monotonic clock (performance.now). Leaving the
 * screen or backgrounding the app stops the example at once and pauses the
 * round, which then restarts from the example - an interrupted attempt is
 * never scored. Results are this mode's own (not game records).
 */
export function RepeatRhythmScreen({ onPressBack }: { onPressBack: () => void }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { experience } = useAgeExperience();
  const large = experience === 'child';
  const reducedMotion = useReducedMotion();
  const owner = useRecordsOwner();
  const best = useRhythmRepeatStore((state) => ownerRepeat(state.saved, owner));
  const effectsOn = useSettingsStore((state) => state.game.soundEffects);
  const [difficulty, setDifficulty] = useState<Difficulty>('easy');
  const [soundOn, setSoundOn] = useState(true);
  const [session, dispatch] = useReducer(reducer, null);
  /** The note lit in the demonstration (-1 = none). */
  const [lit, setLit] = useState(-1);
  /** The example is replaying on the feedback screen (the result is kept). */
  const [replaying, setReplaying] = useState(false);
  const audio = useRef<ReturnType<typeof createRepeatAudio> | null>(null);
  const cancelExample = useRef<(() => void) | null>(null);
  const recorded = useRef(false);
  const sessionOwner = useRef(owner);

  useEffect(() => {
    void useRhythmRepeatStore.getState().load();
    audio.current = createRepeatAudio();
    return () => {
      cancelExample.current?.();
      audio.current?.dispose();
      audio.current = null;
    };
  }, []);

  const stopExample = useCallback(() => {
    cancelExample.current?.();
    cancelExample.current = null;
    setLit(-1);
    setReplaying(false);
  }, []);

  const interrupt = useCallback(() => {
    stopExample();
    dispatch({ type: 'interrupt' });
  }, [stopExample]);

  // Backgrounding, or leaving for another screen: silence now, pause the round.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next) => next !== 'active' && interrupt());
    return () => subscription.remove();
  }, [interrupt]);
  useFocusEffect(useCallback(() => () => interrupt(), [interrupt]));
  // Another account: the session in progress is dropped, never saved for them.
  useEffect(() => {
    if (sessionOwner.current === owner) return;
    sessionOwner.current = owner;
    stopExample();
    dispatch({ type: 'quit' });
  }, [owner, stopExample]);

  const pattern = session ? session.rounds[session.index] : null;
  const bpm = session ? LEVELS[session.difficulty].bpm : 0;
  const notes = pattern ? PATTERNS[pattern].length : 0;

  const runExample = useCallback(
    (onDone: () => void) => {
      if (!pattern) return;
      cancelExample.current?.();
      useKomuzPlayerStore.getState().pause(); // never over a playing track
      let alt = false;
      cancelExample.current = playExample(exampleTimes(pattern, bpm), {
        onNote: (index) => {
          setLit(index);
          if (soundOn) audio.current?.play((alt = !alt) ? 'note' : 'noteAlt', 0.8);
        },
        onDone: () => {
          cancelExample.current = null;
          setLit(-1);
          onDone();
        },
      });
    },
    [pattern, bpm, soundOn],
  );

  // The example plays whenever a round (re)enters "listen".
  const phase = session?.phase;
  const roundKey = session ? `${session.index}` : '';
  useEffect(() => {
    if (phase !== 'listen') return;
    runExample(() => dispatch({ type: 'demoDone' }));
    return () => {
      cancelExample.current?.();
      cancelExample.current = null;
    };
  }, [phase, roundKey, runExample]);

  useEffect(() => {
    if (phase === 'ready') announce(t('rhythmRepeat.yourTurn'));
  }, [phase, t]);

  // Silence ends the attempt.
  const tapCount = session?.taps.length ?? 0;
  useEffect(() => {
    if (phase !== 'tapping') return;
    const timer = setTimeout(() => dispatch({ type: 'finish' }), Math.max(SILENCE_MS, 2.5 * beatMs(bpm)));
    return () => clearTimeout(timer);
  }, [phase, tapCount, bpm]);

  const result: RoundScore | null = session && session.phase === 'feedback' ? (session.results[session.index] ?? null) : null;
  useEffect(() => {
    if (result) announce(t('rhythmRepeat.roundPoints', { points: result.points, max: result.maxPoints }));
  }, [result, t]);

  // A finished session is recorded exactly once, for the owner who played it.
  const summary = useMemo(() => (session ? summarize(session) : null), [session]);
  useEffect(() => {
    if (phase !== 'summary' || !session || !summary || recorded.current) return;
    recorded.current = true;
    if (sessionOwner.current !== owner) return;
    useRhythmRepeatStore.getState().recordSession(owner, session.difficulty, { points: summary.points, maxPoints: summary.maxPoints });
    announce(t('rhythmRepeat.summaryPoints', { points: summary.points, max: summary.maxPoints }));
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  const begin = (level: Difficulty) => {
    recorded.current = false;
    sessionOwner.current = owner;
    dispatch({ type: 'begin', state: startSession(level, buildRounds(level, Math.random)) });
  };

  const leave = () => {
    stopExample();
    dispatch({ type: 'quit' });
    onPressBack();
  };

  const header = (
    <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
      <IconButton icon={ChevronLeft} shape="roundedSquare" accessibilityLabel={t('common.back')} onPress={leave} />
      <Text style={styles.title} accessibilityRole="header" numberOfLines={1}>
        {t('rhythmRepeat.title')}
      </Text>
    </View>
  );

  if (!session) {
    return (
      <View style={styles.root}>
        {header}
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]} testID="repeat-setup">
          <Text style={[styles.body, large && styles.bodyLarge]}>{t('rhythmRepeat.intro')}</Text>
          <Text style={styles.note} testID="repeat-exercises-note">
            {t('rhythmRepeat.exercisesNote')}
          </Text>
          <Text style={styles.label} accessibilityRole="header">
            {t('rhythmRepeat.difficultyTitle')}
          </Text>
          <View accessibilityRole="radiogroup" style={styles.stack}>
            {DIFFICULTIES.map((level) => {
              const selected = level === difficulty;
              const record = best[level];
              const status = record ? t('rhythmRepeat.best', { points: record.bestPoints, max: record.maxPoints }) : t('rhythmRepeat.notPlayed');
              return (
                <AnimatedPressable key={level} style={[styles.choice, selected && styles.choiceOn]} onPress={() => setDifficulty(level)} accessibilityRole="radio" accessibilityState={{ checked: selected }} aria-checked={selected} accessibilityLabel={`${t(`rhythmRepeat.difficulty.${level}`)}. ${t(`rhythmRepeat.difficultyHint.${level}`)}. ${status}`} testID={`repeat-level-${level}`}>
                  <Text style={styles.choiceTitle}>{t(`rhythmRepeat.difficulty.${level}`)}</Text>
                  <Text style={styles.meta}>
                    {t(`rhythmRepeat.difficultyHint.${level}`)} · {status}
                  </Text>
                </AnimatedPressable>
              );
            })}
          </View>
          <View style={styles.toggleRow}>
            <View style={styles.flex}>
              <Text style={styles.choiceTitle}>{t('rhythmRepeat.soundTitle')}</Text>
              <Text style={styles.meta}>{t('rhythmRepeat.soundHint')}</Text>
            </View>
            <Toggle value={soundOn} onValueChange={setSoundOn} accessibilityLabel={t('rhythmRepeat.soundTitle')} />
          </View>
          {soundOn && !effectsOn ? <Text style={styles.meta}>{t('rhythmRepeat.soundsOffSetting')}</Text> : null}
          <Text style={styles.meta}>{t('rhythmRepeat.howScored')}</Text>
          <Button label={t('rhythmRepeat.start')} size="lg" onPress={() => begin(difficulty)} testID="repeat-start" />
          <Text style={styles.meta}>{t('rhythmRepeat.practiceNote')}</Text>
        </ScrollView>
      </View>
    );
  }

  if (session.phase === 'summary' && summary) {
    return (
      <View style={styles.root}>
        {header}
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]} testID="repeat-summary">
          <Text style={styles.heading} accessibilityRole="header">
            {t('rhythmRepeat.summaryTitle')}
          </Text>
          <Text style={styles.big} testID="repeat-summary-points">
            {t('rhythmRepeat.summaryPoints', { points: summary.points, max: summary.maxPoints })}
          </Text>
          <Text style={styles.body}>{t('rhythmRepeat.summaryCounts', summary)}</Text>
          {session.results.map((round, index) => (
            <Text key={index} style={styles.meta} testID={`repeat-summary-round-${index + 1}`}>
              {t('rhythmRepeat.roundOf', { current: index + 1, total: ROUNDS })} · {t(`rhythmRepeat.patterns.${round.pattern}`)} · {t('rhythmRepeat.roundPoints', { points: round.points, max: round.maxPoints })}
            </Text>
          ))}
          <Text style={styles.meta}>{t('rhythmRepeat.practiceNote')}</Text>
          <Button label={t('rhythmRepeat.playAgain')} size="lg" onPress={() => begin(session.difficulty)} testID="repeat-again" />
          <Button label={t('rhythmRepeat.changeDifficulty')} variant="secondary" onPress={() => dispatch({ type: 'quit' })} testID="repeat-change" />
        </ScrollView>
      </View>
    );
  }

  const tapping = session.phase === 'ready' || session.phase === 'tapping';
  const status =
    session.phase === 'listen' || replaying
      ? t('rhythmRepeat.listen')
      : session.phase === 'ready'
        ? t('rhythmRepeat.yourTurn')
        : session.phase === 'tapping'
          ? t('rhythmRepeat.tapped', { count: session.taps.length, total: notes })
          : session.phase === 'paused'
            ? t('rhythmRepeat.paused')
            : '';
  const againLabel = soundOn ? t('rhythmRepeat.hearAgain') : t('rhythmRepeat.showAgain');

  return (
    <View style={styles.root}>
      {header}
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]} testID="repeat-round">
        <Text style={styles.meta} testID="repeat-progress">
          {t('rhythmRepeat.roundOf', { current: session.index + 1, total: ROUNDS })}
        </Text>
        <Text style={styles.heading} accessibilityRole="header">
          {t('rhythmRepeat.exercise', { name: t(`rhythmRepeat.patterns.${pattern}`) })}
        </Text>

        {/* The visual demonstration: one light per note (also the only cue with sound off). */}
        <View style={styles.lights} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" testID="repeat-lights">
          {PATTERNS[pattern!].map((beat, index) => {
            const tapped = session.phase === 'tapping' && index < session.taps.length;
            const grade = result?.beats[index]?.grade;
            return (
              <View key={index} style={[styles.light, { marginLeft: index === 0 ? 0 : `${Math.max(1, (beat - PATTERNS[pattern!][index - 1]) * 6)}%` }, (lit === index || tapped) && styles.lightOn, lit === index && !reducedMotion && styles.lightPulse, grade && styles[grade]]} testID={lit === index ? 'repeat-light-on' : undefined}>
                <Text style={[styles.lightMark, grade === 'onTime' && styles.lightMarkOnPrimary]}>{grade ? MARKS[grade] : ''}</Text>
              </View>
            );
          })}
        </View>

        <Text style={[styles.status, large && styles.bodyLarge]} accessibilityLiveRegion="polite" testID="repeat-status">
          {status}
        </Text>

        {result ? <RoundFeedback result={result} /> : null}

        {session.phase !== 'feedback' && session.phase !== 'paused' ? (
          <Pressable
            style={({ pressed }) => [styles.pad, large && styles.padLarge, pressed && tapping && styles.padPressed, !tapping && styles.padWaiting]}
            // onPressIn: the earliest moment a touch is known - less delay than onPress.
            // Web's Pressable otherwise waits 50 ms before press-in and drops taps shorter than
            // that (its prop isn't in the native types; native press-in has no delay).
            {...(Platform.OS === 'web' ? ({ delayPressIn: 0 } as object) : null)}
            onPressIn={() => tapping && dispatch({ type: 'tap', at: performance.now() })}
            accessibilityRole="button"
            accessibilityLabel={t('rhythmRepeat.pad')}
            accessibilityHint={t('rhythmRepeat.padHint')}
            accessibilityState={{ disabled: !tapping }}
            testID="repeat-pad"
          >
            <Text style={styles.padText}>{t('rhythmRepeat.pad')}</Text>
          </Pressable>
        ) : null}

        {session.phase === 'tapping' ? <Button label={t('rhythmRepeat.done')} variant="secondary" onPress={() => dispatch({ type: 'finish' })} testID="repeat-done" /> : null}
        {tapping ? <Button label={againLabel} variant="text" onPress={() => dispatch({ type: 'replay' })} testID="repeat-again-example" /> : null}
        {session.phase === 'paused' ? <Button label={t('rhythmRepeat.restart')} size="lg" onPress={() => dispatch({ type: 'restart' })} testID="repeat-restart" /> : null}
        {session.phase === 'feedback' ? (
          <>
            <Button
              label={againLabel}
              variant="secondary"
              disabled={replaying}
              onPress={() => {
                setReplaying(true);
                runExample(() => setReplaying(false));
              }}
              testID="repeat-replay"
            />
            <Button
              label={session.index + 1 >= ROUNDS ? t('rhythmRepeat.seeSummary') : t('rhythmRepeat.next')}
              size="lg"
              onPress={() => {
                stopExample();
                dispatch({ type: 'next' });
              }}
              testID="repeat-next"
            />
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

const MARKS = { onTime: '✓', close: '~', off: '✕', missing: '–' } as const;

function RoundFeedback({ result }: { result: RoundScore }) {
  const { t } = useTranslation();
  const judged = result.tempo !== null;
  return (
    <View style={styles.feedback} testID="repeat-feedback">
      <Text style={styles.big} testID="repeat-round-points">
        {t('rhythmRepeat.roundPoints', { points: result.points, max: result.maxPoints })}
      </Text>
      {!judged ? <Text style={styles.body}>{t('rhythmRepeat.tooFew')}</Text> : null}
      {result.beats.map((beat, index) => (
        <Text key={index} style={styles.meta} testID={`repeat-note-${index + 1}`}>
          {beat.deviation !== null && beat.grade !== 'onTime'
            ? t('rhythmRepeat.noteResultTimed', { n: index + 1, grade: t(`rhythmRepeat.grade.${beat.grade}`), direction: beat.deviation < 0 ? t('rhythmRepeat.early') : t('rhythmRepeat.late') })
            : t('rhythmRepeat.noteResult', { n: index + 1, grade: t(`rhythmRepeat.grade.${beat.grade}`) })}
        </Text>
      ))}
      {result.tempo ? <Text style={styles.meta}>{t(`rhythmRepeat.tempo.${result.tempo}`)}</Text> : null}
      {result.ignoredTaps > 0 ? <Text style={styles.meta}>{t('rhythmRepeat.ignored', { count: result.ignoredTaps })}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  title: { ...typography.h1, color: colors.textPrimary, flex: 1 },
  content: { paddingHorizontal: spacing.md, gap: spacing.md },
  stack: { gap: spacing.sm },
  flex: { flex: 1, gap: 2 },
  body: { ...textStyles.body, color: colors.textPrimary },
  bodyLarge: { fontSize: 19, lineHeight: 28 },
  note: { ...textStyles.small, color: colors.textPrimary, padding: spacing.sm, borderRadius: radii.md, backgroundColor: colors.surfaceMuted },
  meta: { ...textStyles.small, color: colors.textSecondary },
  label: { ...typography.overline, color: colors.textSecondary },
  heading: { ...textStyles.h2, color: colors.textPrimary },
  big: { ...textStyles.h2, color: colors.textPrimary },
  status: { ...textStyles.bodyMedium, fontWeight: '700', color: colors.primary, textAlign: 'center' },
  choice: { gap: 2, padding: spacing.md, minHeight: 56, borderRadius: radii.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.surfaceBorder },
  choiceOn: { borderColor: colors.primary, borderWidth: 2 },
  choiceTitle: { ...textStyles.bodyMedium, fontWeight: '700', color: colors.textPrimary },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  lights: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', minHeight: 64, paddingVertical: spacing.sm },
  light: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceMuted, borderWidth: 2, borderColor: colors.surfaceBorder },
  lightOn: { backgroundColor: colors.accentGold, borderColor: colors.accentGold },
  lightPulse: { transform: [{ scale: 1.2 }] },
  lightMark: { ...textStyles.bodyMedium, fontWeight: '800', color: colors.textPrimary },
  lightMarkOnPrimary: { color: colors.textOnPrimary },
  onTime: { backgroundColor: colors.primary, borderColor: colors.primary },
  close: { backgroundColor: colors.accentGold, borderColor: colors.accentGold },
  off: { backgroundColor: colors.surfaceMuted, borderColor: colors.accentTerracotta },
  missing: { backgroundColor: colors.surfaceMuted, borderColor: colors.surfaceBorder, borderStyle: 'dashed' },
  pad: { alignSelf: 'center', width: 240, height: 240, borderRadius: 120, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accentGold },
  padLarge: { width: 280, height: 280, borderRadius: 140 },
  padPressed: { opacity: 0.85 },
  padWaiting: { backgroundColor: colors.surfaceMuted },
  padText: { ...textStyles.h2, color: colors.textPrimary },
  feedback: { gap: spacing.xs, padding: spacing.md, borderRadius: radii.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.surfaceBorder },
});
