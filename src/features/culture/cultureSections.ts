import type { AgeExperience } from '@/services/ageExperience/types';

/**
 * Sections CultureScreen can render below its fixed header/hero, in a
 * stable identity independent of on-screen order - same data, same
 * screen, for every age (spec "Make Culture and Explore adapt to
 * AgeExperience... Keep same underlying data"). CultureHero itself stays
 * pinned right under the header for every age (it renders even while
 * categories/materials are still loading, so it can't be part of a
 * loaded-content reorder without changing loading-state behavior).
 */
export type CultureSectionId = 'categories' | 'interactive' | 'bozUy' | 'todayDiscovery' | 'progressQuiz' | 'newMaterials';

export const ALL_CULTURE_SECTIONS: CultureSectionId[] = [
  'categories',
  'interactive',
  'bozUy',
  'todayDiscovery',
  'progressQuiz',
  'newMaterials',
];

/**
 * Section priority per AgeExperience, following the same
 * contentDensity/artworkProminence/characterProminence axes as
 * AGE_EXPERIENCE_CONFIG (Culture/Explore weren't given their own literal
 * per-age bullet list - this mirrors Home's reasoning: hands-on/playful
 * first for child, editorial/curated first for adult):
 * - child: the hands-on creators (interactive, Boz Üy build) lead, before
 *   the denser category grid or quiz/materials.
 * - preteen: category exploration + interactive experiences + today's
 *   discovery lead, progress/quiz still visible but lower.
 * - teen: categories and new materials (exploration) lead.
 * - adult: today's discovery and new materials read as an editorial lead;
 *   the hands-on creator tools (more playful) move toward the end without
 *   ever being hidden.
 */
const CULTURE_SECTION_ORDER: Record<AgeExperience, CultureSectionId[]> = {
  child: ['interactive', 'bozUy', 'categories', 'todayDiscovery', 'progressQuiz', 'newMaterials'],
  preteen: ['categories', 'interactive', 'todayDiscovery', 'progressQuiz', 'bozUy', 'newMaterials'],
  teen: ['categories', 'newMaterials', 'progressQuiz', 'interactive', 'todayDiscovery', 'bozUy'],
  adult: ['todayDiscovery', 'newMaterials', 'categories', 'progressQuiz', 'interactive', 'bozUy'],
};

export function getCultureSectionOrder(experience: AgeExperience): CultureSectionId[] {
  return CULTURE_SECTION_ORDER[experience];
}
