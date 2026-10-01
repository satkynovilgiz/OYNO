import { useEffect, useMemo } from 'react';

import { mockGamesList } from '@/features/games/mockData';
import { progressGameIdFor } from '@/features/games/progressGameIds';
import { useGameRecords, useRecordsOwner } from '@/features/games/records/useGameRecords';
import { visibleEntries } from '@/features/journal/journalModel';
import { useChallengeStore } from '@/store/useChallengeStore';
import { useDailyDiscoveryStore } from '@/store/useDailyDiscoveryStore';
import { useFavoritesStore } from '@/store/useFavoritesStore';
import { useJournalStore } from '@/store/useJournalStore';
import { useProgressStore } from '@/store/useProgressStore';

import { buildOYNORecap, type OYNORecap } from './recapModel';

/**
 * The current person's recap - or null while the numbers in memory might
 * still belong to someone else (right after an account change the
 * progress store reloads; until it has loaded FOR this owner nothing is
 * shown, so account B never sees account A's recap, not even briefly).
 */
export function useOYNORecap(): { recap: OYNORecap | null; signedIn: boolean } {
  const owner = useRecordsOwner();
  const signedIn = owner !== 'guest';
  const progress = useProgressStore();
  const challengeResults = useChallengeStore((state) => state.results);
  const journal = useJournalStore((state) => state.entries);
  const favorites = useFavoritesStore((state) => state.favoriteIds);
  const daily = useDailyDiscoveryStore((state) => state.completions);
  const { records } = useGameRecords();

  useEffect(() => {
    if (!useJournalStore.getState().isLoaded) void useJournalStore.getState().load();
  }, []);

  const ready = progress.isLoaded && progress.loadedOwner === owner;
  const recap = useMemo(() => {
    if (!ready) return null;
    return buildOYNORecap({
      signedIn,
      gamesPlayed: progress.gamesPlayed,
      gameStats: progress.gameStats,
      gameOrder: mockGamesList.map((game) => progressGameIdFor(game.id)),
      challengeResults,
      achievementsUnlocked: progress.unlockedAchievementIds.length,
      journalEntries: visibleEntries(journal).length,
      savedItems: favorites.length,
      dailyDays: Object.keys(daily).length,
      placesVisited: progress.visitedRegionIds.length,
      personalBests: Object.keys(records.best).length,
    });
  }, [ready, signedIn, progress.gamesPlayed, progress.gameStats, progress.unlockedAchievementIds, progress.visitedRegionIds, challengeResults, journal, favorites, daily, records.best]);

  return { recap, signedIn };
}
