import type { AgeExperience } from '@/services/ageExperience/types';

/** Every reorderable section below the fixed identity block (top bar +
 * identity card) - that block stays put as the page's anchor. Daily
 * task/gift live on Home (one place to claim them). Kept in one list so `PROFILE_SECTION_ORDER`
 * below can be checked (by its own test) to always be a full permutation -
 * Profile stays the same single screen for every age, only the order and
 * presentation change (spec "Do not duplicate ProfileScreen"). */
export type ProfileSectionId = 'journey' | 'achievements' | 'favorites' | 'collection';

export const ALL_PROFILE_SECTIONS: ProfileSectionId[] = ['journey', 'achievements', 'favorites', 'collection'];

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
  child: ['achievements', 'journey', 'collection', 'favorites'],
  preteen: ['collection', 'journey', 'achievements', 'favorites'],
  teen: ['journey', 'achievements', 'favorites', 'collection'],
  adult: ['journey', 'favorites', 'collection', 'achievements'],
};

export function getProfileSectionOrder(experience: AgeExperience): ProfileSectionId[] {
  return PROFILE_SECTION_ORDER[experience];
}
