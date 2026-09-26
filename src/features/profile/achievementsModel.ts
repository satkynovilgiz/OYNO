import type { ActivityEvent } from '@/features/notifications/inbox';

import { profileAchievements } from './data';
import type { ProfileAchievement } from './types';

/**
 * Achievements hub as data. The catalog, the unlock rules (server-side
 * `check_achievements`, mirrored in services/progress/achievements.ts) and
 * the unlocked ids are the single source of truth - this only groups and
 * orders them for display. Every current achievement is a single-step
 * condition (">= 1"), so there is no partial progress to show: an
 * achievement is either earned or locked (never a fake "in progress").
 */
export type AchievementCategory = 'explore' | 'culture' | 'games';

/** Category + the one real place to go to earn it. */
export const ACHIEVEMENT_META: Record<string, { category: AchievementCategory; route: string }> = {
  'first-win': { category: 'games', route: '/games' },
  traveler: { category: 'explore', route: '/explore' },
  'boz-uy-guest': { category: 'culture', route: '/culture/boz-uy/build' },
  komuzchu: { category: 'culture', route: '/daily' },
};

const CATEGORY_ORDER: AchievementCategory[] = ['explore', 'culture', 'games'];

export type AchievementCard = ProfileAchievement & {
  earned: boolean;
  /** Real unlock time when this device recorded it (activity log); null
   * for older unlocks - no date is ever invented. */
  earnedAt: string | null;
  category: AchievementCategory;
  route: string;
};

export type AchievementsView = {
  total: number;
  earnedCount: number;
  /** Earned, newest real date first; undated ones after, in catalog order. */
  recent: AchievementCard[];
  groups: { id: AchievementCategory; cards: AchievementCard[]; complete: boolean }[];
};

export function buildAchievementsView(unlockedIds: string[], events: ActivityEvent[], catalog: ProfileAchievement[] = profileAchievements): AchievementsView {
  const earnedAt = new Map(events.filter((event) => event.type === 'achievement').map((event) => [String(event.params.achievementId), event.createdAt]));
  const cards: AchievementCard[] = catalog.map((achievement) => {
    const meta = ACHIEVEMENT_META[achievement.id] ?? { category: 'culture' as const, route: '/home' };
    const earned = unlockedIds.includes(achievement.id);
    return { ...achievement, earned, earnedAt: earned ? (earnedAt.get(achievement.id) ?? null) : null, category: meta.category, route: meta.route };
  });
  const catalogIndex = (id: string) => catalog.findIndex((achievement) => achievement.id === id);
  const recent = cards
    .filter((card) => card.earned)
    .sort((a, b) => {
      if (a.earnedAt && b.earnedAt) return b.earnedAt.localeCompare(a.earnedAt);
      if (a.earnedAt) return -1;
      if (b.earnedAt) return 1;
      return catalogIndex(a.id) - catalogIndex(b.id);
    });
  const groups = CATEGORY_ORDER.map((id) => {
    // Earned first, then locked; catalog order inside each - stable.
    const inCategory = cards.filter((card) => card.category === id).sort((a, b) => Number(b.earned) - Number(a.earned) || catalogIndex(a.id) - catalogIndex(b.id));
    return { id, cards: inCategory, complete: inCategory.length > 0 && inCategory.every((card) => card.earned) };
  }).filter((group) => group.cards.length > 0);
  return { total: cards.length, earnedCount: recent.length, recent, groups };
}

export { enqueueUnlocks } from '@/services/progress/unlockQueue';
