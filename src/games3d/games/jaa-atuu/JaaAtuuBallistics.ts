import * as THREE from 'three';

import type { PendingShot } from './JaaAtuuController';
import { JAA_ATUU_RINGS, type JaaAtuuDifficultyConfig, type JaaAtuuRingId } from './JaaAtuuTypes';

const GRAVITY = 9.8;
const MIN_SPEED = 16;
const MAX_SPEED = 30;
const MAX_YAW_RAD = 0.32;
const MAX_PITCH_ADJUST_RAD = 0.18;

export const ARCHER_POSITION = new THREE.Vector3(0, 1.5, 0);

export function getTargetCenter(config: JaaAtuuDifficultyConfig, out = new THREE.Vector3()): THREE.Vector3 {
  return out.set(0, 1.5, -config.targetDistance);
}

/** Physics-free "adaptation" projectile math (Section 24/25) - analytic
 * parabola, no physics engine. The launch pitch auto-solves the standard
 * projectile-range equation for the chosen power and the difficulty's
 * target distance, so a straight (aimY=0) shot arcs onto the target at any
 * draw strength/distance; aimY then nudges above/below that baseline.
 * `aimAssistScale` (from difficulty) dampens the raw drag input before it
 * becomes yaw/pitch - easy mode makes a given drag move the aim point less,
 * which behaves like a larger target without touching the target's actual
 * scoring radii. This is a MOBILE PROTOTYPE ADAPTATION, not a claim about
 * real archery ballistics. */
export function launchDirection(
  shot: PendingShot,
  config: JaaAtuuDifficultyConfig,
): { direction: THREE.Vector3; speed: number } {
  const speed = THREE.MathUtils.lerp(MIN_SPEED, MAX_SPEED, THREE.MathUtils.clamp(shot.power, 0, 1));
  const assistedAimX = shot.aimX / config.aimAssistScale;
  const assistedAimY = shot.aimY / config.aimAssistScale;
  const yaw = assistedAimX * MAX_YAW_RAD;

  const rangeFactor = THREE.MathUtils.clamp((config.targetDistance * GRAVITY) / (speed * speed), -1, 1);
  const basePitch = 0.5 * Math.asin(rangeFactor);
  const pitch = basePitch + assistedAimY * MAX_PITCH_ADJUST_RAD;

  const direction = new THREE.Vector3(
    Math.sin(yaw) * Math.cos(pitch),
    Math.sin(pitch),
    -Math.cos(yaw) * Math.cos(pitch),
  ).normalize();

  return { direction, speed };
}

export function arrowPositionAt(
  shot: PendingShot,
  elapsedSeconds: number,
  config: JaaAtuuDifficultyConfig,
  out = new THREE.Vector3(),
): THREE.Vector3 {
  const { direction, speed } = launchDirection(shot, config);
  out.copy(ARCHER_POSITION);
  out.addScaledVector(direction, speed * elapsedSeconds);
  out.y -= 0.5 * GRAVITY * elapsedSeconds * elapsedSeconds;
  return out;
}

export function arrowVelocityAt(shot: PendingShot, elapsedSeconds: number, config: JaaAtuuDifficultyConfig, out = new THREE.Vector3()): THREE.Vector3 {
  const { direction, speed } = launchDirection(shot, config);
  return out.set(
    direction.x * speed,
    direction.y * speed - GRAVITY * elapsedSeconds,
    direction.z * speed,
  );
}

export type ImpactResult = {
  ring: JaaAtuuRingId | null;
  score: number;
  hitOffset: { x: number; y: number } | null;
};

/** Given a world-space point already known to be at (or past) the target's
 * z-plane, resolve which scoring ring it landed in. */
export function resolveImpact(point: THREE.Vector3, targetCenter: THREE.Vector3): ImpactResult {
  const localX = point.x - targetCenter.x;
  const localY = point.y - targetCenter.y;
  const radius = Math.hypot(localX, localY);

  // Smallest radius first, so a center hit matches "center" and not the
  // first (largest) ring whose radius happens to be >= the hit distance.
  const ring = [...JAA_ATUU_RINGS].sort((a, b) => a.radius - b.radius).find((candidate) => radius <= candidate.radius) ?? null;

  return {
    ring: ring?.id ?? null,
    score: ring?.score ?? 0,
    hitOffset: { x: localX, y: localY },
  };
}

export const GROUND_Y = 0;
export const MAX_FLIGHT_SECONDS = 4;

export type FlightOutcome = {
  /** Seconds from release until the arrow stops (target face, ground, or
   * the safety timeout). */
  endTime: number;
  /** Exact world position where the flight ends. */
  endPoint: THREE.Vector3;
  impact: ImpactResult;
};

/**
 * Where and when this shot ends, solved analytically from the same
 * parabola the arrow is drawn along - so the score is exactly the point
 * where the arc crosses the target plane, identical at 30, 60 or 120 fps
 * (the scene used to judge the first *rendered* frame past the plane,
 * which could be up to ~0.5 m further along at full power).
 */
export function resolveFlight(shot: PendingShot, config: JaaAtuuDifficultyConfig): FlightOutcome {
  const { direction, speed } = launchDirection(shot, config);
  const targetCenter = getTargetCenter(config);

  // Target plane: z(t) = z0 + dz·v·t  (dz < 0 flies toward the target).
  const vz = direction.z * speed;
  const planeTime = vz < 0 ? (targetCenter.z - ARCHER_POSITION.z) / vz : Number.POSITIVE_INFINITY;

  // Ground: y0 + vy·t - g·t²/2 = GROUND_Y  →  the positive root.
  const vy = direction.y * speed;
  const a = 0.5 * GRAVITY;
  const c = GROUND_Y - ARCHER_POSITION.y;
  const groundTime = (vy + Math.sqrt(vy * vy - 4 * a * c)) / (2 * a);

  if (planeTime <= groundTime && planeTime <= MAX_FLIGHT_SECONDS) {
    const endPoint = arrowPositionAt(shot, planeTime, config);
    return { endTime: planeTime, endPoint, impact: resolveImpact(endPoint, targetCenter) };
  }
  const endTime = Math.min(groundTime, MAX_FLIGHT_SECONDS);
  return { endTime, endPoint: arrowPositionAt(shot, endTime, config), impact: { ring: null, score: 0, hitOffset: null } };
}
