import { useCallback, useEffect, useRef, useState } from 'react';

import { DEFAULT_HORSE_CONFIG, HorseController } from '../../shared/horse/HorseController';
import { checkGoal, resolveMatchOutcome, resolvePossession } from './KokBoruMatchEngine';
import {
  AI_GOAL,
  AI_START,
  GOAL_PAUSE_S,
  GOAL_RADIUS_M,
  MATCH_DURATION_S,
  OBJECT_SPAWN,
  PICKUP_RADIUS_M,
  PLAYER_GOAL,
  PLAYER_START,
  POSSESSION_COOLDOWN_S,
  STEAL_RADIUS_M,
  type KokBoruMode,
  type KokBoruPhase,
  type KokBoruPossession,
  type KokBoruResultSummary,
} from './KokBoruTypes';

const MAX_ROUND_SECONDS = 90;

/** The AI rider isn't a perfectly-matched opponent (Section "No teleporting
 * AI", same reasoning as Kyz Kuumai's aiSpeedRatio) - a modest speed
 * handicap keeps a 1v1 match winnable without giving the AI cheat physics. */
const AI_HORSE_CONFIG = { ...DEFAULT_HORSE_CONFIG, maxSpeed: DEFAULT_HORSE_CONFIG.maxSpeed * 0.88, maxSprintSpeed: DEFAULT_HORSE_CONFIG.maxSprintSpeed * 0.88 };

export function useKokBoruGame(mode: KokBoruMode = 'normal') {
  const [phase, setPhase] = useState<KokBoruPhase>('LOADING');
  const [possession, setPossession] = useState<KokBoruPossession>('FREE');
  const [score, setScore] = useState({ player: 0, ai: 0 });
  const [lastScorer, setLastScorer] = useState<'player' | 'ai' | null>(null);
  const [summary, setSummary] = useState<KokBoruResultSummary>({
    scored: false,
    elapsedSeconds: 0,
    topSpeed: 0,
    playerScore: 0,
    aiScore: 0,
    outcome: 'DRAW',
  });
  const [canPickUp, setCanPickUp] = useState(false);
  const [liveElapsedSeconds, setLiveElapsedSeconds] = useState(0);
  const [practiceScoreCount, setPracticeScoreCount] = useState(0);

  const prevPhaseRef = useRef<KokBoruPhase>('PLAYING');
  const playerHorseRef = useRef(new HorseController(DEFAULT_HORSE_CONFIG, PLAYER_START.x, PLAYER_START.z, Math.PI));
  const aiHorseRef = useRef(new HorseController(AI_HORSE_CONFIG, AI_START.x, AI_START.z, 0));
  const objectPositionRef = useRef({ ...OBJECT_SPAWN });
  const possessionRef = useRef<KokBoruPossession>('FREE');
  const scoreRef = useRef({ player: 0, ai: 0 });
  const cooldownRef = useRef(0);
  const elapsedRef = useRef(0);
  const topSpeedRef = useRef(0);
  const hudThrottleRef = useRef(0);

  useEffect(() => {
    if (phase === 'LOADING') setPhase('INTRO');
  }, [phase]);

  const finishIntro = useCallback(() => setPhase('TUTORIAL'), []);
  const finishTutorial = useCallback(() => setPhase('READY'), []);
  const start = useCallback(() => setPhase('PLAYING'), []);

  const finishMatch = useCallback(() => {
    const outcome = resolveMatchOutcome(scoreRef.current.player, scoreRef.current.ai);
    setSummary({
      scored: false,
      elapsedSeconds: elapsedRef.current,
      topSpeed: topSpeedRef.current,
      playerScore: scoreRef.current.player,
      aiScore: scoreRef.current.ai,
      outcome,
    });
    setPhase('RESULT');
  }, []);

  // Practice-only: the player's own explicit "PICK UP" press (Section 5 -
  // Phase A's manual action, kept as-is since practice stays separate from
  // the 1v1 match's fully-automatic proximity pickup/steal below).
  const pickUp = useCallback(() => {
    if (mode !== 'practice' || possessionRef.current !== 'FREE' || !canPickUp) return;
    possessionRef.current = 'PLAYER';
    setPossession('PLAYER');
  }, [mode, canPickUp]);

  const drop = useCallback(() => {
    if (mode !== 'practice' || possessionRef.current !== 'PLAYER') return;
    const player = playerHorseRef.current;
    objectPositionRef.current = { x: player.x, z: player.z };
    possessionRef.current = 'FREE';
    setPossession('FREE');
  }, [mode]);

  /** Practice-only: puts the object back at its spawn point without
   * ending the session (Section "KOK BORU PRACTICE": "reset object"). */
  const resetObject = useCallback(() => {
    objectPositionRef.current = { ...OBJECT_SPAWN };
    possessionRef.current = 'FREE';
    setPossession('FREE');
    setCanPickUp(false);
  }, []);

  /** After a goal in the 1v1 match: short pause, then both horses and the
   * object reset and the match continues (Section 10) - unless the match
   * clock had already run out during the pause, in which case it ends
   * instead of restarting play. */
  useEffect(() => {
    if (phase !== 'GOAL_PAUSE') return;
    const timer = setTimeout(() => {
      playerHorseRef.current = new HorseController(DEFAULT_HORSE_CONFIG, PLAYER_START.x, PLAYER_START.z, Math.PI);
      aiHorseRef.current = new HorseController(AI_HORSE_CONFIG, AI_START.x, AI_START.z, 0);
      objectPositionRef.current = { ...OBJECT_SPAWN };
      cooldownRef.current = 0;
      if (elapsedRef.current >= MATCH_DURATION_S) finishMatch();
      else setPhase('PLAYING');
    }, GOAL_PAUSE_S * 1000);
    return () => clearTimeout(timer);
  }, [phase, finishMatch]);

  /** Called every frame from KokBoruScene's useFrame while phase is
   * PLAYING (Section 86/87 - per-frame numbers stay in refs; only
   * `canPickUp`/`possession`/`score` cross into React state, and only on
   * actual transitions). The scene itself steps both horses' physics and
   * picks the AI's steering target (it already has `possession` as a
   * prop) - this only resolves game state (possession/goals/the clock). */
  const onTick = useCallback(
    (dt: number) => {
      elapsedRef.current += dt;
      const player = playerHorseRef.current;
      topSpeedRef.current = Math.max(topSpeedRef.current, player.speed);

      hudThrottleRef.current += dt;
      if (hudThrottleRef.current > 0.1) {
        hudThrottleRef.current = 0;
        setLiveElapsedSeconds(elapsedRef.current);
      }

      if (mode === 'practice') {
        if (possessionRef.current === 'PLAYER') {
          objectPositionRef.current = { x: player.x, z: player.z };

          const dx = player.x - PLAYER_GOAL.x;
          const dz = player.z - PLAYER_GOAL.z;
          if (Math.hypot(dx, dz) < GOAL_RADIUS_M) {
            // No win/loss in practice - scoring resets the object so the
            // player can immediately go again, instead of a result screen.
            setPracticeScoreCount((count) => count + 1);
            objectPositionRef.current = { ...OBJECT_SPAWN };
            possessionRef.current = 'FREE';
            setPossession('FREE');
            setCanPickUp(false);
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
          setSummary((prev) => ({ ...prev, scored: false, elapsedSeconds: elapsedRef.current, topSpeed: topSpeedRef.current }));
          setPhase('RESULT');
        }
        return;
      }

      // Normal mode: full 1v1 match.
      if (cooldownRef.current > 0) cooldownRef.current = Math.max(0, cooldownRef.current - dt);

      const ai = aiHorseRef.current;
      const playerPos = { x: player.x, z: player.z };
      const aiPos = { x: ai.x, z: ai.z };

      const nextPossession = resolvePossession({
        current: possessionRef.current,
        playerPos,
        aiPos,
        objectPos: objectPositionRef.current,
        cooldownActive: cooldownRef.current > 0,
        pickupRadius: PICKUP_RADIUS_M,
        stealRadius: STEAL_RADIUS_M,
      });

      if (nextPossession !== possessionRef.current) {
        possessionRef.current = nextPossession;
        setPossession(nextPossession);
        cooldownRef.current = POSSESSION_COOLDOWN_S;
      }

      const scoringSide = checkGoal({
        possession: possessionRef.current,
        playerPos,
        aiPos,
        playerGoal: PLAYER_GOAL,
        aiGoal: AI_GOAL,
        goalRadius: GOAL_RADIUS_M,
      });

      if (scoringSide) {
        const next = { ...scoreRef.current, [scoringSide]: scoreRef.current[scoringSide] + 1 };
        scoreRef.current = next;
        setScore(next);
        setLastScorer(scoringSide);
        possessionRef.current = 'FREE';
        setPossession('FREE');
        setPhase('GOAL_PAUSE');
        return;
      }

      if (elapsedRef.current >= MATCH_DURATION_S) finishMatch();
    },
    [mode, canPickUp, finishMatch],
  );

  // GOAL_PAUSE is pausable too (previously excluded, which left the Pause
  // button silently inert during the ~1.8s goal celebration) - the
  // GOAL_PAUSE useEffect below already clears its setTimeout via its own
  // cleanup whenever `phase` changes away from 'GOAL_PAUSE', so pausing
  // here safely cancels that timer without any extra bookkeeping, and
  // resume() (generic, via prevPhaseRef) naturally restarts a fresh
  // GOAL_PAUSE_S celebration on resume rather than a mid-way one - a minor
  // animation-timing nuance, not a change to scoring/match-clock behavior
  // (elapsedRef only advances during onTick, which never runs while paused).
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
    aiHorseRef.current = new HorseController(AI_HORSE_CONFIG, AI_START.x, AI_START.z, 0);
    objectPositionRef.current = { ...OBJECT_SPAWN };
    possessionRef.current = 'FREE';
    scoreRef.current = { player: 0, ai: 0 };
    cooldownRef.current = 0;
    elapsedRef.current = 0;
    topSpeedRef.current = 0;
    setPossession('FREE');
    setScore({ player: 0, ai: 0 });
    setLastScorer(null);
    setCanPickUp(false);
    setLiveElapsedSeconds(0);
    setPracticeScoreCount(0);
    setSummary({ scored: false, elapsedSeconds: 0, topSpeed: 0, playerScore: 0, aiScore: 0, outcome: 'DRAW' });
    setPhase('READY');
  }, []);

  return {
    phase,
    mode,
    possession,
    score,
    lastScorer,
    canPickUp,
    playerHorseRef,
    aiHorseRef,
    objectPositionRef,
    liveElapsedSeconds,
    practiceScoreCount,
    summary,
    finishIntro,
    finishTutorial,
    start,
    pickUp,
    drop,
    resetObject,
    onTick,
    pause,
    resume,
    restart,
  };
}
