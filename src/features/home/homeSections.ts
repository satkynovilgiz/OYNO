import type { AgeExperience } from '@/services/ageExperience/types';

/** Every section HomeScreen can render, in a stable identity independent of
 * on-screen order. Kept in one enum-like list so `HOME_SECTION_ORDER` below
 * can be checked (by its own test) to always be a full permutation - Home
 * stays the same single screen for every age, only the order changes. */
export type HomeSectionId = 'hero' | 'today' | 'profile' | 'games' | 'dailyRow' | 'culture' | 'dailyProgress';

export const ALL_HOME_SECTIONS: HomeSectionId[] = ['hero', 'today', 'profile', 'games', 'dailyRow', 'culture', 'dailyProgress'];

/**
 * Section priority per AgeExperience (spec "Make Home adapt to
 * AgeExperience... Section ordering/presentation responds to
 * AgeExperience"):
 * - child: character greeting (hero) + profile, then a big "Continue
 *   Playing" (games) up top, daily mission/reward close behind.
 * - preteen: games/streak/achievements first, then daily challenges and
 *   culture recommendations.
 * - teen: continue playing, challenges, exploration (culture), progress,
 *   recommendations (profile) last.
 * - adult: a featured cultural story leads, then an explore-style
 *   recommendation slot and compact progress; games are available but not
 *   dominant, pushed toward the end.
 *
 * `today` (the Daily OYNO entry card) sits right after each experience's
 * lead section - visible without scrolling far, but never displacing what
 * already leads Home for that age.
 */
const HOME_SECTION_ORDER: Record<AgeExperience, HomeSectionId[]> = {
  child: ['hero', 'today', 'profile', 'games', 'dailyRow', 'culture', 'dailyProgress'],
  preteen: ['games', 'today', 'dailyRow', 'culture', 'profile', 'hero', 'dailyProgress'],
  teen: ['games', 'today', 'dailyRow', 'culture', 'dailyProgress', 'hero', 'profile'],
  adult: ['culture', 'today', 'hero', 'dailyProgress', 'profile', 'games', 'dailyRow'],
};

export function getHomeSectionOrder(experience: AgeExperience): HomeSectionId[] {
  return HOME_SECTION_ORDER[experience];
}
