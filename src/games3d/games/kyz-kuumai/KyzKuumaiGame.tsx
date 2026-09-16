import { useProgress } from '@react-three/drei';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { GestureDetector } from 'react-native-gesture-handler';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTrackScreenView } from '@/services/analytics/useTrackScreenView';
import { useProgressStore } from '@/store/useProgressStore';
import { colors, spacing, typography } from '@/theme';

import { SprintButtonView, useSprintButton } from '../../controls/SprintButton';
import { useVirtualJoystick, VirtualJoystickView } from '../../controls/VirtualJoystick';
import { Game3DCanvas } from '../../core/Game3DCanvas';
import { Game3DErrorBoundary } from '../../core/Game3DErrorBoundary';
import { useGameLifecycle } from '../../core/useGameLifecycle';
import { hasSeenTutorial, markTutorialSeen } from '../../core/tutorialStorage';
import { gameHaptics } from '../../haptics/gameHaptics';
import { preloadHorseModel } from '../../shared/assets/preloadModels';
import { ErrorOverlay } from '../../ui/ErrorOverlay';
import { GameAboutCard } from '../../ui/GameAboutCard';
import { GameHUD } from '../../ui/GameHUD';
import { GameIntroCard } from '../../ui/GameIntroCard';
import { LoadingOverlay } from '../../ui/LoadingOverlay';
import { PauseMenu } from '../../ui/PauseMenu';
import { ResultScreen } from '../../ui/ResultScreen';
import { StartCountdown } from '../../ui/StartCountdown';
import { TutorialOverlay } from '../../ui/TutorialOverlay';
import { useKyzKuumaiGame } from './KyzKuumaiController';
import { createKyzKuumaiAudio } from './kyzKuumaiAudio';
import { KyzKuumaiScene } from './KyzKuumaiScene';
import type { KyzKuumaiDifficulty, KyzKuumaiMode } from './KyzKuumaiTypes';

const TUTORIAL_STEPS = ['games3d.kyzKuumai.tutorial1', 'games3d.kyzKuumai.tutorial2', 'games3d.kyzKuumai.tutorial3'];
const GAME_ID = 'kyz_kuumai';
// Coaching text per checkpoint reached (Section "KYZ KUUMAI PRACTICE":
// teach steering, then sprint, then turning) - index 0 is shown before any
// checkpoint, index 1 after the 1st, etc.
const COACHING_KEYS = [
  'games3d.kyzKuumai.coachSteer',
  'games3d.kyzKuumai.coachSprint',
  'games3d.kyzKuumai.coachTurn',
  'games3d.kyzKuumai.coachFinish',
];

type KyzKuumaiGameProps = {
  difficulty?: KyzKuumaiDifficulty;
  mode?: KyzKuumaiMode;
};

export function KyzKuumaiGame({ difficulty = 'normal', mode = 'normal' }: KyzKuumaiGameProps) {
  useTrackScreenView('games3d_kyz_kuumai');
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const game = useKyzKuumaiGame(difficulty, mode);
  useGameLifecycle('landscape', game.pause);
  // Starts the horse GLB fetch/parse as soon as this screen mounts (Section
  // "Preload... before gameplay starts") - both the player and AI horse
  // (KyzKuumaiScene.tsx) use the same modelId, so this one call covers
  // both; a no-op if already cached from a previous visit this session.
  useEffect(() => {
    preloadHorseModel('quaterniusHorse');
  }, []);
  // Tracks both horse GLBs' fetch/parse (Section 12) - same shared/global
  // useProgress used by JaaAtuuGame.tsx.
  const { active: modelsLoading, progress: modelsProgress } = useProgress();
  const joystick = useVirtualJoystick();
  const sprint = useSprintButton();
  const recordedResultRef = useRef(false);

  const audioRef = useRef(createKyzKuumaiAudio());
  useEffect(() => () => audioRef.current.dispose(), []);
  const lastCheckpointKeyRef = useRef<number | null>(null);
  const lastHoofbeatAtRef = useRef(0);

  const [helpStage, setHelpStage] = useState<'about' | 'controls' | null>(null);

  useEffect(() => {
    if (game.phase !== 'TUTORIAL') return;
    let cancelled = false;
    hasSeenTutorial(GAME_ID).then((seen) => {
      if (cancelled) return;
      if (seen) game.finishTutorial();
      else setHelpStage('about');
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.phase]);

  const handleAboutDone = useCallback(() => setHelpStage('controls'), []);

  const handleTutorialDone = useCallback(() => {
    setHelpStage(null);
    void markTutorialSeen(GAME_ID);
    if (game.phase === 'TUTORIAL') game.finishTutorial();
  }, [game]);

  const handleHowToPlay = useCallback(() => setHelpStage('about'), []);

  // Practice mode skips the pre-match countdown entirely (Section
  // "Practice mode does NOT need the countdown") - normal mode's
  // `READY` -> `PLAYING` transition instead waits for
  // `<StartCountdown onDone={game.startChase}>` below.
  useEffect(() => {
    if (mode === 'practice' && game.phase === 'READY') game.startChase();
  }, [mode, game.phase, game.startChase]);

  useEffect(() => {
    if (game.phase !== 'RESULT') return;
    // Practice always finishes by reaching the finish line, never by being
    // caught - that's a completion, not a "not caught" loss, so it always
    // gets the positive haptic regardless of `summary.caught`.
    const positive = mode === 'practice' || game.summary.caught;
    void (positive ? gameHaptics.success() : gameHaptics.warning());
    // "Finish" (Section "finish") plays whenever the chase/course ends,
    // regardless of caught/not-caught - that framing belongs to the haptic
    // above and the result title, not to whether a sound plays at all.
    audioRef.current.play('finish', 0.6);
  }, [game.phase, game.summary.caught, mode]);

  // Checkpoint cue (Section "checkpoint") - `checkpointEvent.key` increments
  // once per checkpoint crossed (KyzKuumaiController.ts), so this fires
  // exactly once per checkpoint rather than once per render.
  useEffect(() => {
    const key = game.checkpointEvent?.key ?? null;
    if (key === null || key === lastCheckpointKeyRef.current) return;
    lastCheckpointKeyRef.current = key;
    void gameHaptics.medium();
    audioRef.current.play('checkpoint', 0.55);
  }, [game.checkpointEvent]);

  // No single "higher is better" score exists for a time-based chase (a
  // faster catch is *better* despite a *lower* number) - tracked here as
  // games played only; not force-fit into the higher-is-better
  // gameBestScore helper used by the scored games (Section: honest scoping,
  // don't fake a metric that doesn't fit).
  useEffect(() => {
    if (game.phase !== 'RESULT') {
      recordedResultRef.current = false;
      return;
    }
    if (recordedResultRef.current) return;
    recordedResultRef.current = true;
    void useProgressStore.getState().recordGamePlayed(GAME_ID);
  }, [game.phase]);

  const handleExit = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/games');
  }, []);

  // Hoofbeat (Section "horse movement/hoof sound") - `GameAudioManager` is
  // fire-and-forget/one-shot, not a loop player, so a real per-hoofstep
  // sound is approximated by re-triggering a short footstep sample on a
  // throttle while the horse is actually moving, instead of building a new
  // looping-audio capability just for this one slot.
  const handleTick = useCallback(
    (dt: number) => {
      game.onTick(dt);
      if (game.phase !== 'PLAYING') return;
      if (game.playerHorseRef.current.speed <= 0.5) return;
      const now = Date.now();
      if (now - lastHoofbeatAtRef.current < 260) return;
      lastHoofbeatAtRef.current = now;
      audioRef.current.play('hoofbeat', 0.3);
    },
    [game],
  );

  const handleSprintPressIn = useCallback(() => {
    audioRef.current.play('sprint', 0.4);
  }, []);

  const playing = game.phase === 'PLAYING';
  const hudVisible = playing || game.phase === 'PAUSED';

  const checkpointsReached = (game.checkpointEvent?.index ?? -1) + 1;

  const resultStats = useMemo(() => {
    if (mode === 'practice') {
      return [
        { label: t('games3d.kyzKuumai.time'), value: `${game.summary.elapsedSeconds.toFixed(1)}s` },
        { label: t('games3d.kyzKuumai.topSpeed'), value: `${game.summary.topSpeed.toFixed(1)} m/s` },
        { label: t('games3d.kyzKuumai.checkpoints'), value: `${checkpointsReached}/${game.totalCheckpoints}` },
      ];
    }
    return [
      { label: t('games3d.kyzKuumai.time'), value: `${game.summary.elapsedSeconds.toFixed(1)}s` },
      { label: t('games3d.kyzKuumai.topSpeed'), value: `${game.summary.topSpeed.toFixed(1)} m/s` },
      { label: t('games3d.kyzKuumai.closest'), value: `${game.summary.closestDistance.toFixed(1)}m` },
    ];
  }, [game.summary, game.totalCheckpoints, checkpointsReached, mode, t]);

  const resultTitle =
    mode === 'practice'
      ? t('games3d.kyzKuumai.trainingComplete')
      : game.summary.caught
        ? t('games3d.kyzKuumai.caughtTitle')
        : t('games3d.kyzKuumai.notCaughtTitle');

  const coachingText = mode === 'practice' && playing ? t(COACHING_KEYS[Math.min(checkpointsReached, COACHING_KEYS.length - 1)]) : null;

  return (
    <View style={styles.root}>
      <Game3DErrorBoundary fallback={(retry) => <ErrorOverlay onRetry={retry} onExit={handleExit} />}>
        <Game3DCanvas isPaused={game.phase === 'PAUSED'}>
          <KyzKuumaiScene
            phase={game.phase}
            playerHorseRef={game.playerHorseRef}
            aiHorseRef={game.aiHorseRef}
            showAiHorse={mode !== 'practice'}
            moveX={joystick.moveX}
            moveZ={joystick.moveZ}
            sprintHeld={sprint.sprintHeld}
            onTick={handleTick}
          />
        </Game3DCanvas>
      </Game3DErrorBoundary>

      {hudVisible ? (
        <GameHUD
          title={t('games3d.titles.kyzKuumai')}
          onPause={game.pause}
          primaryStat={
            mode === 'practice'
              ? { label: t('games3d.kyzKuumai.checkpoints'), value: `${checkpointsReached}/${game.totalCheckpoints}` }
              : { label: t('games3d.kyzKuumai.distance'), value: `${game.liveDistance.toFixed(1)}m` }
          }
          secondaryStat={{ label: t('games3d.kyzKuumai.time'), value: `${game.liveElapsedSeconds.toFixed(0)}s` }}
        />
      ) : null}

      {coachingText ? (
        <View style={styles.coachingBanner} pointerEvents="none">
          <Text style={styles.coachingText}>{coachingText}</Text>
        </View>
      ) : null}

      {playing ? (
        <View pointerEvents="box-none" style={[styles.controlsRow, { paddingBottom: insets.bottom + spacing.lg }]}>
          <View pointerEvents="box-none" style={styles.controlSlot}>
            <VirtualJoystickView gesture={joystick.gesture} knobX={joystick.knobX} knobY={joystick.knobY} />
          </View>
          <View pointerEvents="box-none" style={styles.controlSlot}>
            <SprintButtonView sprintHeld={sprint.sprintHeld} onPressIn={handleSprintPressIn} />
          </View>
        </View>
      ) : null}

      <GameIntroCard visible={game.phase === 'INTRO'} title={t('games3d.titles.kyzKuumai')} onDone={game.finishIntro} />

      <GameAboutCard
        visible={helpStage === 'about'}
        title={t('games3d.titles.kyzKuumai')}
        description={t('games3d.kyzKuumai.aboutDescription')}
        objective={t('games3d.kyzKuumai.aboutObjective')}
        onDone={handleAboutDone}
      />

      <TutorialOverlay visible={helpStage === 'controls'} stepKeys={TUTORIAL_STEPS} onDone={handleTutorialDone} />

      <StartCountdown visible={game.phase === 'READY' && mode === 'normal'} onDone={game.startChase} />

      <PauseMenu
        visible={game.phase === 'PAUSED' && helpStage === null}
        onResume={game.resume}
        onRestart={game.restart}
        onExit={handleExit}
        onHowToPlay={handleHowToPlay}
      />

      <ResultScreen visible={game.phase === 'RESULT'} title={resultTitle} stats={resultStats} onReplay={game.restart} onExit={handleExit} />

      <LoadingOverlay visible={modelsLoading} progress={modelsProgress / 100} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  controlsRow: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    alignItems: 'flex-end',
  },
  controlSlot: {
    alignItems: 'center',
  },
  coachingBanner: {
    position: 'absolute',
    top: '14%',
    alignSelf: 'center',
    maxWidth: '80%',
    backgroundColor: 'rgba(20,14,8,0.6)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
  },
  coachingText: {
    ...typography.bodyBold,
    color: colors.textOnDark,
    textAlign: 'center',
  },
});
