import { useCallback } from 'react';
import { Gesture } from 'react-native-gesture-handler';
import { runOnJS, useSharedValue } from 'react-native-reanimated';

/** Shared "touch piece, drag backward, release to launch" slingshot input
 * (Section "ORDO — BASIC INTERACTION" / "CHUKO — SHOOTING INTERACTION") -
 * used by Ordo and Chuko. Distinct from Jaa Atuu's AimController: there,
 * power comes from HOLD DURATION with aim from drag direction; here, power
 * comes from DRAG DISTANCE itself (a pull-back gesture), which is the
 * mechanic both Ordo and Chuko's specs actually describe - "Game-specific
 * math can differ" (Section 53) turned out to mean a genuinely different
 * shape, not just different constants. */

export type DragPowerReleasePayload = {
  /** Radians, left/right pull offset from straight-ahead. */
  angleOffset: number;
  /** 0..1, how far back the player pulled. */
  power: number;
};

const MAX_PULL_PX = 140;
const MAX_ANGLE_RAD = 0.6;

type UseDragPowerControllerOptions = {
  enabled: boolean;
  onRelease: (payload: DragPowerReleasePayload) => void;
};

export function useDragPowerController({ enabled, onRelease }: UseDragPowerControllerOptions) {
  const pullX = useSharedValue(0);
  const pullY = useSharedValue(0);
  const power = useSharedValue(0);
  const isPulling = useSharedValue(false);

  const handleRelease = useCallback(
    (finalPullX: number, finalPullY: number) => {
      const angleOffset = Math.max(-1, Math.min(1, finalPullX / MAX_PULL_PX)) * MAX_ANGLE_RAD;
      const releasePower = Math.max(0, Math.min(1, finalPullY / MAX_PULL_PX));
      if (releasePower <= 0.05) return; // a tiny accidental tap shouldn't launch anything
      onRelease({ angleOffset, power: releasePower });
    },
    [onRelease],
  );

  const gesture = Gesture.Pan()
    .enabled(enabled)
    .onBegin(() => {
      'worklet';
      isPulling.value = true;
      pullX.value = 0;
      pullY.value = 0;
      power.value = 0;
    })
    .onUpdate((event) => {
      'worklet';
      pullX.value = event.translationX;
      // Only a downward/backward drag (away from the field, toward the
      // player) builds power - dragging up shouldn't do anything odd.
      pullY.value = Math.max(0, event.translationY);
      power.value = Math.max(0, Math.min(1, pullY.value / MAX_PULL_PX));
    })
    .onEnd(() => {
      'worklet';
      isPulling.value = false;
      runOnJS(handleRelease)(pullX.value, pullY.value);
    });

  return { gesture, pullX, pullY, power, isPulling };
}
