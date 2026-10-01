import type { ImageSourcePropType } from 'react-native';

import { discoveryImages, LOCATION_TONES, natureSiteImages } from '@/features/explore/data';
import type { RegionIntroRow, RegionLinkRow, RegionLinkType } from '@/services/content/regionLinksService';

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
  /** Hero photo (an existing asset), or null for the region's tone. */
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
  /** Regional challenge: question-bank ids, each sourced from this region's
   * own linked content (see features/challenges/regionalChallenges.ts).
   * Fewer than 3 valid questions -> no challenge is shown. */
  challengeQuestionIds?: string[];
};

/**
 * Linked ONLY where the content itself says the place/item belongs to the
 * region (audited 2026-09-30 against content/explore/*.md and the database):
 *
 * - Son-Köl: "located within Naryn oblast" (son-kol.md).
 * - Alay: "Osh oblast" (alay.md).
 * - Sary-Chelek, Arslanbob: "Jalal-Abad oblast" (their .md files).
 * - ysyk-kol-shore: region_id 'ysyk-kol' in the database seed.
 * - shyrdak-at-bashy: "Нарын облусундагы Ат-Башы району" in the item's
 *   own origin text (sourced, partially verified).
 *
 * Deliberately NOT linked: Suusamyr (its notes name no oblast), Ala-Too
 * (a range spanning Chüy, Talas and Kazakhstan), the two national trails and
 * the mountain-journey quest (they cross several regions), and generic
 * national culture/games. Bishkek is a separate capital city, "not part of
 * Chüy oblast" (bishkek.md), so it has no Region Hub.
 *
 * Order = north to south, the one order every list of regions uses.
 */
export const REGION_EXPERIENCES: Record<string, RegionExperienceConfig> = {
  chuy: { id: 'chuy', heroImage: null, destinationIds: ['chuy'], discoveryIds: [], cultureItemIds: [], materialIds: [], trailIds: [], questIds: [] },
  talas: { id: 'talas', heroImage: null, destinationIds: ['talas'], discoveryIds: [], cultureItemIds: [], materialIds: [], trailIds: [], questIds: [] },
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
  naryn: {
    id: 'naryn',
    heroImage: natureSiteImages['son-kol'] ?? null,
    destinationIds: ['naryn', 'son-kol'],
    discoveryIds: [],
    cultureItemIds: ['shyrdak-at-bashy'],
    materialIds: [],
    trailIds: [],
    questIds: [],
    challengeQuestionIds: ['naryn-altitude-share', 'naryn-lakes', 'son-kol-altitude'],
  },
  'jalal-abad': {
    id: 'jalal-abad',
    heroImage: natureSiteImages['sary-chelek'] ?? null,
    destinationIds: ['jalal-abad', 'sary-chelek', 'arslanbob'],
    discoveryIds: [],
    cultureItemIds: [],
    materialIds: [],
    trailIds: [],
    questIds: [],
    challengeQuestionIds: ['jalal-abad-springs', 'jalal-abad-reserve', 'arslanbob-old-trees'],
  },
  osh: {
    id: 'osh',
    heroImage: natureSiteImages.alay ?? null,
    destinationIds: ['osh', 'alay'],
    discoveryIds: [],
    cultureItemIds: [],
    materialIds: [],
    trailIds: [],
    questIds: [],
    challengeQuestionIds: ['osh-fergana', 'osh-alai', 'achyk-tash'],
  },
  batken: { id: 'batken', heroImage: null, destinationIds: ['batken'], discoveryIds: [], cultureItemIds: [], materialIds: [], trailIds: [], questIds: [] },
};

export function getRegionExperience(id: string | null | undefined): RegionExperienceConfig | null {
  return (id && REGION_EXPERIENCES[id]) || null;
}

/** All supported regions, in their one fixed order. */
export function listRegionExperiences(): RegionExperienceConfig[] {
  return Object.values(REGION_EXPERIENCES);
}

export function regionHubRoute(id: string): string {
  return `/explore/region/${id}`;
}

/** The region's own fallback tone (distinct per region, stable). */
export function regionTone(id: string): string {
  const index = Object.keys(REGION_EXPERIENCES).indexOf(id);
  return LOCATION_TONES[Math.max(0, index) % LOCATION_TONES.length];
}

/** The one region a destination belongs to, or null when it has no hub or
 * (defensively) is claimed by more than one region. */
export function regionForDestination(destinationId: string, configs: readonly RegionExperienceConfig[] = listRegionExperiences()): RegionExperienceConfig | null {
  const owners = configs.filter((config) => config.destinationIds.includes(destinationId));
  return owners.length === 1 ? owners[0] : null;
}

const LINK_FIELD: Record<RegionLinkType, keyof Pick<RegionExperienceConfig, 'destinationIds' | 'discoveryIds' | 'cultureItemIds' | 'materialIds' | 'trailIds' | 'questIds'>> = {
  destination: 'destinationIds',
  discovery: 'discoveryIds',
  culture_item: 'cultureItemIds',
  culture_material: 'materialIds',
  trail: 'trailIds',
  quest: 'questIds',
};

/**
 * The ONE resolved region model: the built-in configs, with a region's
 * relationships replaced by the editor-curated rows (region_content_links)
 * when that region has any. Product rules - supported ids, order, tone,
 * hero, challenge pack - always come from the code. The region's own place
 * is always kept first. Screens never know which source was used.
 */
export function resolveRegionExperiences(links: readonly RegionLinkRow[] | undefined, base: readonly RegionExperienceConfig[] = listRegionExperiences()): RegionExperienceConfig[] {
  if (!links || links.length === 0) return [...base];
  return base.map((config) => {
    const rows = links.filter((row) => row.region_id === config.id && row.content_type in LINK_FIELD);
    if (rows.length === 0) return config;
    const byType = (type: RegionLinkType) =>
      [...new Set(rows.filter((row) => row.content_type === type).sort((a, b) => a.sort_order - b.sort_order || a.content_id.localeCompare(b.content_id)).map((row) => row.content_id))];
    const destinations = byType('destination').filter((id) => id !== config.id);
    return {
      ...config,
      destinationIds: [config.id, ...destinations],
      discoveryIds: byType('discovery'),
      cultureItemIds: byType('culture_item'),
      materialIds: byType('culture_material'),
      trailIds: byType('trail'),
      questIds: byType('quest'),
    };
  });
}

/** A saved editorial intro for this language, if any (else the app string). */
export function regionIntroOverride(intros: readonly RegionIntroRow[] | undefined, regionId: string, language: string): string | null {
  return intros?.find((row) => row.region_id === regionId && row.language === language)?.intro?.trim() || null;
}

/** A photo that is genuinely of the region itself (its discovery's photo),
 * for the region's own place card - never a member place's photo reused. */
export function regionOwnImage(config: RegionExperienceConfig): ImageSourcePropType | null {
  for (const id of config.discoveryIds) if (discoveryImages[id]) return discoveryImages[id];
  return null;
}
