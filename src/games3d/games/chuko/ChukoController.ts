import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { computeThrowAim } from '../../ai/computeThrowAim';
import { ChukoPhysicsWorld } from './ChukoPhysicsWorld';
import { evaluateChukoCaptures, type ChukoCaptureOutcome } from './ChukoRulesEngine';
import { CHUKO_DIFFICULTY, MAX_TURNS_PER_SIDE, type ChukoDifficulty, type ChukoPhase, type ChukoResultSummary, type ChukoSide } from './ChukoTypes';

const AI_THINK_DELAY_MS = 800;

export function useChukoGame(difficulty: ChukoDifficulty = 'normal') {
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
    if (phase !== 'AI_TURN') return;
    const timer = setTimeout(() => {
      const { angleOffset, power } = computeThrowAim(CHUKO_DIFFICULTY[difficulty]);
      worldRef.current.launchStriker(angleOffset, power);
      pendingSideRef.current = 'ai';
      setPhase('SETTLING');
    }, AI_THINK_DELAY_MS);
    return () => clearTimeout(timer);
  }, [phase, difficulty]);

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
      setPhase('RESULT');
      return;
    }

    if (side === 'ai') {
      roundsRef.current += 1;
      if (roundsRef.current >= MAX_TURNS_PER_SIDE) {
        setPhase('RESULT');
        return;
      }
    }

    setPhase(side === 'player' ? 'AI_TURN' : 'PLAYER_TURN');
  }, []);

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
    worldRef.current.reset();
    pendingSideRef.current = null;
    roundsRef.current = 0;
    setScore({ player: 0, ai: 0 });
    setLastOutcome(null);
    setPhase('PLAYER_TURN');
  }, []);

  const summary: ChukoResultSummary = useMemo(() => {
    const winner: ChukoSide | 'draw' = score.player === score.ai ? 'draw' : score.player > score.ai ? 'player' : 'ai';
    return { playerScore: score.player, aiScore: score.ai, winner };
  }, [score]);

  return { phase, world: worldRef.current, score, lastOutcome, summary, finishIntro, finishTutorial, throwPlayer, onSettled, pause, resume, restart };
}
