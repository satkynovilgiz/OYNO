import { useFrame, useThree } from '@react-three/fiber';
import { useRef } from 'react';
import type { SharedValue } from 'react-native-reanimated';
import * as THREE from 'three';

/** Fixed over-the-shoulder camera (Section 27) - stays close behind the
 * archer; the only response to drag input is a small look-offset toward
 * wherever the player is currently aiming, read directly from shared values
 * each frame so dragging never triggers a React re-render. The player never
 * directly controls the camera.
 *
 * `bullseyeSignalMs` is a plain timestamp (Date.now() at the moment of a
 * center-ring hit, or 0/undefined otherwise) - when it's recent, the camera
 * blends toward a brief zoom-in on the target and back over ~900ms
 * (Section "JAA ATUU — CAMERA FEEDBACK": max ~1s cinematic interruption,
 * not literal slow motion - see docs/3D_GAMES.md known limitations). */
type AimCameraProps = {
  aimX: SharedValue<number>;
  aimY: SharedValue<number>;
  anchor: THREE.Vector3;
  lookAt: THREE.Vector3;
  bullseyeSignalMs?: number;
};

/** Exported so IntroCameraSweep can land the intro's final frame exactly
 * where AimCamera picks up, avoiding a visible pop. */
export const AIM_CAMERA_OFFSET = new THREE.Vector3(0, 0.15, 0.9);
const OFFSET = AIM_CAMERA_OFFSET;
const LOOK_SHIFT_MAX = 0.6;
const FOCUS_DURATION_MS = 900;
const FOCUS_ZOOM_OFFSET = new THREE.Vector3(0, 0.05, 0.45);

function easeInOutQuad(t: number) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

export function AimCamera({ aimX, aimY, anchor, lookAt, bullseyeSignalMs }: AimCameraProps) {
  const { camera } = useThree();
  const lookTarget = useRef(new THREE.Vector3());
  const position = useRef(new THREE.Vector3());

  useFrame(() => {
    const elapsed = bullseyeSignalMs ? Date.now() - bullseyeSignalMs : Infinity;
    // Triangle envelope: 0 -> 1 over the first half of the window, 1 -> 0
    // over the second half, so the zoom eases in and back out.
    const focus =
      elapsed < FOCUS_DURATION_MS
        ? easeInOutQuad(1 - Math.abs(elapsed / FOCUS_DURATION_MS - 0.5) * 2)
        : 0;

    position.current.set(anchor.x, anchor.y, anchor.z).addScaledVector(OFFSET, 1 - focus).addScaledVector(FOCUS_ZOOM_OFFSET, focus);
    camera.position.copy(position.current);

    lookTarget.current.set(lookAt.x + aimX.value * LOOK_SHIFT_MAX * (1 - focus), lookAt.y + aimY.value * LOOK_SHIFT_MAX * (1 - focus), lookAt.z);
    camera.lookAt(lookTarget.current);
  });

  return null;
}
