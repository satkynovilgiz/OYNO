import type { GamePhase } from '../../core/gameTypes';

// Reused as-is (no extra phases needed): READY doubles as the "3-2-1" get-
// ready beat right before the chase starts, PLAYING covers the whole
// continuous chase (no turn structure like Ordo/Chuko).
export type KyzKuumaiPhase = GamePhase;

/**
 * ============================================================
 * TRADITIONAL RULE vs MOBILE PROTOTYPE ADAPTATION (Section 32)
 * ============================================================
 * Source: games/kyzKuumay/RULES.md ("core structure verified").
 *
 * TRADITIONAL RULE (sourced):
 * - Two-phase chase: the girl rides first with a head start; the boy
 *   chases. If he catches her before the course ends, the traditional
 *   resolution is described in the source as a kiss "from the face".
 * - If he fails, roles reverse for a second phase (girl chases boy) - the
 *   source does not specify Phase 2's win condition (UNVERIFIED).
 * - Course: up to "1.5 chakyrym" (unconverted traditional distance unit).
 *
 * MOBILE PROTOTYPE ADAPTATION (this implementation) - see the explicit
 * cultural-sensitivity flag in the source doc, which required this call
 * before implementation, not a unilateral decision:
 * - Roles are named generically ("chaser" / "lead rider"), not gendered, so
 *   this works regardless of the player's avatar.
 * - The catch resolution is a stylized, NON-LITERAL gesture (the lead
 *   rider tosses back a decorative ribbon as the chaser draws alongside -
 *   see KyzKuumaiScene's catch VFX) - explicitly NOT a kiss animation, per
 *   the source's own flag that a literal kiss needs sign-off this pass
 *   doesn't have.
 * - Phase 2 (role reversal) is NOT implemented - its win condition is
 *   unverified in the source. This prototype is Phase 1 only: catch the
 *   lead rider before the course ends, or don't.
 * - One fixed course/distance, not "1.5 chakyrym" (unconverted).
 */
export const CATCH_RADIUS_M = 2.2;
export const MAX_ROUND_SECONDS = 90;

export type KyzKuumaiDifficulty = 'easy' | 'normal' | 'hard';
export type KyzKuumaiDifficultyConfig = {
  /** AI's max speed as a fraction of the player's max speed - the real
   * lever difficulty pulls (Section "Do not give AI exact impossible
   * perfect physics"). */
  aiSpeedRatio: number;
};

export const KYZ_KUUMAI_DIFFICULTY: Record<KyzKuumaiDifficulty, KyzKuumaiDifficultyConfig> = {
  easy: { aiSpeedRatio: 0.78 },
  normal: { aiSpeedRatio: 0.9 },
  hard: { aiSpeedRatio: 1.0 },
};

export type KyzKuumaiResultSummary = {
  caught: boolean;
  elapsedSeconds: number;
  topSpeed: number;
  closestDistance: number;
};
