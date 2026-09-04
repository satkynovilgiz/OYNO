import { useCallback, useEffect, useRef, useState } from 'react';

import { DEFAULT_HORSE_CONFIG, HorseController } from '../../shared/horse/HorseController';
import {
  GOAL_POSITION,
  GOAL_RADIUS_M,
  OBJECT_SPAWN,
  PICKUP_RADIUS_M,
  PLAYER_START,
  type KokBoruPhase,
  type KokBoruPossession,
  type KokBoruResultSummary,
} from './KokBoruTypes';

const MAX_ROUND_SECONDS = 90;

export function useKokBoruGame() {
  const [phase, setPhase] = useState<KokBoruPhase>('LOADING');
  const [possession, setPossession] = useState<KokBoruPossession>('FREE');
  const [summary, setSummary] = useState<KokBoruResultSummary>({ scored: false, elapsedSeconds: 0, topSpeed: 0 });
  const [canPickUp, setCanPickUp] = useState(false);

  const prevPhaseRef = useRef<KokBoruPhase>('PLAYING');
  const playerHorseRef = useRef(new HorseController(DEFAULT_HORSE_CONFIG, PLAYER_START.x, PLAYER_START.z, Math.PI));
  const objectPositionRef = useRef({ ...OBJECT_SPAWN });
  const possessionRef = useRef<KokBoruPossession>('FREE');
  const elapsedRef = useRef(0);
  const topSpeedRef = useRef(0);

  useEffect(() => {
    if (phase === 'LOADING') setPhase('INTRO');
  }, [phase]);

  const finishIntro = useCallback(() => setPhase('TUTORIAL'), []);
  const finishTutorial = useCallback(() => setPhase('READY'), []);
  const start = useCallback(() => setPhase('PLAYING'), []);

  const pickUp = useCallback(() => {
    if (possessionRef.current !== 'FREE' || !canPickUp) return;
    possessionRef.current = 'PLAYER';
    setPossession('PLAYER');
  }, [canPickUp]);

  const drop = useCallback(() => {
    if (possessionRef.current !== 'PLAYER') return;
    const player = playerHorseRef.current;
    objectPositionRef.current = { x: player.x, z: player.z };
    possessionRef.current = 'FREE';
    setPossession('FREE');
  }, []);

  /** Called every frame from KokBoruScene's useFrame while phase is
   * PLAYING (Section 86/87 - per-frame numbers stay in refs; only
   * `canPickUp` crosses into React state, and only on actual transitions). */
  const onTick = useCallback((dt: number) => {
    elapsedRef.current += dt;
    const player = playerHorseRef.current;
    topSpeedRef.current = Math.max(topSpeedRef.current, player.speed);

    if (possessionRef.current === 'PLAYER') {
      objectPositionRef.current = { x: player.x, z: player.z };

      const dx = player.x - GOAL_POSITION.x;
      const dz = player.z - GOAL_POSITION.z;
      if (Math.hypot(dx, dz) < GOAL_RADIUS_M) {
        setSummary({ scored: true, elapsedSeconds: elapsedRef.current, topSpeed: topSpeedRef.current });
        setPhase('RESULT');
        return;
      }
      if (canPickUp) setCanPickUp(false);
    } else {
      const dx = player.x - objectPositionRef.current.x;
      const dz = player.z - objectPositionRef.current.z;
      const near = Math.hypot(dx, dz) < PICKUP_RADIUS_M;
      if (near !== canPickUp) setCanPickUp(near);
    }

    if (elapsedRef.current > MAX_ROUND_SECONDS) {
      setSummary({ scored: false, elapsedSeconds: elapsedRef.current, topSpeed: topSpeedRef.current });
      setPhase('RESULT');
    }
  }, [canPickUp]);

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
    playerHorseRef.current = new HorseController(DEFAULT_HORSE_CONFIG, PLAYER_START.x, PLAYER_START.z, Math.PI);
    objectPositionRef.current = { ...OBJECT_SPAWN };
    possessionRef.current = 'FREE';
    elapsedRef.current = 0;
    topSpeedRef.current = 0;
    setPossession('FREE');
    setCanPickUp(false);
    setSummary({ scored: false, elapsedSeconds: 0, topSpeed: 0 });
    setPhase('READY');
  }, []);

  return {
    phase,
    possession,
    canPickUp,
    playerHorseRef,
    objectPositionRef,
    summary,
    finishIntro,
    finishTutorial,
    start,
    pickUp,
    drop,
    onTick,
    pause,
    resume,
    restart,
  };
}
