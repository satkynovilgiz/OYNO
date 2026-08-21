import { getNewlyUnlockedAchievements } from './achievements';
import type { AchievementCheckState } from './types';

const baseState: AchievementCheckState = {
  gamesWon: 0,
  questCompletedCount: 0,
  bozUyVisited: false,
  cultureDiscoveryCount: 0,
};

describe('getNewlyUnlockedAchievements', () => {
  it('returns nothing when no conditions are met', () => {
    expect(getNewlyUnlockedAchievements(baseState, [])).toEqual([]);
  });

  it('unlocks first-win once a game has been won', () => {
    const result = getNewlyUnlockedAchievements({ ...baseState, gamesWon: 1 }, []);
    expect(result).toEqual(['first-win']);
  });

  it('does not re-report an achievement that is already unlocked', () => {
    const result = getNewlyUnlockedAchievements({ ...baseState, gamesWon: 1 }, ['first-win']);
    expect(result).toEqual([]);
  });

  it('can report multiple newly-met conditions at once', () => {
    const result = getNewlyUnlockedAchievements(
      { gamesWon: 1, questCompletedCount: 1, bozUyVisited: true, cultureDiscoveryCount: 1 },
      [],
    );
    expect(result).toEqual(['first-win', 'traveler', 'boz-uy-guest', 'komuzchu']);
  });
});
