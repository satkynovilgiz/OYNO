import type { AgeExperience } from '@/services/ageExperience/types';

/** Every reorderable section below the fixed identity block (header, hero,
 * currency) - those three stay put since they're the page's own anchor,
 * not content to shuffle. Kept in one list so `PROFILE_SECTION_ORDER`
 * below can be checked (by its own test) to always be a full permutation -
 * Profile stays the same single screen for every age, only the order and
 * presentation change (spec "Do not duplicate ProfileScreen"). */
export type ProfileSectionId = 'journey' | 'achievements' | 'favorites' | 'collection' | 'daily';

export const ALL_PROFILE_SECTIONS: ProfileSectionId[] = ['journey', 'achievements', 'favorites', 'collection', 'daily'];

/**
 * Section priority per AgeExperience (spec "Task 5... Age adaptation"):
 * - child: achievements + rewards up top ("avatar + achievements
 *   prominent... rewards more visible"), journey/collection follow.
 * - preteen: collections and the daily reward lead ("collections/
 *   rewards"), achievements/journey pushed later.
 * - teen: cultural journey (progress) and achievements lead ("identity +
 *   progress + achievements" - identity itself lives in the fixed hero
 *   above), collection/daily follow.
 * - adult: cultural journey leads and saved content (favorites/
 *   collection) follows ("cultural journey + saved content"), with
 *   achievements/daily-reward gamification pushed to the end ("quieter
 *   gamification").
 */
const PROFILE_SECTION_ORDER: Record<AgeExperience, ProfileSectionId[]> = {
  child: ['achievements', 'daily', 'journey', 'favorites', 'collection'],
  preteen: ['collection', 'daily', 'favorites', 'journey', 'achievements'],
  teen: ['journey', 'achievements', 'favorites', 'collection', 'daily'],
  adult: ['journey', 'favorites', 'collection', 'daily', 'achievements'],
};

export function getProfileSectionOrder(experience: AgeExperience): ProfileSectionId[] {
  return PROFILE_SECTION_ORDER[experience];
}
