import type { AchievementCheckState, AchievementDefinition, AchievementId } from './types';

/**
 * Real, checkable conditions only - matches the 4 achievements that already
 * have badge art in the Profile design (badge_first_win, badge_traveler,
 * badge_boz_uy_guest, badge_komuzchu). The wider 50-achievement catalog
 * shown as a total in Profile is not implemented yet; see PROGRESS_AUDIT.md.
 */
export const achievementDefinitions: AchievementDefinition[] = [
  { id: 'first-win', isUnlocked: (s) => s.gamesWon >= 1 },
  { id: 'traveler', isUnlocked: (s) => s.questCompletedCount >= 1 },
  { id: 'boz-uy-guest', isUnlocked: (s) => s.bozUyVisited },
  { id: 'komuzchu', isUnlocked: (s) => s.cultureDiscoveryCount >= 1 },
];

/** Returns achievement ids that should be unlocked given `state` but are not yet in `unlockedIds`. */
export function getNewlyUnlockedAchievements(
  state: AchievementCheckState,
  unlockedIds: AchievementId[],
): AchievementId[] {
  return achievementDefinitions
    .filter((def) => !unlockedIds.includes(def.id) && def.isUnlocked(state))
    .map((def) => def.id);
}
