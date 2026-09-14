import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { computeThrowAim } from '../../ai/computeThrowAim';
import { ChukoPhysicsWorld } from './ChukoPhysicsWorld';
import { evaluateChukoCaptures, type ChukoCaptureOutcome } from './ChukoRulesEngine';
import { CHUKO_DIFFICULTY, MAX_TURNS_PER_SIDE, type ChukoDifficulty, type ChukoMode, type ChukoPhase, type ChukoResultSummary, type ChukoSide } from './ChukoTypes';

const AI_THINK_DELAY_MS = 800;

export function useChukoGame(difficulty: ChukoDifficulty = 'normal', mode: ChukoMode = 'normal') {
  const [phase, setPhase] = useState<ChukoPhase>('LOADING');
  const [score, setScore] = useState({ player: 0, ai: 0 });
  const [lastOutcome, setLastOutcome] = useState<{ key: number; outcome: ChukoCaptureOutcome; side: ChukoSide } | null>(null);

  const worldRef = useRef(new ChukoPhysicsWorld());
  const pendingSideRef = useRef<ChukoSide | null>(null);
  const roundsRef = useRef(0);
  const prevPhaseRef = useRef<ChukoPhase>('PLAYER_TURN');
  const outcomeKeyRef = useRef(0);

  useEffect(() => {
    if (phase === 'LOADING') setPhase('INTRO');
  }, [phase]);

  const finishIntro = useCallback(() => setPhase('TUTORIAL'), []);
  const finishTutorial = useCallback(() => setPhase('PLAYER_TURN'), []);

  /** Shared by `restart` and practice's own auto-reset-when-empty / manual
   * `resetPieces` - see OrdoController.ts's identical `resetBoard`. */
  const resetBoard = useCallback(() => {
    worldRef.current.reset();
    pendingSideRef.current = null;
    roundsRef.current = 0;
    setScore({ player: 0, ai: 0 });
    setLastOutcome(null);
  }, []);

  const resetPieces = useCallback(() => {
    resetBoard();
    setPhase('PLAYER_TURN');
  }, [resetBoard]);

  const throwPlayer = useCallback(
    (angleOffset: number, power: number) => {
      if (phase !== 'PLAYER_TURN') return;
      worldRef.current.launchStriker(angleOffset, power);
      pendingSideRef.current = 'player';
      setPhase('SETTLING');
    },
    [phase],
  );

  useEffect(() => {
    if (phase !== 'AI_TURN' || mode === 'practice') return;
    const timer = setTimeout(() => {
      const { angleOffset, power } = computeThrowAim(CHUKO_DIFFICULTY[difficulty]);
      worldRef.current.launchStriker(angleOffset, power);
      pendingSideRef.current = 'ai';
      setPhase('SETTLING');
    }, AI_THINK_DELAY_MS);
    return () => clearTimeout(timer);
  }, [phase, difficulty, mode]);

  const onSettled = useCallback(() => {
    const side = pendingSideRef.current;
    if (!side) return;
    const world = worldRef.current;

    const outOfBounds = world.collectNewlyOutOfBounds();
    const outcome = evaluateChukoCaptures(outOfBounds, side);
    for (const piece of outcome.captured) world.removePiece(piece.id);
    world.clearStriker();

    setScore((prev) => ({ ...prev, [side]: prev[side] + outcome.scoreDelta }));
    outcomeKeyRef.current += 1;
    setLastOutcome({ key: outcomeKeyRef.current, outcome, side });
    pendingSideRef.current = null;

    if (world.pieces.length === 0) {
      if (mode === 'practice') {
        // No win/loss in practice - an emptied circle just means it's
        // time for a fresh one, not a result screen.
        resetBoard();
        setPhase('PLAYER_TURN');
        return;
      }
      setPhase('RESULT');
      return;
    }

    if (mode !== 'practice' && side === 'ai') {
      roundsRef.current += 1;
      if (roundsRef.current >= MAX_TURNS_PER_SIDE) {
        setPhase('RESULT');
        return;
      }
    }

    setPhase(mode === 'practice' ? 'PLAYER_TURN' : side === 'player' ? 'AI_TURN' : 'PLAYER_TURN');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, resetBoard]);

  const pause = useCallback(() => {
    setPhase((current) => {
      if (current === 'PAUSED' || current === 'RESULT') return current;
      prevPhaseRef.current = current;
      return 'PAUSED';
    });
  }, []);

  const resume = useCallback(() => {
    setPhase((current) => (current === 'PAUSED' ? prevPhaseRef.current : current));
  }, []);

  const restart = useCallback(() => {
    resetBoard();
    setPhase('PLAYER_TURN');
  }, [resetBoard]);

  const summary: ChukoResultSummary = useMemo(() => {
    const winner: ChukoSide | 'draw' = score.player === score.ai ? 'draw' : score.player > score.ai ? 'player' : 'ai';
    return { playerScore: score.player, aiScore: score.ai, winner };
  }, [score]);

  return { phase, mode, world: worldRef.current, score, lastOutcome, summary, finishIntro, finishTutorial, throwPlayer, onSettled, pause, resume, restart, resetPieces };
}
