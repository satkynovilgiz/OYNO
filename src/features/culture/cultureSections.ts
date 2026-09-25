import type { AgeExperience } from '@/services/ageExperience/types';

/**
 * Culture landing hierarchy - ONE architecture for every age:
 *
 *   header      editorial header (eyebrow, title, subtitle, Search)
 *   featured    the day's cultural story (pinned; a real curated collection)
 *   then, reordered by age (never added/removed):
 *
 *   categories      every Culture category (real routes, real item counts)
 *   collections     curated collections with real completed / total
 *   continue        in-progress collections + real Daily history
 *   listen          bundled komuz audio
 *   todayDiscovery  today's culture material
 *   learn           quiz + knowledge challenges
 *   interactive     hands-on creators (oymo, shyrdak, boz uy...)
 *   bozUy           enter the Boz Uy
 *   newMaterials    new materials rail
 *
 * Child: hands-on first. Preteen: categories + collections (visual
 * storytelling). Teen: modern editorial browsing. Adult: curated
 * long-form collections and continue-reading first.
 */
export type CultureSectionId = 'categories' | 'collections' | 'continue' | 'listen' | 'todayDiscovery' | 'learn' | 'interactive' | 'bozUy' | 'newMaterials';

export const ALL_CULTURE_SECTIONS: CultureSectionId[] = ['categories', 'collections', 'continue', 'listen', 'todayDiscovery', 'learn', 'interactive', 'bozUy', 'newMaterials'];

const CULTURE_SECTION_ORDER: Record<AgeExperience, CultureSectionId[]> = {
  child: ['interactive', 'categories', 'bozUy', 'continue', 'learn', 'collections', 'listen', 'todayDiscovery', 'newMaterials'],
  preteen: ['categories', 'collections', 'interactive', 'continue', 'todayDiscovery', 'learn', 'listen', 'bozUy', 'newMaterials'],
  teen: ['categories', 'collections', 'continue', 'newMaterials', 'listen', 'learn', 'interactive', 'todayDiscovery', 'bozUy'],
  adult: ['collections', 'continue', 'categories', 'newMaterials', 'listen', 'todayDiscovery', 'learn', 'interactive', 'bozUy'],
};

export function getCultureSectionOrder(experience: AgeExperience): CultureSectionId[] {
  return CULTURE_SECTION_ORDER[experience];
}
