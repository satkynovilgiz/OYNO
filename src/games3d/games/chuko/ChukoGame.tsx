import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { GestureDetector } from 'react-native-gesture-handler';
import { StyleSheet, View } from 'react-native';

import { useTrackScreenView } from '@/services/analytics/useTrackScreenView';
import { useProgressStore } from '@/store/useProgressStore';

import { useDragPowerController } from '../../controls/DragPowerController';
import { Game3DCanvas } from '../../core/Game3DCanvas';
import { Game3DErrorBoundary } from '../../core/Game3DErrorBoundary';
import { setBestScoreIfHigher } from '../../core/gameBestScore';
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
import { StatusBanner } from '../../ui/StatusBanner';
import { TutorialOverlay } from '../../ui/TutorialOverlay';
import { useChukoGame } from './ChukoController';
import { createChukoAudio } from './chukoAudio';
import { ChukoScene } from './ChukoScene';
import type { ChukoDifficulty, ChukoMode } from './ChukoTypes';

const TUTORIAL_STEPS = ['games3d.chuko.tutorial1', 'games3d.chuko.tutorial2', 'games3d.chuko.tutorial3', 'games3d.chuko.tutorial4'];
const GAME_ID = 'chuko';

function hapticFor(scoreDelta: number) {
  if (scoreDelta > 1) return gameHaptics.heavy();
  if (scoreDelta > 0) return gameHaptics.medium();
  return gameHaptics.light();
}

type ChukoGameProps = {
  difficulty?: ChukoDifficulty;
  mode?: ChukoMode;
};

export function ChukoGame({ difficulty = 'normal', mode = 'normal' }: ChukoGameProps) {
  useTrackScreenView('games3d_chuko');
  const { t } = useTranslation();
  const game = useChukoGame(difficulty, mode);
  useGameLifecycle('landscape', game.pause);
  const lastOutcomeKeyRef = useRef(0);
  const recordedResultRef = useRef(false);
  const [hasThrown, setHasThrown] = useState(false);

  const audioRef = useRef(createChukoAudio());
  useEffect(() => () => audioRef.current.dispose(), []);

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

  // 3-2-1-GO before the match's first throw only (Section "3-second
  // countdown before normal matches") - same reasoning as OrdoGame.tsx:
  // `PLAYER_TURN` is re-entered after every throw, so `countdownShownRef`
  // gates this to the first entry per match; reset on restart. Practice
  // mode never shows it. Gating `useDragPowerController`'s `enabled` on
  // `!showCountdown` freezes throwing for the countdown's duration
  // regardless of which path into PLAYER_TURN fired.
  const [showCountdown, setShowCountdown] = useState(false);
  const countdownShownRef = useRef(false);

  useEffect(() => {
    if (mode !== 'normal' || game.phase !== 'PLAYER_TURN' || countdownShownRef.current) return;
    countdownShownRef.current = true;
    setShowCountdown(true);
  }, [game.phase, mode]);

  const handleCountdownDone = useCallback(() => setShowCountdown(false), []);

  const handleRestart = useCallback(() => {
    countdownShownRef.current = false;
    setShowCountdown(false);
    setLandingMessage(null);
    game.restart();
  }, [game]);

  useEffect(() => {
    if (game.phase !== 'RESULT') {
      recordedResultRef.current = false;
      return;
    }
    if (recordedResultRef.current) return;
    recordedResultRef.current = true;
    void useProgressStore.getState().recordGamePlayed(GAME_ID);
    void setBestScoreIfHigher(GAME_ID, game.summary.playerScore);

    if (mode === 'normal') {
      if (game.summary.winner === 'player') audioRef.current.play('success', 0.6);
      else if (game.summary.winner === 'ai') audioRef.current.play('loss', 0.55);
      else audioRef.current.play('draw', 0.5);
    }
  }, [game.phase, game.summary.playerScore, game.summary.winner, mode]);

  // "Show landing result" (Section "CHUKO PRACTICE") - a brief text readout
  // of what the throw actually did, not just a haptic buzz.
  const [landingMessage, setLandingMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!game.lastOutcome || game.lastOutcome.key === lastOutcomeKeyRef.current) return;
    lastOutcomeKeyRef.current = game.lastOutcome.key;
    const { outcome, side } = game.lastOutcome;
    void hapticFor(outcome.scoreDelta);
    // "Pieces hitting ground" plays for every resolved throw; a positive
    // capture on top of that also gets its own brighter "successful
    // result" chime, same layering as Ordo's pieceHit+clear.
    audioRef.current.play('land', 0.5);
    if (outcome.scoreDelta > 0) audioRef.current.play('success', 0.55);
    // Every throw is explained - the opponent's too, so the score change
    // is never a mystery.
    const count = outcome.captured.length;
    setLandingMessage(
      side === 'player'
        ? count > 0
          ? t('games3d.chuko.landingHit', { count })
          : t('games3d.chuko.landingMiss')
        : count > 0
          ? t('games3d.chuko.landingHitAi', { count })
          : t('games3d.chuko.landingMissAi'),
    );
  }, [game.lastOutcome, t]);

  // Own timer, keyed on the message: the old timer lived in the effect
  // above and was cancelled whenever `lastOutcome` changed (restart,
  // practice reset), leaving the banner stuck on screen.
  useEffect(() => {
    if (!landingMessage) return;
    const timer = setTimeout(() => setLandingMessage(null), 1600);
    return () => clearTimeout(timer);
  }, [landingMessage]);

  const handleRelease = useCallback(
    (payload: { angleOffset: number; power: number }) => {
      game.throwPlayer(payload.angleOffset, payload.power);
      setHasThrown(true);
      audioRef.current.play('throw', 0.55);
    },
    [game],
  );
  const drag = useDragPowerController({ enabled: game.phase === 'PLAYER_TURN' && !showCountdown, onRelease: handleRelease });

  const handleExit = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/games');
  }, []);

  const handleResetPieces = useCallback(() => {
    setHasThrown(false);
    setLandingMessage(null);
    game.resetPieces();
  }, [game]);

  const hudVisible = game.phase === 'PLAYER_TURN' || game.phase === 'SETTLING' || game.phase === 'AI_TURN' || game.phase === 'PAUSED';
  const inGameplayPhase = game.phase === 'PLAYER_TURN' || game.phase === 'SETTLING';
  const turnLabel =
    mode === 'practice'
      ? inGameplayPhase
        ? hasThrown
          ? t('games3d.ordo.practiceLabel')
          : t('games3d.ordo.practiceGuidance')
        : null
      : game.phase === 'AI_TURN'
        ? t('games3d.ordo.aiTurn')
        : game.phase === 'PLAYER_TURN'
          ? t('games3d.ordo.yourTurn')
          : null;

  const resultStats = useMemo(
    () => [
      { label: t('games3d.ordo.you'), value: String(game.summary.playerScore) },
      { label: t('games3d.ordo.ai'), value: String(game.summary.aiScore) },
    ],
    [game.summary, t],
  );

  const resultTitle =
    game.summary.winner === 'draw' ? t('games3d.result.draw') : game.summary.winner === 'player' ? t('games3d.result.win') : t('games3d.result.lose');

  return (
    <View style={styles.root}>
      <Game3DErrorBoundary fallback={(retry) => <ErrorOverlay onRetry={retry} onExit={handleExit} />}>
        <GestureDetector gesture={drag.gesture}>
          <View style={StyleSheet.absoluteFill}>
            <Game3DCanvas isPaused={game.phase === 'PAUSED'}>
              <ChukoScene phase={game.phase} world={game.world} onSettled={game.onSettled} pullX={drag.pullX} pullY={drag.pullY} isPulling={drag.isPulling} />
            </Game3DCanvas>
          </View>
        </GestureDetector>
      </Game3DErrorBoundary>

      {hudVisible ? (
        <GameHUD
          title={t('games3d.titles.chuko')}
          onPause={game.pause}
          practice={mode === 'practice'}
          primaryStat={
            mode === 'practice'
              ? { label: t('games3d.ordo.captures'), value: String(game.score.player) }
              : { label: t('games3d.ordo.you'), value: String(game.score.player) }
          }
          secondaryStat={mode === 'practice' ? undefined : { label: t('games3d.ordo.ai'), value: String(game.score.ai) }}
        />
      ) : null}

      <StatusBanner visible={!!turnLabel} text={turnLabel ?? ''} top="12%" />
      <StatusBanner visible={!!landingMessage && game.phase !== 'RESULT' && game.phase !== 'PAUSED'} text={landingMessage ?? ''} tone="accent" top="22%" maxWidth="70%" />

      <PracticeBar
        visible={mode === 'practice' && inGameplayPhase}
        onReset={handleResetPieces}
        onExit={handleExit}
        resetLabel={t('games3d.ordo.resetPieces')}
        exitLabel={t('games3d.practice.exit')}
      />

      <GameIntroCard visible={game.phase === 'INTRO'} title={t('games3d.titles.chuko')} onDone={game.finishIntro} />

      <GameAboutCard
        visible={helpStage === 'about'}
        title={t('games3d.titles.chuko')}
        description={t('games3d.chuko.aboutDescription')}
        objective={t('games3d.chuko.aboutObjective')}
        onDone={handleAboutDone}
      />

      <TutorialOverlay visible={helpStage === 'controls'} stepKeys={TUTORIAL_STEPS} onDone={handleTutorialDone} />

      <StartCountdown visible={showCountdown && game.phase !== 'PAUSED'} onDone={handleCountdownDone} />

      <PauseMenu
        gameTitle={t('games3d.titles.chuko')}
        visible={game.phase === 'PAUSED' && helpStage === null}
        onResume={game.resume}
        onRestart={handleRestart}
        onExit={handleExit}
        onHowToPlay={handleHowToPlay}
      />

      {mode === 'normal' ? (
        <ResultScreen
          visible={game.phase === 'RESULT'}
          title={resultTitle}
          outcome={game.summary.winner === 'player' ? 'win' : game.summary.winner === 'draw' ? 'completed' : 'tryAgain'}
          stats={resultStats}
          onReplay={handleRestart}
          onExit={handleExit}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
});
