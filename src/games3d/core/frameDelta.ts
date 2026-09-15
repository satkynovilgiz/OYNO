/** Ceiling on a single `useFrame` step (Section "prevent large frame/delta
 * jumps when returning") - 1/20s (50ms), i.e. never treat a frame as slower
 * than 20fps even if it actually took far longer in wall-clock time. Under
 * normal play at any real frame rate (even a rough 20fps) this never
 * triggers, since a real per-frame delta is always well under this - it
 * only matters for the one pathological frame that follows resuming a
 * `frameloop="never"` Canvas (`core/Game3DCanvas.tsx`) after a long pause
 * or background stint, where the underlying clock would otherwise report a
 * delta of minutes/hours. Shared by every game instead of each re-deriving
 * or (as three of the five previously did) not clamping at all. */
export const MAX_FRAME_DELTA_S = 1 / 20;

/** Clamps a `useFrame` delta to `MAX_FRAME_DELTA_S`. Feed this into physics
 * steps (`OrdoPhysicsWorld.step`, `ChukoPhysicsWorld.step`,
 * `HorseController.step`) and any per-frame time accumulator (Jaa Atuu's
 * arrow-flight clock) instead of the raw `useFrame` delta. */
export function clampFrameDelta(delta: number): number {
  return Math.min(delta, MAX_FRAME_DELTA_S);
}
