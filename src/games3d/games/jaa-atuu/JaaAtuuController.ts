import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { ArrowShot, JaaAtuuDifficulty, JaaAtuuPhase } from './JaaAtuuTypes';
import { TOTAL_ARROWS } from './JaaAtuuTypes';

export type PendingShot = { aimX: number; aimY: number; power: number };

/** Game-state machine for Jaa Atuu (Section 24/28), built on the shared
 * `GamePhase` set instead of ad hoc booleans. Deliberately does NOT hold
 * per-frame arrow position - that lives in JaaAtuuScene's useFrame loop via
 * refs, so a flying arrow never triggers a React re-render (Section 87).
 * This hook only decides *when* a shot starts and records its outcome once
 * the scene resolves it. */
export function useJaaAtuuGame(difficulty: JaaAtuuDifficulty = 'normal') {
  const [phase, setPhase] = useState<JaaAtuuPhase>('LOADING');
  const [shots, setShots] = useState<ArrowShot[]>([]);
  const [pendingShot, setPendingShot] = useState<PendingShot | null>(null);
  // What to return to on resume() - pause can interrupt INTRO/TUTORIAL/READY/PLAYING.
  const prevPhaseRef = useRef<JaaAtuuPhase>('READY');

  // Nothing async to load for this prototype yet (no GLTF models) - this
  // still goes through a real LOADING phase rather than skipping it, so a
  // future asset-loading step slots in here without changing the phase
  // shape or any call site.
  useEffect(() => {
    if (phase === 'LOADING') setPhase('INTRO');
  }, [phase]);

  const arrowsRemaining = TOTAL_ARROWS - shots.length;

  const finishIntro = useCallback(() => setPhase('TUTORIAL'), []);
  const finishTutorial = useCallback(() => setPhase('READY'), []);

  const fireArrow = useCallback(
    (shot: PendingShot) => {
      if (phase !== 'READY' || arrowsRemaining <= 0) return;
      setPendingShot(shot);
      setPhase('PLAYING');
    },
    [phase, arrowsRemaining],
  );

  const resolveShot = useCallback((shot: ArrowShot) => {
    setPendingShot(null);
    setShots((prev) => {
      const next = [...prev, shot];
      setPhase(next.length >= TOTAL_ARROWS ? 'RESULT' : 'READY');
      return next;
    });
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
    setShots([]);
    setPendingShot(null);
    // Replay skips INTRO/TUTORIAL - only the first play of a session shows
    // them (Section "Allow skipping repeated intros").
    setPhase('READY');
  }, []);

  const summary = useMemo(() => {
    const totalScore = shots.reduce((sum, shot) => sum + shot.score, 0);
    const hits = shots.filter((shot) => shot.ring !== null).length;
    const bullseyes = shots.filter((shot) => shot.ring === 'center').length;
    const bestShot = shots.reduce((best, shot) => Math.max(best, shot.score), 0);
    const accuracyPercent = shots.length > 0 ? Math.round((hits / shots.length) * 100) : 0;
    return { totalScore, bestShot, accuracyPercent, hits, bullseyes };
  }, [shots]);

  return {
    phase,
    difficulty,
    shots,
    pendingShot,
    arrowsRemaining,
    summary,
    finishIntro,
    finishTutorial,
    fireArrow,
    resolveShot,
    pause,
    resume,
    restart,
  };
}
