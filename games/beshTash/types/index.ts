/**
 * Types for Беш таш (Besh Tash). See ../RULES.md for the sourced rule
 * description this engine implements ("Phrasing 2": one-stone-at-a-time
 * pickup progression, 5 discrete stages).
 */

export type BeshTashStatus = 'idle' | 'in-progress' | 'won' | 'failed';

export type BeshTashFoulReason =
  /** Used the non-playing hand (single-hand-only rule). */
  | 'second-hand-used'
  /** Touched a ground stone other than the one(s) being picked up this stage. */
  | 'touched-other-stone'
  /** Failed to catch the tossed stone(s). */
  | 'dropped-catch';

export type BeshTashStage = {
  id: 1 | 2 | 3 | 4 | 5;
  /** Stones already in hand at the start of this stage. */
  heldBefore: number;
  /** Stones to grab from the ground during this stage's catch. */
  grabCount: number;
  /** Stones in hand after a successful catch. */
  heldAfter: number;
  /** The final flourish stage (toss all 5, clap the ground, catch all). */
  isFlourish: boolean;
};

export type BeshTashGameState = {
  status: BeshTashStatus;
  /** 0-based index into BESH_TASH_STAGES. */
  currentStageIndex: number;
  stonesOnGround: number;
  stonesHeld: number;
  attemptsUsed: number;
  lastFoul: BeshTashFoulReason | null;
};

export type BeshTashMoveResult =
  | { type: 'stage-cleared'; nextStageIndex: number }
  | { type: 'game-won'; attemptsUsed: number }
  | { type: 'game-failed'; reason: BeshTashFoulReason };
