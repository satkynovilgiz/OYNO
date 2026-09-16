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
/** Section "camera collision protection" - the camera is never pulled in
 * closer to the horse than this even when an obstacle sits between them,
 * which keeps it structurally outside the horse/rider's own body (both
 * games' `followDistance` defaults, 4.2/5.2, are well clear of this). */
const MIN_FOLLOW_DISTANCE = 1.6;
/** Never let the camera end up at/below ground level - both games' terrain
 * is a flat plane at y=0, so this alone guarantees no ground clipping. */
const MIN_CAMERA_HEIGHT = 0.5;
/** Stop just short of a hit surface rather than exactly on it. */
const OBSTACLE_MARGIN = 0.35;

/** Shared third-person chase camera (Section 38: "behind + slightly above,
 * smooth follow... small FOV increase at speed") for horse games. Reads a
 * ref updated every physics step, not a React prop, since the target moves
 * every frame (Section 86/87). No camera shake (explicitly avoided by
 * spec).
 *
 * Obstacle avoidance (Section "camera collision protection"): each frame,
 * before smoothing toward the desired behind-and-above position, a ray is
 * cast from near the horse/rider toward that position and clamped short of
 * anything tagged `userData.cameraObstacle` (currently `BozUy`/
 * `RockCluster` - see their own comments) that sits in the way, with a
 * floor on both the resulting distance (`MIN_FOLLOW_DISTANCE`, keeping the
 * camera outside the horse/rider itself) and height (`MIN_CAMERA_HEIGHT`,
 * keeping it above the ground plane). The obstacle list is gathered once
 * (these decorations are static for a whole match, never added/removed at
 * runtime) rather than re-traversing the scene graph every frame. Feeding
 * the (possibly clamped) result into the exact same `LERP_SPEED` smoothing
 * already used for normal following - rather than snapping straight to
 * it - is what keeps a correction gradual instead of a sudden jump; no
 * separate smoothing pass was added for this. */
export function ChaseCamera({ targetRef, followDistance = DEFAULT_FOLLOW_DISTANCE, followHeight = DEFAULT_FOLLOW_HEIGHT }: ChaseCameraProps) {
  const { camera, scene } = useThree();
  const currentPosition = useRef<THREE.Vector3 | null>(null);
  const currentLookAt = useRef<THREE.Vector3 | null>(null);
  const obstaclesRef = useRef<THREE.Object3D[] | null>(null);
  const raycasterRef = useRef<THREE.Raycaster | null>(null);
  const desiredScratch = useRef(new THREE.Vector3());
  const lookAtScratch = useRef(new THREE.Vector3());
  const directionScratch = useRef(new THREE.Vector3());

  useFrame((_state, delta) => {
    const target = targetRef.current;
    const behindX = target.x - Math.sin(target.heading) * followDistance;
    const behindZ = target.z + Math.cos(target.heading) * followDistance;
    const desiredPosition = desiredScratch.current.set(behindX, followHeight, behindZ);
    const targetLookAt = lookAtScratch.current.set(target.x, LOOK_HEIGHT, target.z);

    if (!obstaclesRef.current) {
      const found: THREE.Object3D[] = [];
      scene.traverse((child) => {
        if (child.userData?.cameraObstacle) found.push(child);
      });
      obstaclesRef.current = found;
    }

    const obstacles = obstaclesRef.current;
    if (obstacles.length > 0) {
      const direction = directionScratch.current.subVectors(desiredPosition, targetLookAt);
      const fullDistance = direction.length();
      if (fullDistance > 0.001) {
        direction.normalize();
        if (!raycasterRef.current) raycasterRef.current = new THREE.Raycaster();
        const raycaster = raycasterRef.current;
        raycaster.set(targetLookAt, direction);
        raycaster.far = fullDistance;
        const hits = raycaster.intersectObjects(obstacles, true);
        if (hits.length > 0) {
          const clampedDistance = Math.max(MIN_FOLLOW_DISTANCE, hits[0].distance - OBSTACLE_MARGIN);
          if (clampedDistance < fullDistance) {
            desiredPosition.copy(targetLookAt).addScaledVector(direction, clampedDistance);
          }
        }
      }
    }
    desiredPosition.y = Math.max(desiredPosition.y, MIN_CAMERA_HEIGHT);

    if (!currentPosition.current) currentPosition.current = desiredPosition.clone();
    if (!currentLookAt.current) currentLookAt.current = targetLookAt.clone();

    const t = Math.min(1, LERP_SPEED * delta);
    currentPosition.current.lerp(desiredPosition, t);
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
