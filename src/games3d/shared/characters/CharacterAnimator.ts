import * as THREE from 'three';

/**
 * Procedural pose helpers applied directly to a CharacterModel's exposed
 * shoulder/head group refs from a game's own useFrame (Section 7/9) - not
 * blended animation clips (no GLB/skeleton exists to carry those yet), just
 * direct joint-rotation shaping. Arms hang along -Y from the shoulder
 * pivot, so rotating around X swings the arm forward/back and around Z
 * swings it out to the side.
 */

export function applyRestPose(shoulder: THREE.Group) {
  shoulder.rotation.set(0, 0, 0);
}

/** 0 = arm relaxed at side, 1 = fully drawn back (Section 26: bow draw). */
export function applyDrawPose(shoulder: THREE.Group, progress: number, isDrawingArm: boolean) {
  const clamped = THREE.MathUtils.clamp(progress, 0, 1);
  if (isDrawingArm) {
    shoulder.rotation.x = THREE.MathUtils.lerp(-1.2, -0.55, clamped);
    shoulder.rotation.z = THREE.MathUtils.lerp(0.25, 0.45, clamped);
  } else {
    // Bow arm - raises and holds steady regardless of draw progress.
    shoulder.rotation.x = -1.35;
    shoulder.rotation.z = -0.35;
  }
}

/** Both arms raised in celebration, with a small continuous sway. */
export function applyCelebratePose(shoulder: THREE.Group, elapsedSeconds: number, side: 1 | -1) {
  shoulder.rotation.x = -2.6;
  shoulder.rotation.z = side * (0.3 + Math.sin(elapsedSeconds * 5) * 0.08);
}

/** A light forward lean, used for a seated rider reacting to horse speed
 * (Section "KYZ KUUMAI — PLAYER CHARACTER": "should lean slightly with
 * horse motion"). */
export function applyRiderLean(root: THREE.Group, speedRatio: number) {
  root.rotation.x = THREE.MathUtils.lerp(0, 0.18, THREE.MathUtils.clamp(speedRatio, 0, 1));
}
