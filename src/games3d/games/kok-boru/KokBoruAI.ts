import type { HorseInput } from '../../shared/horse/HorseController';

/** Open-field seek steering - unlike Kyz Kuumai's track-following AI
 * (KyzKuumaiAI.ts), Kok Boru's AI has no course to stay on, just a target
 * point that changes with the match state (the object, the player, or its
 * own goal - see KokBoruController.ts). Still goes through the same
 * HorseController.step() physics as the player (Section "No teleporting
 * AI") - this only ever produces a joystick-shaped input vector. */
export function computeAiSteering(from: { x: number; z: number }, to: { x: number; z: number }, sprintHeld: boolean): HorseInput {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const length = Math.hypot(dx, dz) || 1;
  return { moveX: dx / length, moveZ: dz / length, sprintHeld };
}
