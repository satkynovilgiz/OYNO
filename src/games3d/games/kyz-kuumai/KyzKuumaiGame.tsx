import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { GestureDetector } from 'react-native-gesture-handler';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTrackScreenView } from '@/services/analytics/useTrackScreenView';
import { spacing } from '@/theme';

import { SprintButtonView, useSprintButton } from '../../controls/SprintButton';
import { useVirtualJoystick, VirtualJoystickView } from '../../controls/VirtualJoystick';
import { Game3DCanvas } from '../../core/Game3DCanvas';
import { Game3DErrorBoundary } from '../../core/Game3DErrorBoundary';
import { useGameLifecycle } from '../../core/useGameLifecycle';
import { ErrorOverlay } from '../../ui/ErrorOverlay';
import { GameHUD } from '../../ui/GameHUD';
import { GameIntroCard } from '../../ui/GameIntroCard';
import { PauseMenu } from '../../ui/PauseMenu';
import { ResultScreen } from '../../ui/ResultScreen';
import { StartCountdown } from '../../ui/StartCountdown';
import { TutorialOverlay } from '../../ui/TutorialOverlay';
import { useKyzKuumaiGame } from './KyzKuumaiController';
import { KyzKuumaiScene } from './KyzKuumaiScene';

const TUTORIAL_STEPS = ['games3d.kyzKuumai.tutorial1', 'games3d.kyzKuumai.tutorial2', 'games3d.kyzKuumai.tutorial3'];

export function KyzKuumaiGame() {
  useTrackScreenView('games3d_kyz_kuumai');
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { isBackgrounded } = useGameLifecycle('landscape');
  const game = useKyzKuumaiGame('normal');
  const joystick = useVirtualJoystick();
  const sprint = useSprintButton();

  useEffect(() => {
    if (isBackgrounded) game.pause();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isBackgrounded]);

  useEffect(() => {
    if (game.phase !== 'RESULT') return;
    void Haptics.notificationAsync(game.summary.caught ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning);
  }, [game.phase, game.summary.caught]);

  const handleExit = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/games');
  }, []);

  const playing = game.phase === 'PLAYING';
  const hudVisible = playing || game.phase === 'PAUSED';

  const resultStats = useMemo(
    () => [
      { label: t('games3d.kyzKuumai.time'), value: `${game.summary.elapsedSeconds.toFixed(1)}s` },
      { label: t('games3d.kyzKuumai.topSpeed'), value: `${game.summary.topSpeed.toFixed(1)} m/s` },
      { label: t('games3d.kyzKuumai.closest'), value: `${game.summary.closestDistance.toFixed(1)}m` },
    ],
    [game.summary, t],
  );

  const resultTitle = game.summary.caught ? t('games3d.kyzKuumai.caughtTitle') : t('games3d.kyzKuumai.notCaughtTitle');

  return (
    <View style={styles.root}>
      <Game3DErrorBoundary fallback={(retry) => <ErrorOverlay onRetry={retry} onExit={handleExit} />}>
        <Game3DCanvas isPaused={game.phase === 'PAUSED'}>
          <KyzKuumaiScene
            phase={game.phase}
            playerHorseRef={game.playerHorseRef}
            aiHorseRef={game.aiHorseRef}
            moveX={joystick.moveX}
            moveZ={joystick.moveZ}
            sprintHeld={sprint.sprintHeld}
            onTick={game.onTick}
          />
        </Game3DCanvas>
      </Game3DErrorBoundary>

      {hudVisible ? (
        <GameHUD
          title={t('games3d.titles.kyzKuumai')}
          onPause={game.pause}
          primaryStat={{ label: t('games3d.kyzKuumai.distance'), value: `${game.liveDistance.toFixed(1)}m` }}
          secondaryStat={{ label: t('games3d.kyzKuumai.time'), value: `${game.summary.elapsedSeconds.toFixed(0)}s` }}
        />
      ) : null}

      {playing ? (
        <View pointerEvents="box-none" style={[styles.controlsRow, { paddingBottom: insets.bottom + spacing.lg }]}>
          <View pointerEvents="box-none" style={styles.controlSlot}>
            <VirtualJoystickView gesture={joystick.gesture} knobX={joystick.knobX} knobY={joystick.knobY} />
          </View>
          <View pointerEvents="box-none" style={styles.controlSlot}>
            <SprintButtonView sprintHeld={sprint.sprintHeld} />
          </View>
        </View>
      ) : null}

      <GameIntroCard visible={game.phase === 'INTRO'} title={t('games3d.titles.kyzKuumai')} onDone={game.finishIntro} />
      <TutorialOverlay visible={game.phase === 'TUTORIAL'} stepKeys={TUTORIAL_STEPS} onDone={game.finishTutorial} />
      <StartCountdown visible={game.phase === 'READY'} onDone={game.startChase} />
      <PauseMenu visible={game.phase === 'PAUSED'} onResume={game.resume} onRestart={game.restart} onExit={handleExit} />
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
});
