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
import { gameHaptics } from '../../haptics/gameHaptics';
import { ErrorOverlay } from '../../ui/ErrorOverlay';
import { GameAboutCard } from '../../ui/GameAboutCard';
import { GameHUD } from '../../ui/GameHUD';
import { GameIntroCard } from '../../ui/GameIntroCard';
import { PauseMenu } from '../../ui/PauseMenu';
import { PracticeBar } from '../../ui/PracticeBar';
import { ResultScreen } from '../../ui/ResultScreen';
import { TutorialOverlay } from '../../ui/TutorialOverlay';
import { useOrdoGame } from './OrdoController';
import { createOrdoAudio } from './ordoAudio';
import { OrdoScene } from './OrdoScene';
import type { OrdoDifficulty, OrdoMode } from './OrdoTypes';

const TUTORIAL_STEPS = ['games3d.ordo.tutorial1', 'games3d.ordo.tutorial2', 'games3d.ordo.tutorial3'];
const GAME_ID = 'ordo';

function hapticFor(scoreDelta: number, khan: boolean) {
  if (khan) return gameHaptics.heavy();
  if (scoreDelta > 0) return gameHaptics.medium();
  return gameHaptics.light();
}

type OrdoGameProps = {
  difficulty?: OrdoDifficulty;
  mode?: OrdoMode;
};

export function OrdoGame({ difficulty = 'normal', mode = 'normal' }: OrdoGameProps) {
  useTrackScreenView('games3d_ordo');
  const { t } = useTranslation();
  const game = useOrdoGame(difficulty, mode);
  useGameLifecycle('landscape', game.pause);
  const lastOutcomeKeyRef = useRef(0);
  const recordedResultRef = useRef(false);
  const [hasThrown, setHasThrown] = useState(false);

  const audioRef = useRef(createOrdoAudio());
  useEffect(() => () => audioRef.current.dispose(), []);
  const prevTurnPhaseRef = useRef(game.phase);

  // First-time "what is this / how to play" flow (same pattern as
  // JaaAtuuGame.tsx) - independent of `mode` so Practice and Play both get
  // it on a player's very first visit, and neither repeats it afterward.
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

  // Fires once per completed match. Resets when leaving RESULT (e.g. after
  // restart) rather than needing every onRestart/onReplay call site to
  // reset it - PauseMenu/ResultScreen both call `game.restart` directly.
  useEffect(() => {
    if (game.phase !== 'RESULT') {
      recordedResultRef.current = false;
      return;
    }
    if (recordedResultRef.current) return;
    recordedResultRef.current = true;
    void useProgressStore.getState().recordGamePlayed(GAME_ID);
    void setBestScoreIfHigher(GAME_ID, game.summary.playerScore);

    // Win/loss/draw sound (Section "win/loss") - only for a real match;
    // practice never reaches RESULT (Section "no win-loss" for practice).
    if (mode === 'normal') {
      if (game.summary.winner === 'player') audioRef.current.play('win', 0.6);
      else if (game.summary.winner === 'ai') audioRef.current.play('loss', 0.55);
      else audioRef.current.play('draw', 0.5);
    }
  }, [game.phase, game.summary.playerScore, game.summary.winner, mode]);

  // Haptic + sound feedback the moment a throw resolves, for either side -
  // it's useful signal regardless of who threw (Section "ORDO — CAMERA
  // FEEDBACK" style feedback, extended to touch/audio). "Piece hit" plays
  // for every resolved throw; "successful clear" (a capture, or the khan)
  // layers a brighter confirmation on top rather than replacing the thud.
  useEffect(() => {
    if (!game.lastOutcome || game.lastOutcome.key === lastOutcomeKeyRef.current) return;
    lastOutcomeKeyRef.current = game.lastOutcome.key;
    const { outcome, side } = game.lastOutcome;
    const scoreDelta = outcome.scoreDelta[side];
    const khan = outcome.khanCapturedBy !== null;
    void hapticFor(scoreDelta, khan);
    audioRef.current.play('pieceHit', 0.55);
    if (scoreDelta > 0 || khan) audioRef.current.play('clear', 0.6);
  }, [game.lastOutcome]);

  // Turn-change cue (Section "turn change") - fires only on an actual
  // PLAYER_TURN<->AI_TURN transition, not on every phase change (SETTLING
  // sits between them every throw, so gating on just those two values
  // keeps this from firing twice per throw).
  useEffect(() => {
    const prev = prevTurnPhaseRef.current;
    prevTurnPhaseRef.current = game.phase;
    const isTurnPhase = (p: typeof game.phase) => p === 'PLAYER_TURN' || p === 'AI_TURN';
    if (isTurnPhase(game.phase) && isTurnPhase(prev) && game.phase !== prev) {
      audioRef.current.play('turnChange', 0.4);
    }
  }, [game.phase]);

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

  const resultStats = useMemo(() => {
    const s = game.summary;
    return [
      { label: t('games3d.ordo.you'), value: String(s.playerScore) },
      { label: t('games3d.ordo.ai'), value: String(s.aiScore) },
      { label: t('games3d.ordo.captures'), value: `${s.playerCaptures}/${s.aiCaptures}` },
    ];
  }, [game.summary, t]);

  const resultTitle =
    game.summary.winner === 'draw'
      ? t('games3d.result.draw')
      : game.summary.winner === 'player'
        ? t('games3d.result.win')
        : t('games3d.result.lose');

  return (
    <View style={styles.root}>
      <Game3DErrorBoundary fallback={(retry) => <ErrorOverlay onRetry={retry} onExit={handleExit} />}>
        <GestureDetector gesture={drag.gesture}>
          <View style={StyleSheet.absoluteFill}>
            <Game3DCanvas isPaused={game.phase === 'PAUSED'}>
              <OrdoScene
                phase={game.phase}
                world={game.world}
                onSettled={game.onSettled}
                pullX={drag.pullX}
                pullY={drag.pullY}
                isPulling={drag.isPulling}
              />
            </Game3DCanvas>
          </View>
        </GestureDetector>
      </Game3DErrorBoundary>

      {hudVisible ? (
        <GameHUD
          title={t('games3d.titles.ordo')}
          onPause={game.pause}
          primaryStat={
            mode === 'practice'
              ? { label: t('games3d.ordo.captures'), value: String(game.summary.playerCaptures) }
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

      <PracticeBar
        visible={mode === 'practice' && inGameplayPhase}
        onReset={handleResetPieces}
        onExit={handleExit}
        resetLabel={t('games3d.ordo.resetPieces')}
        exitLabel={t('games3d.practice.exit')}
      />

      <GameIntroCard visible={game.phase === 'INTRO'} title={t('games3d.titles.ordo')} onDone={game.finishIntro} />

      <GameAboutCard
        visible={helpStage === 'about'}
        title={t('games3d.titles.ordo')}
        description={t('games3d.ordo.aboutDescription')}
        objective={t('games3d.ordo.aboutObjective')}
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
  root: {
    flex: 1,
    backgroundColor: '#000',
  },
  turnBanner: {
    position: 'absolute',
    top: '12%',
    alignSelf: 'center',
    backgroundColor: 'rgba(20,14,8,0.55)',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 999,
  },
  turnText: {
    ...typography.bodyBold,
    color: colors.textOnDark,
  },
});
