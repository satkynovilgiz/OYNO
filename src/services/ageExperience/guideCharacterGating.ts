import type { AgeExperienceConfig } from './config';

export type GameIntroPresentation = 'full' | 'condensed' | 'skip';

/**
 * How much a guide character (e.g. Айдана) shows up before a game (spec
 * "Make OYNO guide characters age-aware... prominence adapts... Never
 * remove characters completely for adults"):
 * - primary (child): the host always plays every line, every visit - the
 *   guide actively runs the intro.
 * - frequent (preteen): full the first time a given game is opened, then
 *   steps back on repeat plays of that same game (still shows up fresh
 *   the first time in every other game, so guidance stays "regular").
 * - occasional (teen): a single condensed line the first time only, then
 *   stays out of the way.
 * - subtle (adult): the same single condensed appearance, once - never
 *   fully removed, just minimal and never repeated.
 */
export function resolveGameIntroPresentation(
  characterProminence: AgeExperienceConfig['characterProminence'],
  hasSeenBefore: boolean,
): GameIntroPresentation {
  if (characterProminence === 'primary') return 'full';
  if (hasSeenBefore) return 'skip';
  return characterProminence === 'frequent' ? 'full' : 'condensed';
}
