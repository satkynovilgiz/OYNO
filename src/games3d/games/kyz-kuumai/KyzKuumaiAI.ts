import type { HorseInput } from '../../shared/horse/HorseController';
import { getPointAtProgress, getTrackProgress, TRACK_TOTAL_LENGTH } from './KyzKuumaiTrack';

const LOOKAHEAD_M = 7;

/** Path-following steering only (Section 40: "AI should control horse
 * using similar movement constraints... no teleporting"). The AI never
 * gets a speed/turn advantage beyond what its own HorseController's config
 * allows (see KyzKuumaiController - the AI's config caps its top speed via
 * KYZ_KUUMAI_DIFFICULTY.aiSpeedRatio, not by cheating steering/turning). */
export function computeAiHorseInput(aiPosition: { x: number; z: number }): HorseInput {
  const progress = getTrackProgress(aiPosition);
  const lookahead = getPointAtProgress(Math.min(TRACK_TOTAL_LENGTH, progress + LOOKAHEAD_M));

  const dx = lookahead.x - aiPosition.x;
  const dz = lookahead.z - aiPosition.z;
  const length = Math.hypot(dx, dz) || 1;

  return { moveX: dx / length, moveZ: dz / length, sprintHeld: true };
}
