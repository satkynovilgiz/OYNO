import type { ChukoPhysicsPiece } from './ChukoPhysicsWorld';
import type { ChukoSide } from './ChukoTypes';

export type ChukoCaptureOutcome = {
  captured: ChukoPhysicsPiece[];
  scoreDelta: number;
};

/** RULES only - Variant A ("throw-and-collect") scoring: 1 point per piece
 * knocked out of the circle, to whoever threw. No khan/threshold logic
 * (unlike Ordo) since that variant has neither. */
export function evaluateChukoCaptures(outOfBoundsPieces: ChukoPhysicsPiece[], _throwingSide: ChukoSide): ChukoCaptureOutcome {
  return { captured: outOfBoundsPieces, scoreDelta: outOfBoundsPieces.length };
}
