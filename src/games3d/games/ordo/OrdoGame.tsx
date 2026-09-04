import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { GestureDetector } from 'react-native-gesture-handler';
import { StyleSheet, Text, View } from 'react-native';

import { useTrackScreenView } from '@/services/analytics/useTrackScreenView';
import { colors, typography } from '@/theme';

import { useDragPowerController } from '../../controls/DragPowerController';
import { Game3DCanvas } from '../../core/Game3DCanvas';
import { Game3DErrorBoundary } from '../../core/Game3DErrorBoundary';
import { useGameLifecycle } from '../../core/useGameLifecycle';
import { ErrorOverlay } from '../../ui/ErrorOverlay';
import { GameHUD } from '../../ui/GameHUD';
import { GameIntroCard } from '../../ui/GameIntroCard';
import { PauseMenu } from '../../ui/PauseMenu';
import { ResultScreen } from '../../ui/ResultScreen';
import { TutorialOverlay } from '../../ui/TutorialOverlay';
import { useOrdoGame } from './OrdoController';
import { OrdoScene } from './OrdoScene';

const TUTORIAL_STEPS = ['games3d.ordo.tutorial1', 'games3d.ordo.tutorial2', 'games3d.ordo.tutorial3'];

function hapticFor(scoreDelta: number, khan: boolean) {
  if (khan) return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  if (scoreDelta > 0) return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}

export function OrdoGame() {
  useTrackScreenView('games3d_ordo');
  const { t } = useTranslation();
  const { isBackgrounded } = useGameLifecycle('landscape');
  const game = useOrdoGame('normal');
  const lastOutcomeKeyRef = useRef(0);

  useEffect(() => {
    if (isBackgrounded) game.pause();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isBackgrounded]);

  // Haptic feedback the moment a throw resolves, for either side - it's
  // useful signal regardless of who threw (Section "ORDO — CAMERA FEEDBACK"
  // style feedback, extended to touch).
  useEffect(() => {
    if (!game.lastOutcome || game.lastOutcome.key === lastOutcomeKeyRef.current) return;
    lastOutcomeKeyRef.current = game.lastOutcome.key;
    const { outcome, side } = game.lastOutcome;
    void hapticFor(outcome.scoreDelta[side], outcome.khanCapturedBy !== null);
  }, [game.lastOutcome]);

  const handleRelease = useCallback(
    (payload: { angleOffset: number; power: number }) => {
      game.throwPlayer(payload.angleOffset, payload.power);
    },
    [game],
  );

  const drag = useDragPowerController({ enabled: game.phase === 'PLAYER_TURN', onRelease: handleRelease });

  const handleExit = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/games');
  }, []);

  const hudVisible = game.phase === 'PLAYER_TURN' || game.phase === 'SETTLING' || game.phase === 'AI_TURN' || game.phase === 'PAUSED';
  const turnLabel =
    game.phase === 'AI_TURN' ? t('games3d.ordo.aiTurn') : game.phase === 'PLAYER_TURN' ? t('games3d.ordo.yourTurn') : null;

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
          primaryStat={{ label: t('games3d.ordo.you'), value: String(game.score.player) }}
          secondaryStat={{ label: t('games3d.ordo.ai'), value: String(game.score.ai) }}
        />
      ) : null}

      {turnLabel ? (
        <View style={styles.turnBanner} pointerEvents="none">
          <Text style={styles.turnText}>{turnLabel}</Text>
        </View>
      ) : null}

      <GameIntroCard visible={game.phase === 'INTRO'} title={t('games3d.titles.ordo')} onDone={game.finishIntro} />

      <TutorialOverlay visible={game.phase === 'TUTORIAL'} stepKeys={TUTORIAL_STEPS} onDone={game.finishTutorial} />

      <PauseMenu visible={game.phase === 'PAUSED'} onResume={game.resume} onRestart={game.restart} onExit={handleExit} />

      <ResultScreen visible={game.phase === 'RESULT'} title={resultTitle} stats={resultStats} onReplay={game.restart} onExit={handleExit} />
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
