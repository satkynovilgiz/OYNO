import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { computeAiThrow } from './OrdoAI';
import { OrdoPhysicsWorld } from './OrdoPhysicsWorld';
import { evaluateCaptures, type CaptureOutcome } from './OrdoRulesEngine';
import {
  MAX_TURNS_PER_SIDE,
  ORDO_DIFFICULTY,
  type OrdoDifficulty,
  type OrdoPhase,
  type OrdoResultSummary,
  type OrdoSide,
} from './OrdoTypes';

const AI_THINK_DELAY_MS = 900;

export function useOrdoGame(difficulty: OrdoDifficulty = 'normal') {
  const [phase, setPhase] = useState<OrdoPhase>('LOADING');
  const [score, setScore] = useState({ player: 0, ai: 0 });
  const [captures, setCaptures] = useState({ player: 0, ai: 0 });
  const [khanCapturedBy, setKhanCapturedBy] = useState<OrdoSide | null>(null);
  const [lastOutcome, setLastOutcome] = useState<{ key: number; outcome: CaptureOutcome; side: OrdoSide } | null>(null);

  const worldRef = useRef(new OrdoPhysicsWorld());
  const pendingSideRef = useRef<OrdoSide | null>(null);
  const roundsRef = useRef(0);
  const prevPhaseRef = useRef<OrdoPhase>('PLAYER_TURN');
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

  // AI throws itself, on a short delay for pacing, the moment it's its turn.
  useEffect(() => {
    if (phase !== 'AI_TURN') return;
    const timer = setTimeout(() => {
      const { angleOffset, power } = computeAiThrow(ORDO_DIFFICULTY[difficulty]);
      worldRef.current.launchStriker(angleOffset, power);
      pendingSideRef.current = 'ai';
      setPhase('SETTLING');
    }, AI_THINK_DELAY_MS);
    return () => clearTimeout(timer);
  }, [phase, difficulty]);

  /** Called by OrdoScene's useFrame once world.isSettled() is true. */
  const onSettled = useCallback(() => {
    const side = pendingSideRef.current;
    if (!side) return;
    const world = worldRef.current;

    const outOfBounds = world.collectNewlyOutOfBounds();
    const outcome = evaluateCaptures(outOfBounds, side, captures);

    for (const captured of outcome.legalCaptures) world.removePiece(captured.id);
    if (outcome.rejectedKhanId) world.returnPieceToField(outcome.rejectedKhanId);
    world.clearStriker();

    setScore((prev) => ({ player: prev.player + outcome.scoreDelta.player, ai: prev.ai + outcome.scoreDelta.ai }));
    setCaptures((prev) => ({
      ...prev,
      [side]: prev[side] + outcome.legalCaptures.filter((p) => p.kind === 'regular').length,
    }));

    outcomeKeyRef.current += 1;
    setLastOutcome({ key: outcomeKeyRef.current, outcome, side });
    pendingSideRef.current = null;

    if (outcome.khanCapturedBy) {
      setKhanCapturedBy(outcome.khanCapturedBy);
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
  }, [captures]);

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
    setCaptures({ player: 0, ai: 0 });
    setKhanCapturedBy(null);
    setLastOutcome(null);
    setPhase('PLAYER_TURN');
  }, []);

  const summary: OrdoResultSummary = useMemo(() => {
    const winner: OrdoSide | 'draw' =
      score.player === score.ai ? 'draw' : score.player > score.ai ? 'player' : 'ai';
    return {
      playerScore: score.player,
      aiScore: score.ai,
      playerCaptures: captures.player,
      aiCaptures: captures.ai,
      winner,
      khanCapturedBy,
    };
  }, [score, captures, khanCapturedBy]);

  return {
    phase,
    world: worldRef.current,
    score,
    lastOutcome,
    summary,
    finishIntro,
    finishTutorial,
    throwPlayer,
    onSettled,
    pause,
    resume,
    restart,
  };
}
