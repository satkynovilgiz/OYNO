import type { ActivityEvent } from '@/features/notifications/inbox';

import { ACHIEVEMENT_META, buildAchievementsView, enqueueUnlocks } from './achievementsModel';
import { profileAchievements } from './data';

const event = (id: string, at: string): ActivityEvent => ({ id: `achievement:${id}`, type: 'achievement', createdAt: at, params: { achievementId: id } });

describe('achievements view', () => {
  it('groups every real achievement into a category with a real route', () => {
    for (const achievement of profileAchievements) expect(ACHIEVEMENT_META[achievement.id]).toBeDefined();
    const view = buildAchievementsView([], []);
    expect(view.groups.map((g) => g.id)).toEqual(['explore', 'culture', 'games']);
    expect(view.groups.flatMap((g) => g.cards).length).toBe(profileAchievements.length);
    expect(view.earnedCount).toBe(0);
    expect(view.recent).toEqual([]);
  });

  it('marks earned vs locked from the unlocked ids only', () => {
    const view = buildAchievementsView(['first-win'], []);
    const all = view.groups.flatMap((g) => g.cards);
    expect(all.find((c) => c.id === 'first-win')?.earned).toBe(true);
    expect(all.filter((c) => c.earned)).toHaveLength(1);
  });

  it('uses a real unlock date when recorded and never invents one', () => {
    const view = buildAchievementsView(['first-win', 'traveler', 'komuzchu'], [event('traveler', '2026-09-20T10:00:00Z'), event('komuzchu', '2026-09-24T10:00:00Z')]);
    expect(view.recent.map((c) => c.id)).toEqual(['komuzchu', 'traveler', 'first-win']);
    expect(view.recent[2].earnedAt).toBeNull();
    // A recorded event for a locked achievement doesn't make it earned.
    expect(buildAchievementsView([], [event('traveler', '2026-09-20T10:00:00Z')]).earnedCount).toBe(0);
  });

  it('lists earned before locked in a category and flags real completion', () => {
    const culture = buildAchievementsView(['komuzchu'], []).groups.find((g) => g.id === 'culture')!;
    expect(culture.cards.map((c) => c.id)).toEqual(['komuzchu', 'boz-uy-guest']);
    expect(culture.complete).toBe(false);
    expect(buildAchievementsView(['komuzchu', 'boz-uy-guest'], []).groups.find((g) => g.id === 'culture')!.complete).toBe(true);
  });

  it('is stable across renders', () => {
    const a = buildAchievementsView(['traveler', 'first-win'], []);
    const b = buildAchievementsView(['first-win', 'traveler'], []);
    expect(a.recent.map((c) => c.id)).toEqual(b.recent.map((c) => c.id));
  });
});

describe('unlock queue', () => {
  it('queues several unlocks at once instead of dropping all but the last', () => {
    expect(enqueueUnlocks([], ['first-win', 'traveler'])).toEqual(['first-win', 'traveler']);
  });
  it('never re-queues, and loading existing progress queues nothing', () => {
    expect(enqueueUnlocks(['first-win'], ['first-win'])).toEqual(['first-win']);
    expect(enqueueUnlocks([], undefined)).toEqual([]);
    expect(enqueueUnlocks([], [])).toEqual([]);
  });
});

