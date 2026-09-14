import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { GestureDetector } from 'react-native-gesture-handler';
import { StyleSheet, View } from 'react-native';

import { useTrackScreenView } from '@/services/analytics/useTrackScreenView';
import { useProgressStore } from '@/store/useProgressStore';

import { useAimController } from '../../controls/AimController';
import { Game3DCanvas } from '../../core/Game3DCanvas';
import { Game3DErrorBoundary } from '../../core/Game3DErrorBoundary';
import { useGameLifecycle } from '../../core/useGameLifecycle';
import { getBestScore, setBestScoreIfHigher } from '../../core/gameBestScore';
import { hasSeenTutorial, markTutorialSeen } from '../../core/tutorialStorage';
import { ErrorOverlay } from '../../ui/ErrorOverlay';
import { GameAboutCard } from '../../ui/GameAboutCard';
import { GameHUD } from '../../ui/GameHUD';
import { GameIntroCard } from '../../ui/GameIntroCard';
import { PauseMenu } from '../../ui/PauseMenu';
import { ResultScreen } from '../../ui/ResultScreen';
import { ShotFeedback, type ShotFeedbackEvent } from '../../ui/ShotFeedback';
import { TutorialOverlay } from '../../ui/TutorialOverlay';
import { useJaaAtuuGame } from './JaaAtuuController';
import { createJaaAtuuAudio } from './jaaAtuuAudio';
import { JaaAtuuScene } from './JaaAtuuScene';
import type { ArrowShot, JaaAtuuDifficulty, JaaAtuuMode } from './JaaAtuuTypes';
import { JAA_ATUU_DIFFICULTY } from './JaaAtuuTypes';

const TUTORIAL_STEPS = ['games3d.jaaAtuu.tutorial1', 'games3d.jaaAtuu.tutorial2', 'games3d.jaaAtuu.tutorial3'];
const GAME_ID = 'jaa_atuu';

function hapticForScore(score: number) {
  if (score >= 100) return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  if (score > 0) return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}

type JaaAtuuGameProps = {
  mode?: JaaAtuuMode;
  difficulty?: JaaAtuuDifficulty;
};

export function JaaAtuuGame({ mode = 'normal', difficulty = 'normal' }: JaaAtuuGameProps) {
  useTrackScreenView('games3d_jaa_atuu');
  const { t } = useTranslation();
  const { isBackgrounded } = useGameLifecycle('landscape');
  const game = useJaaAtuuGame(difficulty, mode);
  const config = JAA_ATUU_DIFFICULTY[game.difficulty];

  const [bestScore, setBestScore] = useState<number | null>(null);
  const [isNewBest, setIsNewBest] = useState(false);
  const recordedResultRef = useRef(false);

  const audioRef = useRef(createJaaAtuuAudio());
  useEffect(() => () => audioRef.current.dispose(), []);

  const [shotFeedback, setShotFeedback] = useState<ShotFeedbackEvent | null>(null);
  const [bullseyeSignalMs, setBullseyeSignalMs] = useState<number | undefined>(undefined);
  const shotKeyRef = useRef(0);

  // First-time "what is this / how to play" flow (Section 18/20/21) -
  // decoupled from game.phase so the pause menu can re-open it later
  // (Section 58) without re-driving the phase machine.
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

  // Backgrounding always pauses (Section 17); resuming gameplay is always
  // an explicit tap on the pause menu, never automatic on foreground.
  useEffect(() => {
    if (isBackgrounded) game.pause();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isBackgrounded]);

  const handleDrawStart = useCallback(() => {
    audioRef.current.play('draw');
  }, []);

  const handleRelease = useCallback(
    (payload: { aimX: number; aimY: number; power: number }) => {
      game.fireArrow(payload);
      audioRef.current.play('release');
    },
    [game],
  );

  const aim = useAimController({
    enabled: game.phase === 'READY',
    onDrawStart: handleDrawStart,
    onRelease: handleRelease,
  });

  const handleResolveShot = useCallback(
    (shot: ArrowShot) => {
      game.resolveShot(shot);
      void hapticForScore(shot.score);

      if (shot.ring === 'center') {
        audioRef.current.play('impactHeavy');
        setBullseyeSignalMs(Date.now());
      } else if (shot.score >= 50) {
        audioRef.current.play('impactMedium');
      } else if (shot.score > 0) {
        audioRef.current.play('impactLight');
      } else {
        audioRef.current.play('miss');
      }

      shotKeyRef.current += 1;
      setShotFeedback({
        key: shotKeyRef.current,
        text: shot.ring === null ? t('games3d.jaaAtuu.miss') : `+${shot.score}`,
        tone: shot.ring === 'center' ? 'bullseye' : shot.ring === null ? 'miss' : 'hit',
      });
    },
    [game, t],
  );

  const handleExit = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/games');
  }, []);

  const handleRestart = useCallback(() => {
    setShotFeedback(null);
    setBullseyeSignalMs(undefined);
    recordedResultRef.current = false;
    setIsNewBest(false);
    game.restart();
  }, [game]);

  // Fires once per completed round (not per render/phase-check) - a round
  // played counts toward Games-hub stats regardless of mode, but personal
  // best is 'normal'-only: practice's arrow count differs, so its totals
  // aren't comparable to a normal round's score.
  useEffect(() => {
    if (game.phase !== 'RESULT' || recordedResultRef.current) return;
    recordedResultRef.current = true;

    void useProgressStore.getState().recordGamePlayed(GAME_ID);

    if (mode !== 'normal') return;
    const score = game.summary.totalScore;
    void (async () => {
      const previous = await getBestScore(GAME_ID);
      const becameNewBest = await setBestScoreIfHigher(GAME_ID, score);
      setBestScore(becameNewBest ? score : previous);
      setIsNewBest(becameNewBest);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.phase]);

  const hudVisible = game.phase === 'READY' || game.phase === 'PLAYING' || game.phase === 'PAUSED';

  const resultStats = useMemo(() => {
    const stats = [
      { label: t('games3d.result.score'), value: String(game.summary.totalScore) },
      { label: t('games3d.result.bestShot'), value: String(game.summary.bestShot) },
      { label: t('games3d.result.accuracy'), value: `${game.summary.accuracyPercent}%` },
      { label: t('games3d.result.bullseyes'), value: String(game.summary.bullseyes) },
    ];
    if (mode === 'normal' && bestScore !== null) {
      stats.push({ label: t('games3d.result.personalBest'), value: String(bestScore) });
    }
    return stats;
  }, [game.summary, mode, bestScore, t]);

  return (
    <View style={styles.root}>
      <Game3DErrorBoundary fallback={(retry) => <ErrorOverlay onRetry={retry} onExit={handleExit} />}>
        <GestureDetector gesture={aim.gesture}>
          <View style={StyleSheet.absoluteFill}>
            <Game3DCanvas isPaused={game.phase === 'PAUSED'}>
              <JaaAtuuScene
                phase={game.phase}
                config={config}
                pendingShot={game.pendingShot}
                onResolveShot={handleResolveShot}
                aimX={aim.aimX}
                aimY={aim.aimY}
                isDrawing={aim.isDrawing}
                drawStartedAtMs={aim.drawStartedAtMs}
                minDrawMs={aim.MIN_DRAW_MS}
                maxDrawMs={aim.MAX_DRAW_MS}
                bullseyeSignalMs={bullseyeSignalMs}
              />
            </Game3DCanvas>
          </View>
        </GestureDetector>
      </Game3DErrorBoundary>

      {hudVisible ? (
        <GameHUD
          title={t('games3d.titles.jaaAtuu')}
          onPause={game.pause}
          primaryStat={{ label: t('games3d.hud.score'), value: String(game.summary.totalScore) }}
          secondaryStat={{ label: t('games3d.hud.arrows'), value: `${game.arrowsRemaining}/${game.totalArrows}` }}
        />
      ) : null}

      {/* Not gated on phase: the 5th arrow's shot resolves in the same tick
          that phase flips to RESULT, so gating this on READY/PLAYING would
          silently drop the last popup. Its own timer fades it out. */}
      <ShotFeedback event={shotFeedback} />

      <GameIntroCard visible={game.phase === 'INTRO'} title={t('games3d.titles.jaaAtuu')} onDone={game.finishIntro} />

      <GameAboutCard
        visible={helpStage === 'about'}
        title={t('games3d.titles.jaaAtuu')}
        description={t('games3d.jaaAtuu.aboutDescription')}
        objective={t('games3d.jaaAtuu.aboutObjective')}
        onDone={handleAboutDone}
      />

      <TutorialOverlay visible={helpStage === 'controls'} stepKeys={TUTORIAL_STEPS} onDone={handleTutorialDone} />

      <PauseMenu
        visible={game.phase === 'PAUSED' && helpStage === null}
        onResume={game.resume}
        onRestart={handleRestart}
        onExit={handleExit}
        onHowToPlay={handleHowToPlay}
      />

      <ResultScreen
        visible={game.phase === 'RESULT'}
        title={t('games3d.result.title')}
        banner={isNewBest ? t('games3d.result.newBest') : undefined}
        stats={resultStats}
        onReplay={handleRestart}
        onExit={handleExit}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000',
  },
});
