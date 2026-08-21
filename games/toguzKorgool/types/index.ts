/**
 * Types for Тогуз коргоол (Toguz Korgool). See ../RULES.md for the sourced
 * rules this engine implements, including which parts are UNVERIFIED.
 *
 * Board model: 18 pits in one flat array, no separate kazan slots in the
 * sowing path (RULES.md: sowing "skip[s] your own kazan" - modeled here by
 * kazans simply not being part of the 18-pit index space at all, so there is
 * nothing to skip).
 *   - pits[0..8]  = player 0's row, local position 0..8
 *   - pits[9..17] = player 1's row, local position 0..8
 * Local position 8 in each row (global index 8 or 17) is the pit RULES.md
 * calls "ооз" - closest to that player's own kazan, and the one pit that can
 * never be declared tuz.
 */

export type PlayerId = 0 | 1;

export type ToguzKorgoolStatus = 'idle' | 'in-progress' | 'won' | 'no-legal-moves';

export type ToguzKorgoolGameState = {
  status: ToguzKorgoolStatus;
  /** 18 pits, see layout note above. */
  pits: number[];
  /** Stones collected in each player's kazan. */
  kazans: [number, number];
  /** Each player's declared tuz pit (global 0-17 index), or null if
   * undeclared. Once set for a player it never changes (RULES.md: "cannot
   * be changed", "may only declare one tuz for the entire game"). */
  tuz: [number | null, number | null];
  currentPlayer: PlayerId;
  winner: PlayerId | null;
};

export type ToguzKorgoolMoveResult =
  | { type: 'move-applied'; sower: PlayerId; captured: number }
  | { type: 'game-won'; winner: PlayerId; kazanCount: number }
  | { type: 'no-legal-moves'; player: PlayerId };

export const PITS_PER_ROW = 9;
export const TOTAL_PITS = 18;
export const STARTING_STONES_PER_PIT = 9;
export const TOTAL_STONES = STARTING_STONES_PER_PIT * TOTAL_PITS;
/** Bare majority of TOTAL_STONES (162) - first to collect this many wins immediately. */
export const WINNING_KAZAN_COUNT = 82;
