import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTrackScreenView } from '@/services/analytics/useTrackScreenView';
import { useProgressStore } from '@/store/useProgressStore';
import { spacing, typography } from '@/theme';

import { ContextActionButton } from '../../ui/ContextActionButton';
import { SprintButtonView, useSprintButton } from '../../controls/SprintButton';
import { useVirtualJoystick, VirtualJoystickView } from '../../controls/VirtualJoystick';
import { Game3DCanvas } from '../../core/Game3DCanvas';
import { Game3DErrorBoundary } from '../../core/Game3DErrorBoundary';
import { useGameLifecycle } from '../../core/useGameLifecycle';
import { hasSeenTutorial, markTutorialSeen } from '../../core/tutorialStorage';
import { gameHaptics } from '../../haptics/gameHaptics';
import { ErrorOverlay } from '../../ui/ErrorOverlay';
import { GameAboutCard } from '../../ui/GameAboutCard';
import { GameHUD } from '../../ui/GameHUD';
import { GameIntroCard } from '../../ui/GameIntroCard';
import { PauseMenu } from '../../ui/PauseMenu';
import { PracticeBar } from '../../ui/PracticeBar';
import { ResultScreen } from '../../ui/ResultScreen';
import { StartCountdown } from '../../ui/StartCountdown';
import { TutorialOverlay } from '../../ui/TutorialOverlay';
import { useKokBoruGame } from './KokBoruController';
import { createKokBoruAudio } from './kokBoruAudio';
import { KokBoruScene } from './KokBoruScene';
import { MATCH_DURATION_S, type KokBoruMode } from './KokBoruTypes';

const TUTORIAL_STEPS = ['games3d.kokBoru.tutorial1', 'games3d.kokBoru.tutorial2', 'games3d.kokBoru.tutorial3'];
const GAME_ID = 'kok_boru';

type KokBoruGameProps = {
  mode?: KokBoruMode;
};

export function KokBoruGame({ mode = 'normal' }: KokBoruGameProps) {
  useTrackScreenView('games3d_kok_boru');
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { isBackgrounded } = useGameLifecycle('landscape');
  const game = useKokBoruGame(mode);
  const joystick = useVirtualJoystick();
  const sprint = useSprintButton();
  const recordedResultRef = useRef(false);

  const audioRef = useRef(createKokBoruAudio());
  useEffect(() => () => audioRef.current.dispose(), []);
  const prevPossessionRef = useRef(game.possession);

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

  useEffect(() => {
    if (isBackgrounded) game.pause();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isBackgrounded]);

  useEffect(() => {
    if (game.phase !== 'RESULT') return;
    // Practice always ends on its own timeout/no-score note (Haptics
    // matches the old scored/not-scored feel); normal mode's win/draw/loss
    // gets a matching positive/neutral/negative haptic instead.
    const positive = mode === 'practice' ? game.summary.scored : game.summary.outcome === 'WIN';
    void (positive ? gameHaptics.success() : gameHaptics.warning());
    // "Final whistle" (Section "final whistle") - the match/round is over,
    // independent of win/loss framing (which the haptic above already
    // carries).
    audioRef.current.play('whistle', 0.6);
  }, [game.phase, game.summary.scored, game.summary.outcome, mode]);

  useEffect(() => {
    if (game.phase !== 'GOAL_PAUSE' || !game.lastScorer) return;
    const playerScored = game.lastScorer === 'player';
    void (playerScored ? gameHaptics.success() : gameHaptics.warning());
    audioRef.current.play(playerScored ? 'goalPlayer' : 'goalAi', 0.65);
  }, [game.phase, game.lastScorer]);

  // No scored/higher-is-better metric exists for practice (Phase A: score
  // or don't) - games played only, same reasoning as Kyz Kuumai. Normal
  // mode's win/loss/draw isn't a "best score" either, so this stays as-is
  // for both modes.
  useEffect(() => {
    if (game.phase !== 'RESULT') {
      recordedResultRef.current = false;
      return;
    }
    if (recordedResultRef.current) return;
    recordedResultRef.current = true;
    void useProgressStore.getState().recordGamePlayed(GAME_ID);
  }, [game.phase]);

  useEffect(() => {
    if (mode === 'normal') return;
    if (game.possession === 'PLAYER') {
      void gameHaptics.medium();
      audioRef.current.play('pickup', 0.55);
    }
  }, [game.possession, mode]);

  // Normal mode: possession changing hands (pickup or steal, either
  // direction) is worth a tap regardless of which side it favors -
  // separate from practice's player-only haptic above. "Pickup" (from
  // FREE) and "steal" (taken directly from the other side) get distinct
  // sounds since both are explicitly requested events (Section "pickup" /
  // "steal"), even though the haptic itself doesn't need to differ.
  useEffect(() => {
    const prev = prevPossessionRef.current;
    prevPossessionRef.current = game.possession;
    if (mode !== 'normal' || game.possession === 'FREE' || game.possession === prev) return;
    void gameHaptics.medium();
    audioRef.current.play(prev === 'FREE' ? 'pickup' : 'steal', 0.55);
  }, [game.possession, mode]);

  const handleExit = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/games');
  }, []);

  const playing = game.phase === 'PLAYING';
  const hudVisible = playing || game.phase === 'PAUSED' || game.phase === 'GOAL_PAUSE';

  const actionLabel = game.possession === 'PLAYER' ? t('games3d.kokBoru.throw') : t('games3d.kokBoru.pickUp');
  const actionEnabled = game.possession === 'PLAYER' || game.canPickUp;
  const handleAction = game.possession === 'PLAYER' ? game.drop : game.pickUp;

  const resultStats = useMemo(() => {
    if (mode === 'practice') {
      return [
        { label: t('games3d.kyzKuumai.time'), value: `${game.summary.elapsedSeconds.toFixed(1)}s` },
        { label: t('games3d.kyzKuumai.topSpeed'), value: `${game.summary.topSpeed.toFixed(1)} m/s` },
      ];
    }
    return [
      { label: t('games3d.kokBoru.you'), value: String(game.summary.playerScore) },
      { label: t('games3d.kokBoru.opponent'), value: String(game.summary.aiScore) },
    ];
  }, [game.summary, mode, t]);

  const resultTitle =
    mode === 'practice'
      ? game.summary.scored
        ? t('games3d.kokBoru.scoredTitle')
        : t('games3d.kokBoru.notScoredTitle')
      : game.summary.outcome === 'WIN'
        ? t('games3d.result.win')
        : game.summary.outcome === 'LOSS'
          ? t('games3d.result.lose')
          : t('games3d.result.draw');

  const possessionLabel =
    game.possession === 'PLAYER'
      ? t('games3d.kokBoru.you')
      : game.possession === 'AI'
        ? t('games3d.kokBoru.opponent')
        : t('games3d.kokBoru.free');

  const timeRemaining = mode === 'normal' ? Math.max(0, MATCH_DURATION_S - game.liveElapsedSeconds) : null;

  return (
    <View style={styles.root}>
      <Game3DErrorBoundary fallback={(retry) => <ErrorOverlay onRetry={retry} onExit={handleExit} />}>
        <Game3DCanvas isPaused={game.phase === 'PAUSED'}>
          <KokBoruScene
            phase={game.phase}
            possession={game.possession}
            playerHorseRef={game.playerHorseRef}
            aiHorseRef={game.aiHorseRef}
            showAiHorse={mode === 'normal'}
            objectPositionRef={game.objectPositionRef}
            moveX={joystick.moveX}
            moveZ={joystick.moveZ}
            sprintHeld={sprint.sprintHeld}
            onTick={game.onTick}
          />
        </Game3DCanvas>
      </Game3DErrorBoundary>

      {hudVisible ? (
        <GameHUD
          title={t('games3d.titles.kokBoru')}
          onPause={game.pause}
          primaryStat={
            mode === 'normal'
              ? { label: t('games3d.kokBoru.score'), value: `${game.score.player}-${game.score.ai}` }
              : { label: t('games3d.kokBoru.possession'), value: possessionLabel }
          }
          secondaryStat={
            mode === 'practice'
              ? { label: t('games3d.kokBoru.scoredCount'), value: String(game.practiceScoreCount) }
              : { label: t('games3d.kyzKuumai.time'), value: `${(timeRemaining ?? 0).toFixed(0)}s` }
          }
        />
      ) : null}

      {game.phase === 'GOAL_PAUSE' ? (
        <View style={styles.goalBanner} pointerEvents="none">
          <Text style={styles.goalText}>{game.lastScorer === 'player' ? t('games3d.kokBoru.playerScored') : t('games3d.kokBoru.aiScored')}</Text>
        </View>
      ) : null}

      {playing ? (
        <View pointerEvents="box-none" style={[styles.controlsRow, { paddingBottom: insets.bottom + spacing.lg }]}>
          <View pointerEvents="box-none" style={styles.controlSlot}>
            <VirtualJoystickView gesture={joystick.gesture} knobX={joystick.knobX} knobY={joystick.knobY} />
          </View>
          <View pointerEvents="box-none" style={[styles.controlSlot, styles.rightControls]}>
            {mode === 'practice' ? <ContextActionButton label={actionLabel} enabled={actionEnabled} onPress={handleAction} /> : null}
            <SprintButtonView sprintHeld={sprint.sprintHeld} />
          </View>
        </View>
      ) : null}

      <PracticeBar
        visible={mode === 'practice' && playing}
        onReset={game.resetObject}
        onExit={handleExit}
        resetLabel={t('games3d.kokBoru.resetObject')}
        exitLabel={t('games3d.practice.exit')}
      />

      <GameIntroCard visible={game.phase === 'INTRO'} title={t('games3d.titles.kokBoru')} onDone={game.finishIntro} />

      <GameAboutCard
        visible={helpStage === 'about'}
        title={t('games3d.titles.kokBoru')}
        description={t('games3d.kokBoru.aboutDescription')}
        objective={t('games3d.kokBoru.aboutObjective')}
        onDone={handleAboutDone}
      />

      <TutorialOverlay visible={helpStage === 'controls'} stepKeys={TUTORIAL_STEPS} onDone={handleTutorialDone} />

      <StartCountdown visible={game.phase === 'READY'} onDone={game.start} />

      <PauseMenu
        visible={game.phase === 'PAUSED' && helpStage === null}
        onResume={game.resume}
        onRestart={game.restart}
        onExit={handleExit}
        onHowToPlay={handleHowToPlay}
      />

      <ResultScreen visible={game.phase === 'RESULT'} title={resultTitle} stats={resultStats} onReplay={game.restart} onExit={handleExit} />
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
  rightControls: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'center',
  },
  goalBanner: {
    position: 'absolute',
    top: '30%',
    alignSelf: 'center',
    backgroundColor: 'rgba(232,185,61,0.92)',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 999,
  },
  goalText: {
    ...typography.h1,
    color: '#2B2019',
  },
});
