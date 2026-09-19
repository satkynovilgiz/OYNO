import badgeBozUyGuest from '@assets/img/OYNO_design/profile/achievement_boz_uy_guest.png';
import badgeFirstWin from '@assets/img/OYNO_design/profile/achievement_first_win.png';
import badgeKomuzchu from '@assets/img/OYNO_design/profile/achievement_komuz.png';
import badgeTraveler from '@assets/img/OYNO_design/profile/achievement_explorer.png';

import { discoveryImages } from '@/features/explore/data';
import type { SupportedLanguage } from '@/i18n';
import type { DiscoveryRow } from '@/services/content/types';
import { mapDiscoveryTitle } from '@/services/content/types';
import { colors } from '@/theme';

import type { ProfileAchievement, ProfileCollectionItem } from './types';

/**
 * Content catalog for the Profile screen (badge art, collection thumbnails)
 * - matches the design reference ("Kyrgyz Folk Profile Dashboard.png").
 * Real per-user numbers (xp, coins, unlocked achievements, favorite games,
 * daily activity) come from useProgressStore instead; see ProfileScreen.
 */
/** `requirementKey` mirrors the real predicate in
 * src/services/progress/achievements.ts exactly (gamesWon >= 1,
 * questCompletedCount >= 1, bozUyVisited, cultureDiscoveryCount >= 1) -
 * shown only for locked achievements, never an invented requirement. */
export const profileAchievements: ProfileAchievement[] = [
  { id: 'first-win', title: 'Биринчи жеңиш', iconSource: badgeFirstWin, requirementKey: 'profile.achievements.requirements.firstWin' },
  { id: 'traveler', title: 'Саякатчы', iconSource: badgeTraveler, requirementKey: 'profile.achievements.requirements.traveler' },
  { id: 'boz-uy-guest', title: 'Боз үйдүн коногу', iconSource: badgeBozUyGuest, requirementKey: 'profile.achievements.requirements.bozUyGuest' },
  { id: 'komuzchu', title: 'Комузчу', iconSource: badgeKomuzchu, requirementKey: 'profile.achievements.requirements.komuzchu' },
];
/** The real catalog size - was hardcoded to 50 (the design spec's eventual
 * full catalog, never built) which made the Achievements screen show a
 * permanently-stuck-at-8%-looking progress bar toward achievements that
 * don't exist. Computed from the array above so it can't drift out of sync
 * with it again. */
export const achievementsTotal = profileAchievements.length;

export function getAchievement(id: string): ProfileAchievement | undefined {
  return profileAchievements.find((achievement) => achievement.id === id);
}

/**
 * The Collection screen used to show 6 hardcoded categories (Комуз,
 * Боз үй буюмдары, Оймо, ...) with invented current/total counts - none of
 * that catalog exists server-side. Rather than keep presenting fabricated
 * numbers, this reuses the real, server-driven discoveries table (the same
 * data Explore's LocationDetailScreen/DiscoveriesRow render) so every
 * number here is real, just narrower in scope than the eventual full
 * collection. Widen this once Culture's own discoverable items (komuz
 * melodies, boz-uy items, etc.) are real.
 */
export function getCollectionItems(
  discoveries: DiscoveryRow[],
  discoveredExploreIds: string[],
  language: SupportedLanguage,
): ProfileCollectionItem[] {
  return discoveries.map((discovery) => ({
    id: discovery.id,
    title: mapDiscoveryTitle(discovery)[language] ?? discovery.title_kg,
    color: colors.discovery[discovery.category],
    imageSource: discoveryImages[discovery.id],
    current: discoveredExploreIds.includes(discovery.id) ? 1 : 0,
    total: 1,
  }));
}

export function getCollectionCounts(discoveries: DiscoveryRow[], discoveredExploreIds: string[]): { unlocked: number; total: number } {
  const total = discoveries.length;
  const unlocked = discoveries.filter((discovery) => discoveredExploreIds.includes(discovery.id)).length;
  return { unlocked, total };
}
