import type { AgeExperience } from '@/services/ageExperience/types';

/**
 * Sections ExploreScreen can render below its fixed header/map, in a
 * stable identity independent of on-screen order - same regions/quest/
 * discoveries data, same screen, for every age (spec "Make Culture and
 * Explore adapt to AgeExperience... Keep same underlying data"). The map
 * (plus its own filtered-results list, shown only while a filter is
 * active) stays pinned right under the header for every age, since it's
 * the screen's primary navigation surface and carries its own filter
 * state that shouldn't be reordered away from what it filters.
 */
export type ExploreSectionId = 'progress' | 'quest' | 'natureSites' | 'discoveries';

export const ALL_EXPLORE_SECTIONS: ExploreSectionId[] = ['progress', 'quest', 'natureSites', 'discoveries'];

/**
 * Section priority per AgeExperience, following the same axes as
 * AGE_EXPERIENCE_CONFIG (no separate literal per-age bullet list was given
 * for Explore - mirrors Home/Culture's reasoning):
 * - child: the guided quest (a simple, character-led objective) leads,
 *   then collectible discoveries (obvious rewards), progress stats last.
 * - preteen: quest and discoveries (achievements/rewards) lead, nature
 *   sites and progress follow.
 * - teen: nature sites (exploration) and discoveries lead, progress and
 *   quest follow.
 * - adult: nature sites and discoveries read as curated recommendations
 *   first; the fetch-quest (more gamified) moves toward the end without
 *   ever being hidden.
 */
const EXPLORE_SECTION_ORDER: Record<AgeExperience, ExploreSectionId[]> = {
  child: ['quest', 'discoveries', 'natureSites', 'progress'],
  preteen: ['discoveries', 'quest', 'natureSites', 'progress'],
  teen: ['natureSites', 'discoveries', 'quest', 'progress'],
  adult: ['natureSites', 'discoveries', 'progress', 'quest'],
};

export function getExploreSectionOrder(experience: AgeExperience): ExploreSectionId[] {
  return EXPLORE_SECTION_ORDER[experience];
}
