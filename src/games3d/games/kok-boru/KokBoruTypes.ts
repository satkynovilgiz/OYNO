import type { GamePhase } from '../../core/gameTypes';

// Reused as-is - Phase A has no turn structure or settling window to model.
export type KokBoruPhase = GamePhase;

/** Section "KOK BORU — POSSESSION STATE MACHINE": explicit state, not
 * inferred from physics distance every frame. Phase A has no AI, so only
 * FREE/PLAYER exist yet - AI_1/AI_2/PLAYER_2 are Phase B+ (not built). */
export type KokBoruPossession = 'FREE' | 'PLAYER';

/**
 * ============================================================
 * SCOPE NOTE (Section "KOK BORU — PHASED DEVELOPMENT")
 * ============================================================
 * This is PHASE A ONLY, by explicit instruction: "1 player, 1 horse,
 * object, goal. Player can: ride, pick up object, carry, score. Nothing
 * else. Make this work first." No opponent, no stealing, no possession
 * contest, no match timer/score-to-N.
 *
 * Also: unlike the other 4 games, Kok Boru has no `games/kokBoru/RULES.md`
 * from the earlier cultural-research pass (games/RESEARCH_SUMMARY.md only
 * covers the original 9 games + Beshbarmak - Kok Boru is new to this 3D
 * phase). Full traditional rules (team size, real match structure, foul
 * conditions) are UNVERIFIED and need a dedicated research pass before
 * Phase B+ (AI opponent, stealing, real match rules) is built - this
 * scope note stands in for that pass, which hasn't happened yet.
 */
export const PICKUP_RADIUS_M = 2.0;
export const GOAL_RADIUS_M = 2.8;
export const OBJECT_SPAWN = { x: 0, z: 0 };
export const GOAL_POSITION = { x: 0, z: -38 };
export const PLAYER_START = { x: 0, z: 10 };

export type KokBoruResultSummary = {
  scored: boolean;
  elapsedSeconds: number;
  topSpeed: number;
};
