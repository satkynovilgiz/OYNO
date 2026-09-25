import type { AgeExperience } from '@/services/ageExperience/types';

/**
 * Explore information hierarchy - ONE architecture for every age:
 *
 *   header   eyebrow, title, subtitle, Search + Collection
 *   map      live map preview + real visited count + Open map (pinned)
 *   then the sections below, reordered (never added/removed) by age:
 *
 *   featured     today's destination (deterministic rotation)
 *   nature       the other nature destinations (rail)
 *   recent       real visit history (only when there is some)
 *   passport     Discovery Passport summary (real stamps / total)
 *   trails       Guided Trails with real progress
 *   discoveries  collectible discoveries (existing collection)
 *   quest        the current quest
 *
 * Child: featured + quest (a simple, character-led goal) first.
 * Preteen: passport/discoveries (collectibles, progress) lead after featured.
 * Teen: photo-first - destinations, recent, trails.
 * Adult: editorial - destinations and curated trails, gamified quest last.
 */
export type ExploreSectionId = 'featured' | 'nature' | 'recent' | 'passport' | 'trails' | 'discoveries' | 'quest';

export const ALL_EXPLORE_SECTIONS: ExploreSectionId[] = ['featured', 'nature', 'recent', 'passport', 'trails', 'discoveries', 'quest'];

const EXPLORE_SECTION_ORDER: Record<AgeExperience, ExploreSectionId[]> = {
  child: ['featured', 'quest', 'nature', 'discoveries', 'passport', 'trails', 'recent'],
  preteen: ['featured', 'passport', 'discoveries', 'quest', 'nature', 'trails', 'recent'],
  teen: ['featured', 'nature', 'recent', 'trails', 'passport', 'discoveries', 'quest'],
  adult: ['featured', 'nature', 'trails', 'recent', 'passport', 'discoveries', 'quest'],
};

export function getExploreSectionOrder(experience: AgeExperience): ExploreSectionId[] {
  return EXPLORE_SECTION_ORDER[experience];
}

/** The day's featured destination: a stable daily rotation over the real
 * destination list (same day -> same place for everyone; no randomness). */
export function pickFeaturedDestination<T>(sites: T[], day: number): T | null {
  if (sites.length === 0) return null;
  const index = ((day % sites.length) + sites.length) % sites.length;
  return sites[index];
}
