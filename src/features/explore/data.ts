/**
 * Region/quest/discovery content itself is now fully server-driven
 * (explore_regions, quests, discoveries - see src/services/content/) -
 * this file only keeps genuine UI/layout data: map pin coordinates, and a
 * bundled-image fallback keyed by discovery id (a discovery row has no
 * image_url column yet, same "require() needs a static path" reasoning
 * as cultureItemImages in features/culture/data.ts).
 */
import type { ImageSourcePropType } from 'react-native';

import { colors } from '@/theme';
import discoveryBeshbarmak from '@assets/img/OYNO_design/explore/discovery_beshbarmak.png';
import discoveryBozUy from '@assets/img/OYNO_design/explore/discovery_boz_uy.png';
import discoveryTooTeke from '@assets/img/OYNO_design/explore/discovery_too_teke.png';
import discoveryYsykKol from '@assets/img/OYNO_design/explore/discovery_ysyk_kol.png';
import natureAlaToo from '@assets/img/OYNO_design/explore/nature/ala_too.jpg';
import natureAlay from '@assets/img/OYNO_design/explore/nature/alay.jpg';
import natureArslanbob from '@assets/img/OYNO_design/explore/nature/arslanbob.jpg';
import natureSaryChelek from '@assets/img/OYNO_design/explore/nature/sary_chelek.jpg';
import natureSonKol from '@assets/img/OYNO_design/explore/nature/son_kol.jpg';
import natureSuusamyr from '@assets/img/OYNO_design/explore/nature/suusamyr.jpg';
import questBoruGoldenValley from '@assets/img/OYNO_design/explore/quest_boru_golden_valley.jpg';
import questBoruShyrdak from '@assets/img/OYNO_design/explore/quest_boru_shyrdak.png';

import type { ExploreMapPin } from './types';

/**
 * Pin tap-target placement on KyrgyzstanMap, measured directly against the
 * pins already painted into map_terrain.png (sliced from the design
 * reference "Illustrated Kyrgyzstan Adventure Map.png") - KyrgyzstanMap
 * renders that art as-is and places an invisible tap target at each of
 * these coordinates rather than drawing a second pin on top. `color`/
 * `variant` aren't consumed by the map right now (nothing to color - the
 * pin is already baked into the art) but are kept as location metadata for
 * when a clean, pin-free map asset exists and MapPin goes back to being
 * rendered.
 */
export const exploreMapPins: ExploreMapPin[] = [
  { locationId: 'talas', xPercent: 35.1, yPercent: 14.9, color: '#2E6E82', variant: 'default' },
  { locationId: 'chuy', xPercent: 54.3, yPercent: 14.9, color: colors.primary, variant: 'default' },
  { locationId: 'bishkek', xPercent: 69.5, yPercent: 18.3, color: '#C0392B', variant: 'landmark' },
  { locationId: 'ysyk-kol', xPercent: 89.2, yPercent: 23.7, color: '#3E8E9E', variant: 'default' },
  { locationId: 'jalal-abad', xPercent: 33.0, yPercent: 48.1, color: colors.primary, variant: 'default' },
  { locationId: 'naryn', xPercent: 68.1, yPercent: 48.0, color: colors.discovery.animals, variant: 'default' },
  { locationId: 'osh', xPercent: 49.3, yPercent: 66.3, color: '#C77B2E', variant: 'landmark' },
  { locationId: 'batken', xPercent: 17.1, yPercent: 76.8, color: colors.discovery.animals, variant: 'default' },
];

export const discoveryImages: Record<string, ImageSourcePropType> = {
  'ysyk-kol-shore': discoveryYsykKol,
  'boz-uy': discoveryBozUy,
  'too-teke': discoveryTooTeke,
  'beshbarmak-dish': discoveryBeshbarmak,
};

/** Real photography per nature destination (`explore_regions.id`, kind
 * 'nature') - the single mapping shared by the Explore "Nature sites" cards
 * and the destination detail hero, so card -> detail keeps one visual
 * identity. A site missing here falls back to its designed tone card
 * rather than a generic stand-in photo. */
export const natureSiteImages: Record<string, ImageSourcePropType> = {
  'son-kol': natureSonKol,
  suusamyr: natureSuusamyr,
  alay: natureAlay,
  'sary-chelek': natureSaryChelek,
  arslanbob: natureArslanbob,
  'ala-too': natureAlaToo,
};

/** Flat tones for a location with no photo, indexed by its position among
 * locations of the same kind - the Nature card fallback and the detail
 * hero fallback read the same list, so a photo-less destination keeps the
 * same color from card to detail. */
export const LOCATION_TONES = [colors.tiles.culture, colors.tiles.food, colors.tiles.music, colors.tiles.map];

/** Background artwork per quest, keyed by `quests.id` - same bundled-image
 * lookup reasoning as `discoveryImages` above (a quest row has no image
 * column). Quests without their own entry keep the original generic
 * Börü/shyrdak banner. */
export const questBackgroundImages: Record<string, ImageSourcePropType> = {
  'lost-shyrdak': questBoruGoldenValley,
};

export function questBackgroundFor(questId: string): ImageSourcePropType {
  return questBackgroundImages[questId] ?? questBoruShyrdak;
}
