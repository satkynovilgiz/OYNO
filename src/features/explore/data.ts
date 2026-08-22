/**
 * Region/quest content itself (name, tagline, facts) is now server-driven
 * (Phase 6c, see src/services/content/exploreService.ts) - this file only
 * keeps what's genuinely UI/layout data (map pin coordinates) or still
 * mock (overall exploration progress, never wired to a real per-user
 * count) or already real via Phase 6b (the 4 discoverable items, whose
 * XP rewards are enforced server-side in discover_explore_item).
 */
import { colors } from '@/theme';
import discoveryBeshbarmak from '@assets/img/OYNO_design/explore/discovery_beshbarmak.png';
import discoveryBozUy from '@assets/img/OYNO_design/explore/discovery_boz_uy.png';
import discoveryTooTeke from '@assets/img/OYNO_design/explore/discovery_too_teke.png';
import discoveryYsykKol from '@assets/img/OYNO_design/explore/discovery_ysyk_kol.png';

import type { ExploreDiscovery, ExploreMapPin, ExploreProgress } from './types';

/**
 * Pin tap-target placement on KyrgyzstanMap, measured directly against the
 * pins already painted into map_terrain.png (sliced from the design
 * reference "Explore Kyrgyzstan Learning Map.png") - KyrgyzstanMap renders
 * that art as-is and places an invisible tap target at each of these
 * coordinates rather than drawing a second pin on top. `color`/`variant`
 * aren't consumed by the map right now (nothing to color - the pin is
 * already baked into the art) but are kept as location metadata for when a
 * clean, pin-free map asset exists and MapPin goes back to being rendered.
 */
export const exploreMapPins: ExploreMapPin[] = [
  { locationId: 'talas', xPercent: 24.7, yPercent: 7.7, color: '#2E6E82', variant: 'default' },
  { locationId: 'chuy', xPercent: 44.6, yPercent: 7.4, color: colors.primary, variant: 'default' },
  { locationId: 'bishkek', xPercent: 60.4, yPercent: 12.0, color: '#C0392B', variant: 'landmark' },
  { locationId: 'ysyk-kol', xPercent: 84.9, yPercent: 17.5, color: '#3E8E9E', variant: 'default' },
  { locationId: 'jalal-abad', xPercent: 18.0, yPercent: 44.5, color: colors.primary, variant: 'default' },
  { locationId: 'naryn', xPercent: 60.7, yPercent: 42.7, color: colors.discovery.animals, variant: 'default' },
  { locationId: 'osh', xPercent: 41.8, yPercent: 64.7, color: '#C77B2E', variant: 'landmark' },
  { locationId: 'batken', xPercent: 6.1, yPercent: 73.9, color: colors.discovery.animals, variant: 'default' },
];

/** Mock exploration progress - matches the numbers given in the Explore
 * screen design spec, not wired to real user progress yet. */
export const exploreProgress: ExploreProgress = {
  overallPercent: 37,
  stats: {
    locations: { current: 12, total: 40 },
    nature: { current: 15, total: 30 },
    culture: { current: 20, total: 50 },
    animals: { current: 8, total: 20 },
    food: { current: 7, total: 20 },
    quests: { current: 18, total: 60 },
  },
};

export const exploreDiscoveries: ExploreDiscovery[] = [
  { id: 'ysyk-kol-shore', title: 'Ысык-Көлдүн жээги', category: 'nature', xpReward: 50, imageSource: discoveryYsykKol },
  { id: 'boz-uy', title: 'Боз үй', category: 'culture', xpReward: 60, imageSource: discoveryBozUy },
  { id: 'too-teke', title: 'Тоо теке', category: 'animals', xpReward: 40, imageSource: discoveryTooTeke },
  { id: 'beshbarmak-dish', title: 'Бешбармак', category: 'food', xpReward: 50, imageSource: discoveryBeshbarmak },
];
