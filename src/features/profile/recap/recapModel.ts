import type { AgeExperience } from '@/services/ageExperience/types';

/**
 * My OYNO Recap - a private, all-time summary built ONLY from state the app
 * already keeps. Pure: no network, no article bodies. A metric the app has
 * no real signal for (culture "learned", listening time, monthly history)
 * simply isn't part of the recap.
 */

export type RecapMetricId = 'games' | 'challenges' | 'achievements' | 'journal' | 'saved' | 'daily' | 'places' | 'personalBests';

/** Where a number lives: the signed-in account (server or the existing
 * sync), or only this device. A guest's numbers are always this device. */
export type RecapSource = 'account' | 'device';

export type RecapMetric = { id: RecapMetricId; value: number; source: RecapSource };

export type RecapHighlight =
  | { kind: 'mostPlayed'; gameId: string; plays: number }
  | { kind: 'dailyDays'; count: number };

export type OYNORecap = {
  metrics: RecapMetric[];
  highlights: RecapHighlight[];
  isEmpty: boolean;
};

export type RecapInput = {
  signedIn: boolean;
  /** user_progress.games_played (server for accounts). */
  gamesPlayed: number;
  /** user_game_stats, keyed by progress game id. */
  gameStats: Record<string, { played: number }>;
  /** Deterministic tie-break order for "most played" (the games list). */
  gameOrder: readonly string[];
  /** Knowledge Challenge results (synced for accounts). */
  challengeResults: Record<string, { completedAt: string | null }>;
  achievementsUnlocked: number;
  /** Journal entries that are not deleted (synced for accounts). */
  journalEntries: number;
  /** Favorites (synced for accounts). */
  savedItems: number;
  /** Days with a completed Daily discovery (synced for accounts). */
  dailyDays: number;
  /** Destinations visited (server for accounts). */
  placesVisited: number;
  /** Games with a personal best - Game Records live on this device. */
  personalBests: number;
};

/** "Most played" (never "favourite"): highest real play count; a tie goes
 * to the game listed first. Null when nothing has been played. */
export function mostPlayedGame(gameStats: RecapInput['gameStats'], order: readonly string[]): { gameId: string; plays: number } | null {
  let best: { gameId: string; plays: number } | null = null;
  const rank = (id: string) => {
    const index = order.indexOf(id);
    return index === -1 ? Number.MAX_SAFE_INTEGER : index;
  };
  for (const [gameId, stat] of Object.entries(gameStats)) {
    if (!(stat.played > 0)) continue;
    if (!best || stat.played > best.plays || (stat.played === best.plays && (rank(gameId) < rank(best.gameId) || (rank(gameId) === rank(best.gameId) && gameId < best.gameId)))) {
      best = { gameId, plays: stat.played };
    }
  }
  return best;
}

export function buildOYNORecap(input: RecapInput): OYNORecap {
  const account: RecapSource = input.signedIn ? 'account' : 'device';
  const challenges = Object.values(input.challengeResults).filter((result) => !!result.completedAt).length;
  const all: RecapMetric[] = [
    { id: 'games', value: input.gamesPlayed, source: account },
    { id: 'challenges', value: challenges, source: account },
    { id: 'achievements', value: input.achievementsUnlocked, source: account },
    { id: 'places', value: input.placesVisited, source: account },
    { id: 'daily', value: input.dailyDays, source: account },
    { id: 'journal', value: input.journalEntries, source: account },
    { id: 'saved', value: input.savedItems, source: account },
    { id: 'personalBests', value: input.personalBests, source: 'device' },
  ];
  // Only metrics with something in them - never a wall of zeros.
  const metrics = all.filter((metric) => metric.value > 0);

  const highlights: RecapHighlight[] = [];
  const top = mostPlayedGame(input.gameStats, input.gameOrder);
  if (top) highlights.push({ kind: 'mostPlayed', ...top });
  if (input.dailyDays > 0) highlights.push({ kind: 'dailyDays', count: input.dailyDays });

  return { metrics, highlights: highlights.slice(0, 3), isEmpty: metrics.length === 0 };
}

/** One model, different presentation: which metrics lead, how many show,
 * how big the cards are, how present the avatar is. */
export const RECAP_PRESENTATION: Record<AgeExperience, { order: RecapMetricId[]; maxMetrics: number; cardSize: 'large' | 'standard'; avatar: 'large' | 'small'; highlightsFirst: boolean; editorial: boolean }> = {
  child: { order: ['games', 'achievements', 'places', 'daily', 'challenges', 'saved', 'journal', 'personalBests'], maxMetrics: 4, cardSize: 'large', avatar: 'large', highlightsFirst: false, editorial: false },
  preteen: { order: ['achievements', 'challenges', 'games', 'places', 'daily', 'personalBests', 'saved', 'journal'], maxMetrics: 8, cardSize: 'standard', avatar: 'large', highlightsFirst: false, editorial: false },
  teen: { order: ['games', 'personalBests', 'challenges', 'achievements', 'places', 'daily', 'saved', 'journal'], maxMetrics: 8, cardSize: 'standard', avatar: 'small', highlightsFirst: true, editorial: false },
  adult: { order: ['games', 'challenges', 'achievements', 'places', 'daily', 'journal', 'saved', 'personalBests'], maxMetrics: 8, cardSize: 'standard', avatar: 'small', highlightsFirst: false, editorial: true },
};

export function presentMetrics(recap: OYNORecap, experience: AgeExperience): RecapMetric[] {
  const { order, maxMetrics } = RECAP_PRESENTATION[experience];
  return [...recap.metrics].sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id)).slice(0, maxMetrics);
}

/** The metrics a recap share card may carry - public-style counts only.
 * Journal, saved items and anything account-specific never leave the app. */
export const SHAREABLE_METRICS: readonly RecapMetricId[] = ['games', 'challenges', 'achievements', 'places'];
