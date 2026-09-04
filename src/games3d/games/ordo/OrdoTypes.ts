import type { GamePhase } from '../../core/gameTypes';

/** Ordo's turn structure needs more granularity than the base GamePhase set
 * (Section "ORDO — TURN SYSTEM": a reliable PHYSICS_SETTLING state, and no
 * new shot while pieces are still moving) - extends rather than reuses
 * GamePhase 1:1, reusing its shared names (LOADING/INTRO/TUTORIAL/PAUSED/
 * RESULT) where the meaning is identical. */
// No separate THROWING phase: the instant a piece launches, isSettled()
// is already false (it's moving fast), so a distinct THROWING phase would
// never have a different meaning than SETTLING - collapsed into one to
// avoid a state that does nothing (Section "COMMON GAME STATES").
export type OrdoPhase = Extract<GamePhase, 'LOADING' | 'INTRO' | 'TUTORIAL' | 'PAUSED' | 'RESULT'> | 'PLAYER_TURN' | 'SETTLING' | 'AI_TURN';

export type OrdoSide = 'player' | 'ai';

export type OrdoPieceKind = 'regular' | 'khan';

export type OrdoPieceState = {
  id: string;
  kind: OrdoPieceKind;
  /** Once captured, a piece stops being simulated/rendered on the field. */
  captured: boolean;
  capturedBy: OrdoSide | null;
};

/**
 * ============================================================
 * TRADITIONAL RULE vs MOBILE PROTOTYPE ADAPTATION (Section 32)
 * ============================================================
 * Source: games/ordo/RULES.md (kabar.kg-sourced, "core rules verified").
 *
 * TRADITIONAL RULE (sourced):
 * - Two concentric circles on flat ground (adult inner circle radius 6m).
 * - A cluster of chuko pieces sits around a central "khan" piece.
 * - Teams throw from outside the circle to knock pieces out.
 * - A team must knock out 3 regular pieces before it may target the khan.
 * - Capturing the khan awards it + 3 pieces to the capturing side and 2
 *   pieces to the opponent, and is the decisive/match-ending event.
 * - Real team size (~7 active players/side) and the exact total piece
 *   count are UNVERIFIED in the source (internally inconsistent 68 vs 70).
 *
 * MOBILE PROTOTYPE ADAPTATION (this implementation):
 * - 1 player vs 1 AI opponent, not 7-a-side teams - team play is out of
 *   scope for this prototype.
 * - A reduced cluster of ORDO_PIECE_COUNT regular pieces (not ~35/side) for
 *   mobile session length/pacing.
 * - The "3 regular pieces before targeting the khan" rule is enforced by
 *   the rules engine, not by restricting where the player can physically
 *   aim: if the khan crosses the boundary before the throwing side has 3
 *   captures, the capture is rejected (khan stays in play) rather than the
 *   game preventing the throw itself.
 * - No fixed real-world match clock (2h/1.5h) - ends on khan capture or
 *   after MAX_TURNS_PER_SIDE turns each, whoever has more points wins.
 */
export const ORDO_FIELD_RADIUS = 4.5;
export const ORDO_PIECE_COUNT = 8;
export const ORDO_CAPTURES_BEFORE_KHAN = 3;
export const ORDO_KHAN_CAPTURE_BONUS = 3;
export const ORDO_KHAN_CONSOLATION = 2;
export const MAX_TURNS_PER_SIDE = 8;

export type OrdoDifficulty = 'easy' | 'normal' | 'hard';

export type OrdoDifficultyConfig = {
  /** How close to the ideal shot the AI's aim/power actually lands, 0..1 -
   * never 1 (Section "Do not give AI exact impossible perfect physics"). */
  aiAccuracy: number;
};

export const ORDO_DIFFICULTY: Record<OrdoDifficulty, OrdoDifficultyConfig> = {
  easy: { aiAccuracy: 0.45 },
  normal: { aiAccuracy: 0.65 },
  hard: { aiAccuracy: 0.85 },
};

export type OrdoResultSummary = {
  playerScore: number;
  aiScore: number;
  playerCaptures: number;
  aiCaptures: number;
  winner: OrdoSide | 'draw';
  khanCapturedBy: OrdoSide | null;
};
