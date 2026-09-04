import type { GamePhase } from '../../core/gameTypes';

export type JaaAtuuPhase = GamePhase;

export type ArrowShot = {
  aimX: number;
  aimY: number;
  power: number;
  /** Ring hit, or null for a total miss (arrow never crossed the target
   * face within its scoring radius). */
  ring: JaaAtuuRingId | null;
  score: number;
  /** World-space hit point relative to target center, for the impact VFX
   * and for computing "best shot" accuracy. */
  hitOffset: { x: number; y: number } | null;
};

/** MOBILE PROTOTYPE ADAPTATION - see docs/GAME_ASSETS.md. Zhaa Atuu has no
 * sourced modern scoring standard (games/zhaaAtuu/RULES.md found only
 * historical technique names, no distances/rings/equipment). These rings
 * are a generic target-archery scoring shape chosen for this prototype, not
 * a claim about traditional Kyrgyz archery rules. */
export type JaaAtuuRingId = 'outer' | 'middle' | 'inner' | 'center';

export const JAA_ATUU_RINGS: { id: JaaAtuuRingId; radius: number; score: number; color: string }[] = [
  { id: 'outer', radius: 1.0, score: 10, color: '#F3E5C9' },
  { id: 'middle', radius: 0.65, score: 25, color: '#B9793A' },
  { id: 'inner', radius: 0.35, score: 50, color: '#E8B93D' },
  { id: 'center', radius: 0.14, score: 100, color: '#D64545' },
];

export const TOTAL_ARROWS = 5;

export type JaaAtuuDifficulty = 'easy' | 'normal' | 'hard';

export type JaaAtuuDifficultyConfig = {
  /** Meters from archer to target. */
  targetDistance: number;
  /** Multiplies the player's raw aim drag before it reaches the ballistics
   * math - >1 means "more forgiving" (a given drag moves the aim point less
   * at the target's distance, in effect enlarging the target). */
  aimAssistScale: number;
};

/** Difficulty changes real gameplay variables (distance, aim assist), never
 * AI/physics cheats - there's no AI in archery, but the same "don't fake
 * it" rule applies to the assist scale. */
export const JAA_ATUU_DIFFICULTY: Record<JaaAtuuDifficulty, JaaAtuuDifficultyConfig> = {
  easy: { targetDistance: 12, aimAssistScale: 1.35 },
  normal: { targetDistance: 18, aimAssistScale: 1.0 },
  hard: { targetDistance: 26, aimAssistScale: 0.75 },
};

export const TARGET_HEIGHT_M = 1.4;
