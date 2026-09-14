import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { GestureDetector } from 'react-native-gesture-handler';
import { StyleSheet, Text, View } from 'react-native';

import { useTrackScreenView } from '@/services/analytics/useTrackScreenView';
import { useProgressStore } from '@/store/useProgressStore';
import { colors, typography } from '@/theme';

import { useDragPowerController } from '../../controls/DragPowerController';
import { Game3DCanvas } from '../../core/Game3DCanvas';
import { Game3DErrorBoundary } from '../../core/Game3DErrorBoundary';
import { setBestScoreIfHigher } from '../../core/gameBestScore';
import { useGameLifecycle } from '../../core/useGameLifecycle';
import { hasSeenTutorial, markTutorialSeen } from '../../core/tutorialStorage';
import { ErrorOverlay } from '../../ui/ErrorOverlay';
import { GameAboutCard } from '../../ui/GameAboutCard';
import { GameHUD } from '../../ui/GameHUD';
import { GameIntroCard } from '../../ui/GameIntroCard';
import { PauseMenu } from '../../ui/PauseMenu';
import { PracticeBar } from '../../ui/PracticeBar';
import { ResultScreen } from '../../ui/ResultScreen';
import { TutorialOverlay } from '../../ui/TutorialOverlay';
import { useChukoGame } from './ChukoController';
import { ChukoScene } from './ChukoScene';
import type { ChukoDifficulty, ChukoMode } from './ChukoTypes';

const TUTORIAL_STEPS = ['games3d.chuko.tutorial1', 'games3d.chuko.tutorial2', 'games3d.chuko.tutorial3', 'games3d.chuko.tutorial4'];
const GAME_ID = 'chuko';

function hapticFor(scoreDelta: number) {
  if (scoreDelta > 1) return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  if (scoreDelta > 0) return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}

type ChukoGameProps = {
  difficulty?: ChukoDifficulty;
  mode?: ChukoMode;
};

export function ChukoGame({ difficulty = 'normal', mode = 'normal' }: ChukoGameProps) {
  useTrackScreenView('games3d_chuko');
  const { t } = useTranslation();
  const { isBackgrounded } = useGameLifecycle('landscape');
  const game = useChukoGame(difficulty, mode);
  const lastOutcomeKeyRef = useRef(0);
  const recordedResultRef = useRef(false);
  const [hasThrown, setHasThrown] = useState(false);

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
    if (game.phase !== 'RESULT') {
      recordedResultRef.current = false;
      return;
    }
    if (recordedResultRef.current) return;
    recordedResultRef.current = true;
    void useProgressStore.getState().recordGamePlayed(GAME_ID);
    void setBestScoreIfHigher(GAME_ID, game.summary.playerScore);
  }, [game.phase, game.summary.playerScore]);

  // "Show landing result" (Section "CHUKO PRACTICE") - a brief text readout
  // of what the throw actually did, not just a haptic buzz.
  const [landingMessage, setLandingMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!game.lastOutcome || game.lastOutcome.key === lastOutcomeKeyRef.current) return;
    lastOutcomeKeyRef.current = game.lastOutcome.key;
    const { outcome, side } = game.lastOutcome;
    void hapticFor(outcome.scoreDelta);
    if (side === 'player') {
      setLandingMessage(outcome.scoreDelta > 0 ? t('games3d.chuko.landingHit', { count: outcome.captured.length }) : t('games3d.chuko.landingMiss'));
      const timer = setTimeout(() => setLandingMessage(null), 1600);
      return () => clearTimeout(timer);
    }
  }, [game.lastOutcome, t]);

  const handleRelease = useCallback(
    (payload: { angleOffset: number; power: number }) => {
      game.throwPlayer(payload.angleOffset, payload.power);
      setHasThrown(true);
    },
    [game],
  );
  const drag = useDragPowerController({ enabled: game.phase === 'PLAYER_TURN', onRelease: handleRelease });

  const handleExit = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/games');
  }, []);

  const handleResetPieces = useCallback(() => {
    setHasThrown(false);
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
          primaryStat={
            mode === 'practice'
              ? { label: t('games3d.ordo.captures'), value: String(game.score.player) }
              : { label: t('games3d.ordo.you'), value: String(game.score.player) }
          }
          secondaryStat={mode === 'practice' ? undefined : { label: t('games3d.ordo.ai'), value: String(game.score.ai) }}
        />
      ) : null}

      {turnLabel ? (
        <View style={styles.turnBanner} pointerEvents="none">
          <Text style={styles.turnText}>{turnLabel}</Text>
        </View>
      ) : null}

      {landingMessage ? (
        <View style={styles.landingBanner} pointerEvents="none">
          <Text style={styles.landingText}>{landingMessage}</Text>
        </View>
      ) : null}

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

      <PauseMenu
        visible={game.phase === 'PAUSED' && helpStage === null}
        onResume={game.resume}
        onRestart={game.restart}
        onExit={handleExit}
        onHowToPlay={handleHowToPlay}
      />

      {mode === 'normal' ? (
        <ResultScreen visible={game.phase === 'RESULT'} title={resultTitle} stats={resultStats} onReplay={game.restart} onExit={handleExit} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  turnBanner: {
    position: 'absolute',
    top: '12%',
    alignSelf: 'center',
    backgroundColor: 'rgba(20,14,8,0.55)',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 999,
  },
  turnText: { ...typography.bodyBold, color: colors.textOnDark },
  landingBanner: {
    position: 'absolute',
    top: '20%',
    alignSelf: 'center',
    backgroundColor: 'rgba(232,185,61,0.9)',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 999,
  },
  landingText: { ...typography.bodyBold, color: '#2B2019' },
});
