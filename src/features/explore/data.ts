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
