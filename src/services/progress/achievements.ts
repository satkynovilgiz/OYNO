import type { AchievementCheckState, AchievementDefinition, AchievementId } from './types';

/**
 * Real, checkable conditions only - matches the 4 achievements that already
 * have badge art in the Profile design (badge_first_win, badge_traveler,
 * badge_boz_uy_guest, badge_komuzchu). Profile's `achievementsTotal` is
 * derived from this same list (src/features/profile/data.ts), not a fixed
 * larger catalog size - it grows only when a new achievement with a real,
 * checkable condition is added here.
 *
 * As of Phase 6b, `useProgressStore` no longer calls this directly - the
 * authoritative check now happens server-side in Postgres
 * (`public.check_achievements`, supabase/migrations/20260823000001_progress.sql),
 * since achievement unlocks must be tamper-proof. This file is kept as a
 * tested, readable spec of the same rules for reference; if the two ever
 * need to change, change both and keep them matching.
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
