import { hapticImpact, hapticSelection } from '@/services/comfort/haptics';
import { router } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnimatedPressable, Button, IconButton } from '@/components/ui';
import { komuzTracks } from '@/features/culture/audioData';
import { useAgeExperience } from '@/services/ageExperience/useAgeExperience';
import { useReducedMotion } from '@/services/motion/useReducedMotion';
import { colors, radii, spacing, textStyles, typography } from '@/theme';

import { registerKomuzHost, useKomuzPlayerStore } from '../listening/useKomuzPlayerStore';
import { RHYTHM_CHARTS } from './rhythmCharts';
import { GOOD_WINDOW, judgeTap, missedBeats, NEW_ROUND, roundResult, supportedCharts, upcomingBeats, type Grade, type RhythmChart, type RoundState } from './rhythmModel';

type Phase = 'choose' | 'countIn' | 'playing' | 'result' | 'cancelled' | 'author';

/**
 * The song clock: the player's own reported position, re-anchored on every
 * status update (expo-audio reports ~4x per second), interpolated between
 * updates with the monotonic clock. Good enough for broad timing windows -
 * not for millisecond claims.
 */
function useSongClock() {
  const anchor = useRef<number | null>(null);
  useEffect(
    () =>
      useKomuzPlayerStore.subscribe((state, previous) => {
        if (state.playing && state.position !== previous.position) anchor.current = performance.now() - state.position * 1000;
        if (!state.playing) anchor.current = null;
      }),
    [],
  );
  // Stable object: effects depending on the clock must not restart per frame.
  const clock = useRef({
    now: () => (anchor.current === null ? null : (performance.now() - anchor.current) / 1000),
    reset: () => {
      anchor.current = null;
    },
  });
  return clock.current;
}

/**
 * /culture/komuz/rhythm - tap along with an AUTHORED beat chart on the
 * existing bundled komuz tracks. Personal practice only: no XP, no streak,
 * no leaderboard, no microphone, no note detection.
 */
export function RhythmTrainerScreen({ onPressBack }: { onPressBack: () => void }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { experience } = useAgeExperience();
  const isChild = experience === 'child';
  const reducedMotion = useReducedMotion();
  const clock = useSongClock();
  const charts = supportedCharts(RHYTHM_CHARTS, komuzTracks.map((track) => track.id));
  const [phase, setPhase] = useState<Phase>('choose');
  const [chart, setChart] = useState<RhythmChart | null>(null);
  const [count, setCount] = useState(3);
  const [round, setRound] = useState<RoundState>(NEW_ROUND);
  const [lastGrade, setLastGrade] = useState<Grade | 'miss' | null>(null);
  const [now, setNow] = useState(0);
  const [authored, setAuthored] = useState<number[]>([]);
  const playing = useKomuzPlayerStore((state) => state.playing);

  useEffect(() => registerKomuzHost(), []);

  // Count-in: 3, 2, 1, then the real playback starts the song clock.
  useEffect(() => {
    if (phase !== 'countIn' || !chart) return;
    if (count === 0) {
      clock.reset();
      useKomuzPlayerStore.getState().play(chart.trackId);
      setPhase('playing');
      return;
    }
    if (!reducedMotion && Platform.OS !== 'web') void hapticSelection().catch(() => {});
    const timer = setTimeout(() => setCount(count - 1), 1000);
    return () => clearTimeout(timer);
  }, [phase, count, chart, clock, reducedMotion]);

  // Visual lane + end of round, ~30 fps while playing.
  useEffect(() => {
    if (phase !== 'playing' && phase !== 'author') return;
    let frame = 0;
    const tick = () => {
      const time = clock.now();
      if (time !== null) setNow(time);
      if (phase === 'playing' && chart && time !== null && time > chart.beats[chart.beats.length - 1] + GOOD_WINDOW + 0.6) {
        useKomuzPlayerStore.getState().stop();
        setPhase('result');
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [phase, chart, clock]);

  // Backgrounding pauses the player (shared policy) -> the round ends; it
  // never resumes on its own.
  const wasPlaying = useRef(false);
  useEffect(() => {
    if (phase === 'playing' && wasPlaying.current && !playing) setPhase('cancelled');
    wasPlaying.current = playing;
  }, [playing, phase]);

  const start = (next: RhythmChart) => {
    setChart(next);
    setRound(NEW_ROUND);
    setLastGrade(null);
    setCount(3);
    setPhase('countIn');
  };

  const tap = () => {
    const time = clock.now();
    if (phase === 'author') {
      if (time !== null) setAuthored((list) => [...list, Math.round(time * 100) / 100]);
      return;
    }
    if (phase !== 'playing' || !chart || time === null) return;
    const result = judgeTap(chart.beats, round, time);
    setRound(result.round);
    setLastGrade(result.grade ?? 'miss');
    if (result.grade && !reducedMotion && Platform.OS !== 'web') void hapticImpact('light').catch(() => {});
  };

  const titleOf = (trackId: string) => komuzTracks.find((track) => track.id === trackId);
  const header = (
    <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
      <IconButton
        icon={ChevronLeft}
        shape="roundedSquare"
        accessibilityLabel={t('common.back')}
        onPress={() => {
          useKomuzPlayerStore.getState().stop();
          onPressBack();
        }}
      />
      <Text style={styles.title} accessibilityRole="header">
        {t('rhythm.title')}
      </Text>
    </View>
  );

  if (phase === 'choose') {
    return (
      <View style={styles.root}>
        {header}
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}>
          <Text style={styles.intro}>{t('rhythm.intro')}</Text>
          <AnimatedPressable style={styles.trackRow} onPress={() => router.push('/culture/komuz/repeat' as never)} accessibilityRole="button" accessibilityLabel={`${t('rhythmRepeat.entry')}. ${t('rhythmRepeat.entryHint')}`} testID="rhythm-repeat-mode">
            <Text style={styles.trackTitle}>{t('rhythmRepeat.entry')}</Text>
            <Text style={styles.meta}>{t('rhythmRepeat.entryHint')}</Text>
          </AnimatedPressable>
          {charts.length === 0 ? <Text style={styles.empty}>{t('rhythm.noCharts')}</Text> : <Text style={styles.label}>{t('rhythm.chooseTrack')}</Text>}
          {charts.map((entry) => {
            const track = titleOf(entry.trackId)!;
            return (
              <AnimatedPressable key={entry.trackId} style={styles.trackRow} onPress={() => start(entry)} accessibilityRole="button" accessibilityLabel={`${t('rhythm.practice')}: ${track.title}${track.titleConfirmed ? '' : `. ${t('komuzRoom.titleUnconfirmed')}`}`}>
                <Text style={styles.trackTitle}>{track.title}</Text>
                {!track.titleConfirmed ? <Text style={styles.unconfirmed}>{t('komuzRoom.titleUnconfirmed')}</Text> : null}
              </AnimatedPressable>
            );
          })}
          {/* Development only: tap along to AUTHOR a chart, then review it by ear. */}
          {__DEV__ ? (
            <View style={styles.dev}>
              <Text style={styles.label}>Author a chart (dev)</Text>
              {komuzTracks.map((track) => (
                <AnimatedPressable
                  key={track.id}
                  style={styles.devRow}
                  onPress={() => {
                    setChart({ trackId: track.id, beats: [], authoredBy: 'dev', reviewed: false });
                    setAuthored([]);
                    clock.reset();
                    useKomuzPlayerStore.getState().play(track.id);
                    setPhase('author');
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`Author ${track.title}`}
                >
                  <Text style={styles.devText}>{track.title}</Text>
                </AnimatedPressable>
              ))}
            </View>
          ) : null}
        </ScrollView>
      </View>
    );
  }

  if (phase === 'result' || phase === 'cancelled') {
    const result = chart ? roundResult(chart.beats, round) : null;
    return (
      <View style={styles.root}>
        {header}
        <View style={[styles.content, styles.center]}>
          {phase === 'cancelled' ? <Text style={styles.big}>{t('rhythm.paused')}</Text> : null}
          {result && phase === 'result' ? (
            <View style={{ gap: spacing.xs, alignItems: 'center' }} accessible accessibilityLabel={`${t('rhythm.beatsHit')}: ${result.hit} / ${result.total}. ${t('rhythm.goodTiming')}: ${result.perfect}. ${t('rhythm.missed')}: ${result.missed}.`}>
              <Text style={styles.big}>
                {t('rhythm.beatsHit')}: {result.hit} / {result.total}
              </Text>
              {!isChild ? (
                <>
                  <Text style={styles.meta}>
                    {t('rhythm.perfect')}: {result.perfect} · {t('rhythm.good')}: {result.good}
                  </Text>
                  <Text style={styles.meta}>
                    {t('rhythm.missed')}: {result.missed}
                  </Text>
                </>
              ) : null}
            </View>
          ) : null}
          {chart ? <Button label={t('rhythm.tryAgain')} onPress={() => start(chart)} /> : null}
          <Button label={t('rhythm.chooseTrack')} variant="secondary" onPress={() => setPhase('choose')} />
        </View>
      </View>
    );
  }

  const misses = chart && phase === 'playing' ? missedBeats(chart.beats, round, now) : 0;
  const lane = chart && phase === 'playing' ? upcomingBeats(chart.beats, now) : [];
  return (
    <View style={styles.root}>
      {header}
      <View style={[styles.content, styles.center]}>
        {phase === 'countIn' ? (
          <Text style={styles.count} accessibilityLiveRegion="assertive">
            {count > 0 ? count : t('rhythm.ready')}
          </Text>
        ) : null}
        {phase === 'playing' ? (
          <>
            {/* Visual beat cue: incoming pulses move to the line (not audio-only). */}
            <View style={styles.lane} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              <View style={styles.hitLine} />
              {lane.map((beat) => (
                <View key={beat} style={[styles.pulse, { left: `${Math.max(0, Math.min(100, 10 + ((beat - now) / 2) * 85))}%` }]} />
              ))}
            </View>
            <Text style={[styles.grade, lastGrade === 'miss' && styles.gradeMiss]} accessibilityLiveRegion="polite">
              {lastGrade ? t(`rhythm.${lastGrade}`) : t('rhythm.tapWithBeat')}
            </Text>
            {!isChild ? <Text style={styles.meta}>{t('rhythm.missedSoFar', { count: misses })}</Text> : null}
          </>
        ) : null}
        {phase === 'author' ? (
          <>
            <Text style={styles.meta}>Tap on every beat. {authored.length} taps</Text>
            <Text style={styles.json} selectable>
              {JSON.stringify(authored)}
            </Text>
            <Button label="Stop" variant="secondary" onPress={() => (useKomuzPlayerStore.getState().stop(), setPhase('choose'))} />
          </>
        ) : null}
        <Pressable
          style={({ pressed }) => [styles.tap, isChild && styles.tapChild, pressed && styles.tapPressed]}
          onPress={tap}
          disabled={phase === 'countIn'}
          accessibilityRole="button"
          accessibilityLabel={t('rhythm.tapWithBeat')}
        >
          <Text style={styles.tapText}>{t('rhythm.tap')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  title: { ...typography.h1, color: colors.textPrimary, flex: 1 },
  content: { paddingHorizontal: spacing.md, gap: spacing.md },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  intro: { ...textStyles.body, color: colors.textSecondary },
  empty: { ...textStyles.body, color: colors.textSecondary, padding: spacing.md, borderRadius: radii.lg, backgroundColor: colors.surfaceMuted },
  label: { ...typography.overline, color: colors.accentTerracotta },
  trackRow: { gap: 2, padding: spacing.md, borderRadius: radii.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.surfaceBorder },
  trackTitle: { ...textStyles.bodyMedium, fontWeight: '700', color: colors.textPrimary },
  unconfirmed: { ...textStyles.small, color: colors.accentTerracotta },
  dev: { gap: spacing.xs, marginTop: spacing.lg, padding: spacing.sm, borderRadius: radii.md, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.textMuted },
  devRow: { minHeight: 36, justifyContent: 'center' },
  devText: { ...textStyles.small, color: colors.textSecondary },
  count: { fontSize: 72, fontWeight: '800', color: colors.primary },
  lane: { width: '100%', height: 56, borderRadius: radii.lg, backgroundColor: colors.surfaceMuted, overflow: 'hidden', justifyContent: 'center' },
  hitLine: { position: 'absolute', left: '10%', top: 0, bottom: 0, width: 3, backgroundColor: colors.accentGold },
  pulse: { position: 'absolute', width: 18, height: 18, borderRadius: 9, marginLeft: -9, backgroundColor: colors.primary },
  grade: { ...textStyles.h2, color: colors.primary },
  gradeMiss: { color: colors.textSecondary },
  meta: { ...textStyles.small, color: colors.textSecondary },
  big: { ...textStyles.h2, color: colors.textPrimary, textAlign: 'center' },
  json: { ...textStyles.small, color: colors.textPrimary, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  tap: { width: 200, height: 200, borderRadius: 100, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accentGold },
  tapChild: { width: 260, height: 260, borderRadius: 130 },
  tapPressed: { opacity: 0.8, transform: [{ scale: 0.97 }] },
  tapText: { ...textStyles.h2, color: colors.textPrimary },
});
