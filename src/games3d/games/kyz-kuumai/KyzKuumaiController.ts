import { useCallback, useEffect, useRef, useState } from 'react';

import { DEFAULT_HORSE_CONFIG, HorseController } from '../../shared/horse/HorseController';
import { distanceBetween, FINISH_POSITION, getTrackProgress, START_POSITION, TRACK_WAYPOINTS } from './KyzKuumaiTrack';
import {
  CATCH_RADIUS_M,
  KYZ_KUUMAI_DIFFICULTY,
  MAX_ROUND_SECONDS,
  type KyzKuumaiDifficulty,
  type KyzKuumaiMode,
  type KyzKuumaiPhase,
  type KyzKuumaiResultSummary,
} from './KyzKuumaiTypes';

// "The girl rides first, given a head start" (RULES.md) - the AI/lead
// rider starts this far ahead of the player along the course.
const AI_HEAD_START_M = 8;

// Practice reuses the same course as 3 training checkpoints (Section
// "KYZ KUUMAI PRACTICE": "3-5 checkpoints") instead of a separate track -
// TRACK_WAYPOINTS is [START, CP1, CP2, CP3, FINISH], so the 3 interior
// points are exactly that. Each checkpoint's arc-length is derived from
// the track itself (getTrackProgress of a point already on the track
// returns that point's own arc-length) rather than hand-measured, so it
// can never drift out of sync with the actual course.
const CHECKPOINT_ARC_LENGTHS = TRACK_WAYPOINTS.slice(1, -1).map(getTrackProgress);

export function useKyzKuumaiGame(difficulty: KyzKuumaiDifficulty = 'normal', mode: KyzKuumaiMode = 'normal') {
  const [phase, setPhase] = useState<KyzKuumaiPhase>('LOADING');
  const [summary, setSummary] = useState<KyzKuumaiResultSummary>({
    caught: false,
    elapsedSeconds: 0,
    topSpeed: 0,
    closestDistance: Infinity,
  });
  const [liveDistance, setLiveDistance] = useState(0);
  const [liveElapsedSeconds, setLiveElapsedSeconds] = useState(0);
  const [checkpointEvent, setCheckpointEvent] = useState<{ key: number; index: number } | null>(null);

  const prevPhaseRef = useRef<KyzKuumaiPhase>('PLAYING');
  const elapsedRef = useRef(0);
  const topSpeedRef = useRef(0);
  const closestDistanceRef = useRef(Infinity);
  const hudThrottleRef = useRef(0);
  const checkpointsReachedRef = useRef(0);

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

    topSpeedRef.current = Math.max(topSpeedRef.current, player.speed);

    if (mode === 'practice') {
      const playerPos = { x: player.x, z: player.z };
      const progress = getTrackProgress(playerPos);

      hudThrottleRef.current += dt;
      if (hudThrottleRef.current > 0.1) {
        hudThrottleRef.current = 0;
        setLiveElapsedSeconds(elapsedRef.current);
      }

      if (
        checkpointsReachedRef.current < CHECKPOINT_ARC_LENGTHS.length &&
        progress >= CHECKPOINT_ARC_LENGTHS[checkpointsReachedRef.current]
      ) {
        checkpointsReachedRef.current += 1;
        setCheckpointEvent({ key: checkpointsReachedRef.current, index: checkpointsReachedRef.current - 1 });
      }

      if (distanceBetween(playerPos, FINISH_POSITION) < 1.5) {
        setSummary({ caught: false, elapsedSeconds: elapsedRef.current, topSpeed: topSpeedRef.current, closestDistance: 0 });
        setPhase('RESULT');
      }
      return;
    }

    const ai = aiHorseRef.current;
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

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
    checkpointsReachedRef.current = 0;
    setLiveDistance(0);
    setLiveElapsedSeconds(0);
    setCheckpointEvent(null);
    setSummary({ caught: false, elapsedSeconds: 0, topSpeed: 0, closestDistance: Infinity });
    setPhase('READY');
  }, [aiConfig]);

  return {
    phase,
    mode,
    playerHorseRef,
    aiHorseRef,
    liveDistance,
    checkpointEvent,
    totalCheckpoints: CHECKPOINT_ARC_LENGTHS.length,
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
