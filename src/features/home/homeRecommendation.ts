import type { CollectionProgress } from '@/features/collections/collectionProgress';
import type { Collection } from '@/features/collections/collectionsData';
import type { Passport } from '@/features/journey/passport';
import type { TrailProgress } from '@/features/trails/trailProgress';
import type { Trail } from '@/features/trails/trailsData';

/**
 * Home's ONE "Continue Your Journey" recommendation - a pure, deterministic
 * function over progress OYNO already computes (it never calculates trail,
 * collection or passport progress itself - callers pass in the results of
 * computeTrailProgress / computeCollectionProgress / buildPassport). No AI,
 * no engagement weighting.
 *
 * Priority (first match wins):
 *  1. trail      - a Guided Trail already started (>=1 step done) with a
 *                  real next step that has a screen to open.
 *  2. quest      - the active quest, already started and not completed.
 *  3. daily      - today's Daily OYNO, if not completed yet.
 *  4. collection - a Culture Collection in progress (some, not all, done).
 *  5. passport   - Nature Passport started but not complete -> the first
 *                  undiscovered destination.
 *  6. game       - a play-tracked game the user has really played ("play
 *                  again" - OYNO doesn't track game completion, so a game
 *                  is never called unfinished). Most-played first.
 * Nothing active -> "Explore next" (mode 'exploreNext'), deterministic:
 *    the unstarted quest, then the first unvisited nature site, the first
 *    unstarted trail, the first unstarted collection, the first untried
 *    interactive experience, else plain Explore.
 * Everything done -> mode 'complete' (Journey complete -> My Journey).
 *
 * Offline: a candidate is only accepted if `isAvailable(route)` says its
 * screen can open with the data on the device, so Home never sends an
 * offline user into content that can't load when another valid option
 * exists.
 */

export type RecommendationKind = 'trail' | 'quest' | 'daily' | 'collection' | 'passport' | 'game' | 'interactive' | 'explore';

export type RecommendationMode = 'continue' | 'today' | 'exploreNext' | 'complete';

export type HomeRecommendation = {
  mode: RecommendationMode;
  kind: RecommendationKind;
  /** Id of the content the card is about (trail id, collection id, ...). */
  contentId: string | null;
  /** The EXISTING screen the CTA opens. */
  route: string;
  /** Only when measurable. */
  progress: { completed: number; total: number } | null;
  /** Trail: the next step's route target; passport: the destination id. */
  targetId: string | null;
};

export type HomeRecommendationInput = {
  trails: { trail: Trail; progress: TrailProgress; nextRoute: string | null }[];
  quest: { id: string; current: number; total: number; completed: boolean; nextRoute: string | null } | null;
  daily: { itemId: string; isCompleted: boolean } | null;
  collections: { collection: Collection; progress: CollectionProgress }[];
  passport: Passport;
  /** Play-tracked games with a real play count > 0, in games-list order. */
  playedGames: { gameId: string; route: string; played: number }[];
  untriedInteractive: { id: string; route: string }[];
  isAvailable: (route: string) => boolean;
};

export function buildHomeJourneyRecommendation(input: HomeRecommendationInput): HomeRecommendation {
  const ok = (route: string | null | undefined): route is string => !!route && input.isAvailable(route);

  // 1. Active trail
  for (const { trail, progress, nextRoute } of input.trails) {
    if (progress.status === 'inProgress' && progress.nextStep && ok(nextRoute)) {
      return { mode: 'continue', kind: 'trail', contentId: trail.id, route: nextRoute, progress: { completed: progress.completed, total: progress.total }, targetId: progress.nextStep.id };
    }
  }
  // 2. Active quest
  const quest = input.quest;
  if (quest && quest.current > 0 && !quest.completed && ok(quest.nextRoute)) {
    return { mode: 'continue', kind: 'quest', contentId: quest.id, route: quest.nextRoute, progress: { completed: quest.current, total: quest.total }, targetId: null };
  }
  // 3. Today's Daily OYNO
  if (input.daily && !input.daily.isCompleted && ok('/daily')) {
    return { mode: 'today', kind: 'daily', contentId: input.daily.itemId, route: '/daily', progress: null, targetId: null };
  }
  // 4. Collection in progress
  for (const { collection, progress } of input.collections) {
    const route = `/collections/${collection.id}`;
    if (progress.status === 'inProgress' && ok(route)) {
      return { mode: 'continue', kind: 'collection', contentId: collection.id, route, progress: { completed: progress.completed, total: progress.total }, targetId: null };
    }
  }
  // 5. Passport continuation
  const { passport } = input;
  if (passport.unlocked > 0 && !passport.isComplete) {
    const next = passport.stamps.find((stamp) => !stamp.unlocked && ok(stamp.route));
    if (next) {
      return { mode: 'continue', kind: 'passport', contentId: next.id, route: next.route, progress: { completed: passport.unlocked, total: passport.total }, targetId: next.id };
    }
  }
  // 6. Play again (most played; list order breaks ties)
  const played = [...input.playedGames].filter((game) => game.played > 0).sort((a, b) => b.played - a.played);
  const game = played.find((entry) => ok(entry.route));
  if (game) {
    return { mode: 'continue', kind: 'game', contentId: game.gameId, route: game.route, progress: null, targetId: null };
  }

  // Explore next - nothing active.
  if (quest && quest.current === 0 && !quest.completed && ok(quest.nextRoute)) {
    return { mode: 'exploreNext', kind: 'quest', contentId: quest.id, route: quest.nextRoute, progress: { completed: 0, total: quest.total }, targetId: null };
  }
  const place = passport.stamps.find((stamp) => !stamp.unlocked && ok(stamp.route));
  if (place) {
    return { mode: 'exploreNext', kind: 'passport', contentId: place.id, route: place.route, progress: { completed: passport.unlocked, total: passport.total }, targetId: place.id };
  }
  const trail = input.trails.find(({ trail: entry, progress }) => progress.status === 'unstarted' && ok(`/trails/${entry.id}`));
  if (trail) {
    return { mode: 'exploreNext', kind: 'trail', contentId: trail.trail.id, route: `/trails/${trail.trail.id}`, progress: null, targetId: null };
  }
  const collection = input.collections.find(({ collection: entry, progress }) => progress.status === 'unstarted' && ok(`/collections/${entry.id}`));
  if (collection) {
    return { mode: 'exploreNext', kind: 'collection', contentId: collection.collection.id, route: `/collections/${collection.collection.id}`, progress: null, targetId: null };
  }
  const interactive = input.untriedInteractive.find((entry) => ok(entry.route));
  if (interactive) {
    return { mode: 'exploreNext', kind: 'interactive', contentId: interactive.id, route: interactive.route, progress: null, targetId: null };
  }

  const anythingLeft =
    input.trails.some(({ progress }) => progress.status !== 'completed' && progress.status !== 'untracked') ||
    input.collections.some(({ progress }) => progress.status !== 'completed' && progress.status !== 'untracked') ||
    !passport.isComplete;
  if (anythingLeft && ok('/explore')) return { mode: 'exploreNext', kind: 'explore', contentId: null, route: '/explore', progress: null, targetId: null };
  return { mode: 'complete', kind: 'explore', contentId: null, route: '/journey', progress: null, targetId: null };
}

export type RecentEntry = { kind: 'place' | 'daily'; id: string; at: string };

/** "Recently explored": only real, dated local activity - destination
 * visits (user_region_visits.visited_at) and completed Daily OYNO days.
 * Newest first, at most `limit`, each piece of content once. */
export function buildRecentlyExplored(regionVisitDates: Record<string, string>, dailyCompletions: Record<string, string>, limit = 3): RecentEntry[] {
  const entries: RecentEntry[] = [
    ...Object.entries(regionVisitDates).map(([id, at]) => ({ kind: 'place' as const, id, at })),
    // A daily completion is dated by its local day; use noon so ordering
    // against same-day visits stays stable.
    ...Object.entries(dailyCompletions).map(([day, id]) => ({ kind: 'daily' as const, id, at: `${day}T12:00:00` })),
  ];
  const seen = new Set<string>();
  return entries
    .sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0))
    .filter((entry) => {
      const key = `${entry.kind}:${entry.id}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, limit);
}
