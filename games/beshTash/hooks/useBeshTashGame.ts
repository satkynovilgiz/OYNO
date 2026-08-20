import { useCallback, useRef, useState } from 'react';
import { Easing, runOnJS, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';

import * as Engine from '../engine';
import type { BeshTashGameState, BeshTashMoveResult } from '../types';

const TOSS_DURATION_MS = 1400;
/** Fraction of the toss window, at the end, that counts as a good catch. */
const SWEET_SPOT_FRACTION = 0.28;
/** Small grace window after the ring closes so a near-miss tap still registers. */
const LATE_TAP_GRACE_MS = 150;

export function useBeshTashGame() {
  const [state, setState] = useState<BeshTashGameState>(Engine.createInitialState());
  const [isAttempting, setIsAttempting] = useState(false);
  const [lastResult, setLastResult] = useState<BeshTashMoveResult | null>(null);

  const liftProgress = useSharedValue(0);
  const ringProgress = useSharedValue(0);
  const resolvedRef = useRef(true);
  const attemptStartRef = useRef(0);

  const resolveAttempt = useCallback((tapped: boolean) => {
    if (resolvedRef.current) return;
    resolvedRef.current = true;

    setState((current) => {
      if (current.status !== 'in-progress') return current;
      const stage = Engine.getActiveStage(current);
      if (!stage) return current;

      const elapsed = Date.now() - attemptStartRef.current;
      const withinWindow =
        tapped &&
        elapsed >= TOSS_DURATION_MS * (1 - SWEET_SPOT_FRACTION) &&
        elapsed <= TOSS_DURATION_MS + LATE_TAP_GRACE_MS;

      const { state: nextState, result } = Engine.applyCatch(current, stage.grabCount, withinWindow);
      setLastResult(result);
      return nextState;
    });
    setIsAttempting(false);
  }, []);

  const attempt = useCallback(() => {
    if (state.status !== 'in-progress' || isAttempting) return;

    setIsAttempting(true);
    resolvedRef.current = false;
    attemptStartRef.current = Date.now();

    liftProgress.value = withSequence(
      withTiming(1, { duration: TOSS_DURATION_MS * 0.4, easing: Easing.out(Easing.quad) }),
      withTiming(1, { duration: TOSS_DURATION_MS * 0.3 }),
      withTiming(0, { duration: TOSS_DURATION_MS * 0.3, easing: Easing.in(Easing.quad) }),
    );

    ringProgress.value = 0;
    ringProgress.value = withTiming(
      1,
      { duration: TOSS_DURATION_MS, easing: Easing.linear },
      (finished) => {
        'worklet';
        if (finished) {
          runOnJS(resolveAttempt)(false);
        }
      },
    );
  }, [state.status, isAttempting, liftProgress, ringProgress, resolveAttempt]);

  const catchNow = useCallback(() => {
    resolveAttempt(true);
  }, [resolveAttempt]);

  const onPressAction = useCallback(() => {
    if (isAttempting) {
      catchNow();
    } else {
      attempt();
    }
  }, [isAttempting, attempt, catchNow]);

  const restart = useCallback(() => {
    resolvedRef.current = true;
    setIsAttempting(false);
    setLastResult(null);
    setState(Engine.restartGame());
    liftProgress.value = 0;
    ringProgress.value = 0;
  }, [liftProgress, ringProgress]);

  return {
    state,
    isAttempting,
    lastResult,
    liftProgress,
    ringProgress,
    sweetSpotFraction: SWEET_SPOT_FRACTION,
    onPressAction,
    restart,
  };
}
