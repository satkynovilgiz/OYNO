import { computeThrowAim, type ThrowAim } from '../../ai/computeThrowAim';
import type { OrdoDifficultyConfig } from './OrdoTypes';

export type OrdoAiThrow = ThrowAim;

/** Thin re-export - see computeThrowAim.ts for the shared "honest AI" logic
 * Ordo and Chuko both use. */
export function computeAiThrow(config: OrdoDifficultyConfig): OrdoAiThrow {
  return computeThrowAim(config);
}
