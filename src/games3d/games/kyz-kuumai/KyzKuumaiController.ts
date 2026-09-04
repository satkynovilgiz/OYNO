import { useCallback, useEffect, useRef, useState } from 'react';

import { DEFAULT_HORSE_CONFIG, HorseController } from '../../shared/horse/HorseController';
import { distanceBetween, FINISH_POSITION, START_POSITION } from './KyzKuumaiTrack';
import {
  CATCH_RADIUS_M,
  KYZ_KUUMAI_DIFFICULTY,
  MAX_ROUND_SECONDS,
  type KyzKuumaiDifficulty,
  type KyzKuumaiPhase,
  type KyzKuumaiResultSummary,
} from './KyzKuumaiTypes';

// "The girl rides first, given a head start" (RULES.md) - the AI/lead
// rider starts this far ahead of the player along the course.
const AI_HEAD_START_M = 8;

export function useKyzKuumaiGame(difficulty: KyzKuumaiDifficulty = 'normal') {
  const [phase, setPhase] = useState<KyzKuumaiPhase>('LOADING');
  const [summary, setSummary] = useState<KyzKuumaiResultSummary>({
    caught: false,
    elapsedSeconds: 0,
    topSpeed: 0,
    closestDistance: Infinity,
  });
  const [liveDistance, setLiveDistance] = useState(0);
  const [liveElapsedSeconds, setLiveElapsedSeconds] = useState(0);

  const prevPhaseRef = useRef<KyzKuumaiPhase>('PLAYING');
  const elapsedRef = useRef(0);
  const topSpeedRef = useRef(0);
  const closestDistanceRef = useRef(Infinity);
  const hudThrottleRef = useRef(0);

  const aiConfig = KYZ_KUUMAI_DIFFICULTY[difficulty];
  const playerHorseRef = useRef(
    new HorseController(DEFAULT_HORSE_CONFIG, START_POSITION.x, START_POSITION.z, 0),
  );
  const aiHorseRef = useRef(
    new HorseController(
      { ...DEFAULT_HORSE_CONFIG, maxSpeed: DEFAULT_HORSE_CONFIG.maxSpeed * aiConfig.aiSpeedRatio, maxSprintSpeed: DEFAULT_HORSE_CONFIG.maxSprintSpeed * aiConfig.aiSpeedRatio },
      START_POSITION.x,
      START_POSITION.z - AI_HEAD_START_M,
      0,
    ),
  );

  useEffect(() => {
    if (phase === 'LOADING') setPhase('INTRO');
  }, [phase]);

  const finishIntro = useCallback(() => setPhase('TUTORIAL'), []);
  const finishTutorial = useCallback(() => setPhase('READY'), []);
  const startChase = useCallback(() => setPhase('PLAYING'), []);

  /** Called every frame from KyzKuumaiScene's useFrame while phase is
   * PLAYING - checks catch/finish conditions and tracks result stats.
   * Deliberately NOT React state for the per-frame numbers (Section 87) -
   * only `liveDistance` is throttled into state, for the HUD, at a capped
   * rate rather than every frame. */
  const onTick = useCallback((dt: number) => {
    elapsedRef.current += dt;
    const player = playerHorseRef.current;
    const ai = aiHorseRef.current;

    topSpeedRef.current = Math.max(topSpeedRef.current, player.speed);
    const distance = distanceBetween({ x: player.x, z: player.z }, { x: ai.x, z: ai.z });
    closestDistanceRef.current = Math.min(closestDistanceRef.current, distance);

    hudThrottleRef.current += dt;
    if (hudThrottleRef.current > 0.1) {
      hudThrottleRef.current = 0;
      setLiveDistance(distance);
      setLiveElapsedSeconds(elapsedRef.current);
    }

    if (distance <= CATCH_RADIUS_M) {
      setSummary({ caught: true, elapsedSeconds: elapsedRef.current, topSpeed: topSpeedRef.current, closestDistance: closestDistanceRef.current });
      setPhase('RESULT');
      return;
    }

    const aiReachedFinish = distanceBetween({ x: ai.x, z: ai.z }, FINISH_POSITION) < 1.5;
    const timedOut = elapsedRef.current > MAX_ROUND_SECONDS;
    if (aiReachedFinish || timedOut) {
      setSummary({ caught: false, elapsedSeconds: elapsedRef.current, topSpeed: topSpeedRef.current, closestDistance: closestDistanceRef.current });
      setPhase('RESULT');
    }
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
    playerHorseRef.current = new HorseController(DEFAULT_HORSE_CONFIG, START_POSITION.x, START_POSITION.z, 0);
    aiHorseRef.current = new HorseController(
      { ...DEFAULT_HORSE_CONFIG, maxSpeed: DEFAULT_HORSE_CONFIG.maxSpeed * aiConfig.aiSpeedRatio, maxSprintSpeed: DEFAULT_HORSE_CONFIG.maxSprintSpeed * aiConfig.aiSpeedRatio },
      START_POSITION.x,
      START_POSITION.z - AI_HEAD_START_M,
      0,
    );
    elapsedRef.current = 0;
    topSpeedRef.current = 0;
    closestDistanceRef.current = Infinity;
    setLiveDistance(0);
    setLiveElapsedSeconds(0);
    setSummary({ caught: false, elapsedSeconds: 0, topSpeed: 0, closestDistance: Infinity });
    setPhase('READY');
  }, [aiConfig]);

  return {
    phase,
    playerHorseRef,
    aiHorseRef,
    liveDistance,
    liveElapsedSeconds,
    summary,
    finishIntro,
    finishTutorial,
    startChase,
    onTick,
    pause,
    resume,
    restart,
  };
}
