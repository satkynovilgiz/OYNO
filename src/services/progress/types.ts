export type AchievementId = 'first-win' | 'traveler' | 'boz-uy-guest' | 'komuzchu';

/** The subset of progress state an achievement condition needs to read. */
export type AchievementCheckState = {
  gamesWon: number;
  questCompletedCount: number;
  bozUyVisited: boolean;
  cultureDiscoveryCount: number;
};

export type AchievementDefinition = {
  id: AchievementId;
  isUnlocked: (state: AchievementCheckState) => boolean;
};
