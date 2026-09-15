import type { GamePhase } from '../../core/gameTypes';

/** Adds a brief non-interactive freeze right after a goal (Section "KOK
 * BORU 1V1": "short pause" before horses/object reset) - the base
 * GamePhase set has nothing for this, same shape as Ordo/Chuko extending
 * it with their own turn-structure phases rather than reusing 1:1. */
export type KokBoruPhase = GamePhase | 'GOAL_PAUSE';

/** Section "KOK BORU — POSSESSION STATE MACHINE": explicit state, not
 * inferred from physics distance every frame. 1v1 only - PLAYER_2/AI_2
 * would be real teams, out of scope here (Section "No teams yet"). */
export type KokBoruPossession = 'FREE' | 'PLAYER' | 'AI';

/**
 * ============================================================
 * SCOPE NOTE (Section "KOK BORU — PHASED DEVELOPMENT")
 * ============================================================
 * Phase A (1 player, 1 horse, object, one goal, no opponent) shipped
 * first, by explicit instruction. This is Phase B: a basic playable 1v1
 * match against a single AI rider - still not the real traditional game
 * (no teams, no real match rules, no foul conditions), and still without
 * the dedicated cultural-research pass `games/kokBoru/RULES.md` would
 * need (Kok Boru has none - see docs/3D_GAMES.md). Two goals (one per
 * side), a simple proximity-based steal, and a 2-minute match clock are a
 * **MOBILE PROTOTYPE ADAPTATION** for a complete, testable match shape,
 * not a claim about real Kok Boru's rules (which are a full team game
 * with no personal "goals" at all in the sense used here).
 */
export const PICKUP_RADIUS_M = 2.0;
/** Slightly larger than pickup - "riding up close enough to snatch it
 * away" reads as a different, more contested action than picking up an
 * unclaimed object (Section 8: "simple steal mechanic when horses are
 * close"). */
export const STEAL_RADIUS_M = 2.6;
export const GOAL_RADIUS_M = 2.8;
export const OBJECT_SPAWN = { x: 0, z: 0 };

/** Two goals at opposite ends of the field, object spawns at midfield -
 * both riders start on their own side of it and converge on the center. */
export const PLAYER_GOAL = { x: 0, z: -38 };
export const PLAYER_START = { x: 0, z: 10 };
export const AI_GOAL = { x: 0, z: 38 };
export const AI_START = { x: 0, z: -10 };

/** Guards against the exact same carry re-triggering a goal (or a steal
 * ping-ponging back and forth) before positions have actually reset -
 * Section "duplicate-goal prevention". */
export const POSSESSION_COOLDOWN_S = 1;
export const GOAL_PAUSE_S = 1.8;
export const MATCH_DURATION_S = 120;

/** Practice never times out and scoring resets the object instead of
 * ending the session (Section "Make Practice... intentionally different")
 * - normal mode is the full 1v1 match built in Phase B. */
export type KokBoruMode = 'practice' | 'normal';

export type KokBoruMatchOutcome = 'WIN' | 'LOSS' | 'DRAW';

export type KokBoruResultSummary = {
  /** Practice-only field, kept for backward compatibility with the
   * existing practice UI - `false` and unused in normal-mode results. */
  scored: boolean;
  elapsedSeconds: number;
  topSpeed: number;
  /** Normal-mode (1v1 match) fields - unused (0/'DRAW') in practice. */
  playerScore: number;
  aiScore: number;
  outcome: KokBoruMatchOutcome;
};
