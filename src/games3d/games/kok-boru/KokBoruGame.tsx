import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTrackScreenView } from '@/services/analytics/useTrackScreenView';
import { spacing } from '@/theme';

import { ContextActionButton } from '../../ui/ContextActionButton';
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
import { useKokBoruGame } from './KokBoruController';
import { KokBoruScene } from './KokBoruScene';

const TUTORIAL_STEPS = ['games3d.kokBoru.tutorial1', 'games3d.kokBoru.tutorial2', 'games3d.kokBoru.tutorial3'];

export function KokBoruGame() {
  useTrackScreenView('games3d_kok_boru');
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { isBackgrounded } = useGameLifecycle('landscape');
  const game = useKokBoruGame();
  const joystick = useVirtualJoystick();
  const sprint = useSprintButton();

  useEffect(() => {
    if (isBackgrounded) game.pause();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isBackgrounded]);

  useEffect(() => {
    if (game.phase !== 'RESULT') return;
    void Haptics.notificationAsync(game.summary.scored ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning);
  }, [game.phase, game.summary.scored]);

  useEffect(() => {
    if (game.possession === 'PLAYER') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, [game.possession]);

  const handleExit = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/games');
  }, []);

  const playing = game.phase === 'PLAYING';
  const hudVisible = playing || game.phase === 'PAUSED';

  const actionLabel = game.possession === 'PLAYER' ? t('games3d.kokBoru.throw') : t('games3d.kokBoru.pickUp');
  const actionEnabled = game.possession === 'PLAYER' || game.canPickUp;
  const handleAction = game.possession === 'PLAYER' ? game.drop : game.pickUp;

  const resultStats = useMemo(
    () => [
      { label: t('games3d.kyzKuumai.time'), value: `${game.summary.elapsedSeconds.toFixed(1)}s` },
      { label: t('games3d.kyzKuumai.topSpeed'), value: `${game.summary.topSpeed.toFixed(1)} m/s` },
    ],
    [game.summary, t],
  );

  const resultTitle = game.summary.scored ? t('games3d.kokBoru.scoredTitle') : t('games3d.kokBoru.notScoredTitle');

  return (
    <View style={styles.root}>
      <Game3DErrorBoundary fallback={(retry) => <ErrorOverlay onRetry={retry} onExit={handleExit} />}>
        <Game3DCanvas isPaused={game.phase === 'PAUSED'}>
          <KokBoruScene
            phase={game.phase}
            possession={game.possession}
            playerHorseRef={game.playerHorseRef}
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
          primaryStat={{ label: t('games3d.kokBoru.possession'), value: game.possession === 'PLAYER' ? t('games3d.kokBoru.you') : t('games3d.kokBoru.free') }}
          secondaryStat={{ label: t('games3d.kyzKuumai.time'), value: `${game.liveElapsedSeconds.toFixed(0)}s` }}
        />
      ) : null}

      {playing ? (
        <View pointerEvents="box-none" style={[styles.controlsRow, { paddingBottom: insets.bottom + spacing.lg }]}>
          <View pointerEvents="box-none" style={styles.controlSlot}>
            <VirtualJoystickView gesture={joystick.gesture} knobX={joystick.knobX} knobY={joystick.knobY} />
          </View>
          <View pointerEvents="box-none" style={[styles.controlSlot, styles.rightControls]}>
            <ContextActionButton label={actionLabel} enabled={actionEnabled} onPress={handleAction} />
            <SprintButtonView sprintHeld={sprint.sprintHeld} />
          </View>
        </View>
      ) : null}

      <GameIntroCard visible={game.phase === 'INTRO'} title={t('games3d.titles.kokBoru')} onDone={game.finishIntro} />
      <TutorialOverlay visible={game.phase === 'TUTORIAL'} stepKeys={TUTORIAL_STEPS} onDone={game.finishTutorial} />
      <StartCountdown visible={game.phase === 'READY'} onDone={game.start} />
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
  rightControls: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'center',
  },
});
