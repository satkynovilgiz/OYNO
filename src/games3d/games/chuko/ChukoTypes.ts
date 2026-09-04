import type { GamePhase } from '../../core/gameTypes';

export type ChukoPhase = Extract<GamePhase, 'LOADING' | 'INTRO' | 'TUTORIAL' | 'PAUSED' | 'RESULT'> | 'PLAYER_TURN' | 'SETTLING' | 'AI_TURN';

export type ChukoSide = 'player' | 'ai';

/**
 * ============================================================
 * TRADITIONAL RULE vs MOBILE PROTOTYPE ADAPTATION (Section 32)
 * ============================================================
 * Source: games/chuko/RULES.md. "Chuko" is a family of 80+ named Kyrgyz
 * astragalus-throwing games, not one fixed game - the source itself warns
 * not to present any single one as "the" official Chuko without saying so.
 *
 * TRADITIONAL RULE (sourced) - Variant A, "throw-and-collect", the
 * best-attested and simplest of the two documented variants:
 * - Chukos are lined up in a row or arranged in a circle.
 * - Players take turns throwing at the arrangement from a distance, trying
 *   to knock pieces out.
 * - A successful hit: the thrower collects the chuko(s) knocked out.
 * - Continues until none remain; whoever collected the most wins.
 *
 * MOBILE PROTOTYPE ADAPTATION (this implementation):
 * - This is explicitly "one variant of chuko" (бул чүкөнүн бир түрү), not
 *   THE chuko game - the RULES.md source itself insists on this framing.
 * - 1 player vs 1 AI, arranged in a small circle (one of the two source-
 *   sanctioned layouts) rather than a long row, for a compact mobile field.
 * - Reuses the same "physics stops at a boundary = captured" mechanic as
 *   Ordo's cluster/circle (shared physics/rules-engine shape - see
 *   ChukoPhysicsWorld.ts) - no khan/no capture-threshold rule, since
 *   Variant A has neither.
 * - No fixed real-world timing found in the source - ends when the circle
 *   is empty or after MAX_TURNS_PER_SIDE turns each, higher collector wins.
 * - Variant B's упай (points-per-face) scoring is NOT implemented - the
 *   source flags it as a secondary/optional mode, and this pass builds
 *   only the primary Variant A.
 */
export const CHUKO_FIELD_RADIUS = 2.2;
export const CHUKO_PIECE_COUNT = 9;
export const MAX_TURNS_PER_SIDE = 8;

export type ChukoDifficulty = 'easy' | 'normal' | 'hard';
export type ChukoDifficultyConfig = { aiAccuracy: number };

export const CHUKO_DIFFICULTY: Record<ChukoDifficulty, ChukoDifficultyConfig> = {
  easy: { aiAccuracy: 0.45 },
  normal: { aiAccuracy: 0.65 },
  hard: { aiAccuracy: 0.85 },
};

export type ChukoResultSummary = {
  playerScore: number;
  aiScore: number;
  winner: ChukoSide | 'draw';
};
