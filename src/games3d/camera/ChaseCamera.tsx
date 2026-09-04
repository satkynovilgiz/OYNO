import { useFrame, useThree } from '@react-three/fiber';
import { type MutableRefObject, useRef } from 'react';
import * as THREE from 'three';

export type ChaseCameraTarget = { x: number; z: number; heading: number; speed: number; maxSpeed: number };

type ChaseCameraProps = {
  targetRef: MutableRefObject<ChaseCameraTarget>;
  /** Section "KOK BORU — CAMERA": needs to sit slightly higher/farther back
   * than Kyz Kuumai's chase cam for better situational awareness - override
   * the defaults per game rather than duplicating this whole component. */
  followDistance?: number;
  followHeight?: number;
};

const DEFAULT_FOLLOW_DISTANCE = 4.2;
const DEFAULT_FOLLOW_HEIGHT = 1.8;
const LOOK_HEIGHT = 1.0;
const LERP_SPEED = 4;
const BASE_FOV = 55;
const MAX_FOV_BOOST = 8;

/** Shared third-person chase camera (Section 38: "behind + slightly above,
 * smooth follow... small FOV increase at speed") for horse games. Reads a
 * ref updated every physics step, not a React prop, since the target moves
 * every frame (Section 86/87). No camera shake (explicitly avoided by
 * spec), no terrain collision yet (Section 90 - documented limitation). */
export function ChaseCamera({ targetRef, followDistance = DEFAULT_FOLLOW_DISTANCE, followHeight = DEFAULT_FOLLOW_HEIGHT }: ChaseCameraProps) {
  const { camera } = useThree();
  const currentPosition = useRef<THREE.Vector3 | null>(null);
  const currentLookAt = useRef<THREE.Vector3 | null>(null);

  useFrame((_state, delta) => {
    const target = targetRef.current;
    const behindX = target.x - Math.sin(target.heading) * followDistance;
    const behindZ = target.z + Math.cos(target.heading) * followDistance;
    const targetPosition = new THREE.Vector3(behindX, followHeight, behindZ);
    const targetLookAt = new THREE.Vector3(target.x, LOOK_HEIGHT, target.z);

    if (!currentPosition.current) currentPosition.current = targetPosition.clone();
    if (!currentLookAt.current) currentLookAt.current = targetLookAt.clone();

    const t = Math.min(1, LERP_SPEED * delta);
    currentPosition.current.lerp(targetPosition, t);
    currentLookAt.current.lerp(targetLookAt, t);

    camera.position.copy(currentPosition.current);
    camera.lookAt(currentLookAt.current);

    if (camera instanceof THREE.PerspectiveCamera) {
      const speedRatio = Math.min(1, target.speed / target.maxSpeed);
      const targetFov = BASE_FOV + speedRatio * MAX_FOV_BOOST;
      camera.fov = THREE.MathUtils.lerp(camera.fov, targetFov, t);
      camera.updateProjectionMatrix();
    }
  });

  return null;
}
