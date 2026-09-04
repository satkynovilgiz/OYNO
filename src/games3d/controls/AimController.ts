import { useCallback, useRef } from 'react';
import { Gesture } from 'react-native-gesture-handler';
import { runOnJS, useSharedValue } from 'react-native-reanimated';

/** Drag-to-aim / hold-to-draw / release-to-shoot input for Jaa Atuu, where
 * power comes from how long you hold rather than how far you drag. Ordo and
 * Chuko use the differently-shaped `DragPowerController` instead (power
 * from pull distance, not hold time) - see that file's header for why.
 * Aim and power live in Reanimated shared values so dragging never triggers
 * a React re-render (Section 86/87) - only `onRelease` crosses back into
 * JS, once per shot. */

export type AimReleasePayload = {
  /** Horizontal aim offset, roughly -1 (full left) to 1 (full right). */
  aimX: number;
  /** Vertical aim offset, roughly -1 (full down) to 1 (full up). */
  aimY: number;
  /** 0..1 draw strength, derived from how long the shot was held. */
  power: number;
};

const MAX_AIM_DRAG_PX = 160;
const MIN_DRAW_MS = 120;
const MAX_DRAW_MS = 1400;

type UseAimControllerOptions = {
  enabled: boolean;
  onDrawStart?: () => void;
  onRelease: (payload: AimReleasePayload) => void;
};

export function useAimController({ enabled, onDrawStart, onRelease }: UseAimControllerOptions) {
  const aimX = useSharedValue(0);
  const aimY = useSharedValue(0);
  const power = useSharedValue(0);
  const isDrawing = useSharedValue(false);
  /** Set inside the worklet itself, not from the JS-thread callback, so a
   * live power readout (Section 26/27 bow-draw feedback) never races the
   * bridge round-trip. */
  const drawStartedAtMs = useSharedValue(0);
  const drawStartedAt = useRef(0);

  const handleDrawStart = useCallback(() => {
    drawStartedAt.current = Date.now();
    onDrawStart?.();
  }, [onDrawStart]);

  const handleRelease = useCallback(
    (finalAimX: number, finalAimY: number) => {
      const heldMs = Date.now() - drawStartedAt.current;
      const clampedMs = Math.min(MAX_DRAW_MS, Math.max(MIN_DRAW_MS, heldMs));
      const computedPower = (clampedMs - MIN_DRAW_MS) / (MAX_DRAW_MS - MIN_DRAW_MS);
      onRelease({ aimX: finalAimX, aimY: finalAimY, power: Math.max(0.15, computedPower) });
    },
    [onRelease],
  );

  const gesture = Gesture.Pan()
    .enabled(enabled)
    .onBegin(() => {
      'worklet';
      isDrawing.value = true;
      power.value = 0;
      drawStartedAtMs.value = Date.now();
      runOnJS(handleDrawStart)();
    })
    .onUpdate((event) => {
      'worklet';
      aimX.value = Math.max(-1, Math.min(1, event.translationX / MAX_AIM_DRAG_PX));
      aimY.value = Math.max(-1, Math.min(1, -event.translationY / MAX_AIM_DRAG_PX));
    })
    .onEnd(() => {
      'worklet';
      isDrawing.value = false;
      runOnJS(handleRelease)(aimX.value, aimY.value);
    });

  return { gesture, aimX, aimY, power, isDrawing, drawStartedAtMs, MIN_DRAW_MS, MAX_DRAW_MS };
}
