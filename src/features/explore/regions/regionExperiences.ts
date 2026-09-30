import type { ImageSourcePropType } from 'react-native';

import { discoveryImages } from '@/features/explore/data';

/**
 * Region Hubs - one reusable screen (/explore/region/[id]) driven by these
 * configs. A config holds only IDS of content that already exists and
 * genuinely belongs to the region; names, taglines, photos and progress are
 * resolved from the existing data/stores. Adding a region = adding a config
 * (+ its intro strings), never a new screen.
 */
export type RegionExperienceConfig = {
  /** The region's own explore_regions row (kind 'region'). */
  id: string;
  /** Hero photo (an existing asset). */
  heroImage: ImageSourcePropType | null;
  /** explore_regions ids shown under Places (the region itself first). */
  destinationIds: string[];
  /** discoveries ids - each must have region_id === id in the database. */
  discoveryIds: string[];
  cultureItemIds: string[];
  materialIds: string[];
  /** trailsData ids. */
  trailIds: string[];
  /** Guided quest ids (features/quests/questsData). */
  questIds: string[];
};

/**
 * Issyk-Kul pilot. Linked only to content that genuinely exists and is tied
 * to the region today (audited 2026-09-30): the region destination itself
 * and its one database discovery (`ysyk-kol-shore`, region_id 'ysyk-kol').
 * No culture item, material, trail or guided quest in the app is about
 * Issyk-Kul yet, so those sections stay empty rather than borrowing
 * unrelated content.
 */
export const REGION_EXPERIENCES: Record<string, RegionExperienceConfig> = {
  'ysyk-kol': {
    id: 'ysyk-kol',
    heroImage: discoveryImages['ysyk-kol-shore'] ?? null,
    destinationIds: ['ysyk-kol'],
    discoveryIds: ['ysyk-kol-shore'],
    cultureItemIds: [],
    materialIds: [],
    trailIds: [],
    questIds: [],
  },
};

export function getRegionExperience(id: string | null | undefined): RegionExperienceConfig | null {
  return (id && REGION_EXPERIENCES[id]) || null;
}

export function regionHubRoute(id: string): string {
  return `/explore/region/${id}`;
}
