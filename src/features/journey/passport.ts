import type { ImageSourcePropType } from 'react-native';

import type { SupportedLanguage } from '@/i18n';
import { mapExploreRegionName, type ExploreRegionRow } from '@/services/content/types';

/**
 * Discovery Passport - one stamp per real nature destination
 * (`explore_regions` rows of kind 'nature': son-kol, suusamyr, alay,
 * sary-chelek, arslanbob, ala-too), unlocked ONLY by the existing Explore
 * progress event: `visitExploreRegion`, which the destination detail
 * route already fires and which is recorded server-side in
 * `user_region_visits` (so `visitedRegionIds`). The stamp date is that
 * row's real `visited_at`; when it isn't known the stamp shows no date
 * rather than a guessed one. No separate progress system.
 */

export type PassportStamp = {
  id: string;
  title: string;
  imageSource: ImageSourcePropType | null;
  /** Position among nature rows - the same index the Explore card and the
   * destination detail use for their tone, so the stamp's seal color
   * matches the place everywhere. */
  toneIndex: number;
  unlocked: boolean;
  /** ISO timestamp from `user_region_visits.visited_at`, or null. */
  visitedAt: string | null;
  route: string;
};

export type Passport = {
  stamps: PassportStamp[];
  unlocked: number;
  total: number;
  isComplete: boolean;
};

export function buildPassport(
  regions: ExploreRegionRow[],
  visitedRegionIds: string[],
  regionVisitDates: Record<string, string>,
  imageOf: (regionId: string) => ImageSourcePropType | undefined,
  language: SupportedLanguage,
): Passport {
  const stamps = regions
    .filter((region) => region.kind === 'nature')
    .map((region, index) => {
      const name = mapExploreRegionName(region);
      const unlocked = visitedRegionIds.includes(region.id);
      return {
        id: region.id,
        title: name[language] ?? name.kg,
        imageSource: imageOf(region.id) ?? null,
        toneIndex: index,
        unlocked,
        visitedAt: unlocked ? (regionVisitDates[region.id] ?? null) : null,
        route: `/explore/${region.id}`,
      };
    });

  const unlocked = stamps.filter((stamp) => stamp.unlocked).length;
  return { stamps, unlocked, total: stamps.length, isComplete: stamps.length > 0 && unlocked === stamps.length };
}

/** Stamps unlocked since the passport was last seen - these get the one-time
 * press-in animation + haptic. Pure so the "first unlock" rule is testable. */
export function newlyUnlockedStampIds(passport: Passport, seenIds: string[]): string[] {
  return passport.stamps.filter((stamp) => stamp.unlocked && !seenIds.includes(stamp.id)).map((stamp) => stamp.id);
}
