import { useFrame, useThree } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';

function easeInOutQuad(t: number) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

type IntroCameraSweepProps = {
  /** World-space point the start/end offsets are measured from - pass the
   * SAME anchor the gameplay camera uses (e.g. AimCamera's `anchor`), not
   * the look-at point, or the sweep's final frame won't match where the
   * gameplay camera picks up and the hand-off will visibly pop. */
  positionAnchor: THREE.Vector3;
  /** Offset from `positionAnchor` for the wide starting shot. */
  startOffset: THREE.Vector3;
  /** Offset from `positionAnchor` the sweep ends on - pass the gameplay
   * camera's own offset (e.g. AIM_CAMERA_OFFSET) for a clean hand-off. */
  endOffset: THREE.Vector3;
  lookAt: THREE.Vector3;
  durationMs: number;
};

/** Shared "camera shows the landscape -> approaches the game area" intro
 * sweep (Section "COMMON GAME INTRO") - lerps from a wide/elevated shot to
 * wherever the game's normal camera will pick up, timed to match
 * GameIntroCard's on-screen duration. Reusable by every game's INTRO phase,
 * not just Jaa Atuu's. */
export function IntroCameraSweep({ positionAnchor, startOffset, endOffset, lookAt, durationMs }: IntroCameraSweepProps) {
  const { camera } = useThree();
  const startedAt = useRef(Date.now());
  const position = useRef(new THREE.Vector3());

  useFrame(() => {
    const t = Math.min(1, (Date.now() - startedAt.current) / durationMs);
    const eased = easeInOutQuad(t);

    position.current.copy(startOffset).lerp(endOffset, eased).add(positionAnchor);
    camera.position.copy(position.current);
    camera.lookAt(lookAt);
  });

  return null;
}
