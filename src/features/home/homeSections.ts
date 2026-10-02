import type { AgeExperience } from '@/services/ageExperience/types';

/**
 * Home information hierarchy - ONE architecture for every age:
 *
 *   header
 *   hero      the one primary recommendation ("Continue / Next for you")
 *   culture   Explore OYNO category carousel
 *   today     Daily OYNO
 *   forYou    For You Today - one learning recommendation + weekly goal line
 *   continue  Continue exploring - one region card (continueRegion.ts)
 *   paths     Learning Paths - one active/suggested path
 *   recent    recently explored (light, secondary; real history only)
 *   progress  YOUR PROGRESS - player level/XP + daily play (grouped)
 *   games     PLAY - games teaser
 *   dailyRow  TODAY - daily task + daily gift (one visual family)
 *
 * The first four never move (where am I -> what next -> what to explore ->
 * today). Age only trims or nudges the lower page: children see fewer
 * sections; preteens see progress before games (rewards a little
 * stronger); teens/adults keep rewards last so culture leads.
 */
export type HomeSectionId = 'hero' | 'culture' | 'today' | 'forYou' | 'continue' | 'paths' | 'recent' | 'progress' | 'games' | 'dailyRow';

export const ALL_HOME_SECTIONS: HomeSectionId[] = ['hero', 'culture', 'today', 'forYou', 'continue', 'paths', 'recent', 'progress', 'games', 'dailyRow'];

const HOME_SECTION_ORDER: Record<AgeExperience, HomeSectionId[]> = {
  child: ['hero', 'culture', 'today', 'forYou', 'continue', 'paths', 'games', 'progress', 'dailyRow'],
  preteen: ['hero', 'culture', 'today', 'forYou', 'continue', 'paths', 'recent', 'progress', 'games', 'dailyRow'],
  teen: ['hero', 'culture', 'today', 'forYou', 'continue', 'paths', 'recent', 'games', 'progress', 'dailyRow'],
  adult: ['hero', 'culture', 'today', 'forYou', 'continue', 'paths', 'recent', 'games', 'progress', 'dailyRow'],
};

export function getHomeSectionOrder(experience: AgeExperience): HomeSectionId[] {
  return HOME_SECTION_ORDER[experience];
}
