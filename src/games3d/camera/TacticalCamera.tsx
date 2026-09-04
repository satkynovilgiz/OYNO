import { useFrame, useThree } from '@react-three/fiber';
import { type RefObject, useRef } from 'react';
import * as THREE from 'three';

type TacticalCameraProps = {
  center: THREE.Vector3;
  /** Elevated angled overview offset from `center` (Section "ORDO —
   * CAMERA": tactical overview before a shot, small follow during, smooth
   * return after). */
  overviewOffset: THREE.Vector3;
  /** A ref (not a plain value) because the follow point changes every
   * physics step, not every React render - when `.current` is set, the
   * camera eases toward looking more directly at that point (e.g. the
   * moving striker) instead of the field center; `null` eases back to the
   * tactical overview. The caller's own useFrame should mutate this ref in
   * place each frame. */
  followPointRef: RefObject<THREE.Vector3 | null>;
};

const LERP_SPEED = 3.5;

/** Shared angled tactical camera (Section "ORDO — CAMERA" /
 * "CHUKO — CAMERA") - reusable by any top-down-ish physics game, not just
 * Ordo. Smoothly blends its look-at and position toward the follow point
 * when set and eases back to the fixed overview when cleared, rather than
 * snapping either way. */
export function TacticalCamera({ center, overviewOffset, followPointRef }: TacticalCameraProps) {
  const { camera } = useThree();
  const currentPosition = useRef<THREE.Vector3 | null>(null);
  const currentLookAt = useRef<THREE.Vector3 | null>(null);

  useFrame((_state, delta) => {
    const followPoint = followPointRef.current;
    const targetLookAt = followPoint ?? center;
    // Follow the action a little, but stay mostly tactical - blend only
    // 35% of the way toward the follow point's offset from center.
    const targetPosition = followPoint
      ? center.clone().addScaledVector(overviewOffset, 1).lerp(followPoint.clone().add(overviewOffset), 0.35)
      : center.clone().add(overviewOffset);

    if (!currentPosition.current) currentPosition.current = targetPosition.clone();
    if (!currentLookAt.current) currentLookAt.current = targetLookAt.clone();

    const t = Math.min(1, LERP_SPEED * delta);
    currentPosition.current.lerp(targetPosition, t);
    currentLookAt.current.lerp(targetLookAt, t);

    camera.position.copy(currentPosition.current);
    camera.lookAt(currentLookAt.current);
  });

  return null;
}
