import type { OrdoPhysicsPiece } from './OrdoPhysicsWorld';
import { ORDO_CAPTURES_BEFORE_KHAN, ORDO_KHAN_CAPTURE_BONUS, ORDO_KHAN_CONSOLATION, type OrdoSide } from './OrdoTypes';

export type CaptureOutcome = {
  /** Pieces that are genuinely captured this turn and should be removed
   * from the physics world. */
  legalCaptures: OrdoPhysicsPiece[];
  /** Set when the khan physically crossed the boundary but the throwing
   * side hadn't cleared 3 regular pieces yet - the physics world should put
   * this piece back in bounds rather than remove it. */
  rejectedKhanId: string | null;
  scoreDelta: { player: number; ai: number };
  khanCapturedBy: OrdoSide | null;
};

/** RULES only (Section "PHYSICS VS RULES") - takes what physically happened
 * (which pieces are now outside the boundary) and decides what it means:
 * points, and whether a khan hit is even legal yet. Pure function, no
 * physics/rendering concerns, so this is exactly what a future cultural-
 * rules correction would edit without touching OrdoPhysicsWorld. */
export function evaluateCaptures(
  outOfBoundsPieces: OrdoPhysicsPiece[],
  throwingSide: OrdoSide,
  capturesSoFar: { player: number; ai: number },
): CaptureOutcome {
  const regularCaptured = outOfBoundsPieces.filter((piece) => piece.kind === 'regular');
  const khanPiece = outOfBoundsPieces.find((piece) => piece.kind === 'khan') ?? null;

  const legalCaptures: OrdoPhysicsPiece[] = [...regularCaptured];
  const scoreDelta = { player: 0, ai: 0 };
  let rejectedKhanId: string | null = null;
  let khanCapturedBy: OrdoSide | null = null;

  scoreDelta[throwingSide] += regularCaptured.length;

  if (khanPiece) {
    // This turn's own regular captures count toward the threshold - the
    // player just knocked them out in the same throw, so they're already
    // "cleared" by the time the khan crosses the line a moment later.
    const throwerCapturesIncludingThisTurn = capturesSoFar[throwingSide] + regularCaptured.length;

    if (throwerCapturesIncludingThisTurn >= ORDO_CAPTURES_BEFORE_KHAN) {
      legalCaptures.push(khanPiece);
      khanCapturedBy = throwingSide;
      scoreDelta[throwingSide] += ORDO_KHAN_CAPTURE_BONUS;
      const opponent: OrdoSide = throwingSide === 'player' ? 'ai' : 'player';
      scoreDelta[opponent] += ORDO_KHAN_CONSOLATION;
    } else {
      rejectedKhanId = khanPiece.id;
    }
  }

  return { legalCaptures, rejectedKhanId, scoreDelta, khanCapturedBy };
}
