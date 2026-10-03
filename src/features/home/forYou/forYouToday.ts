/**
 * For You Today - ONE deterministic learning recommendation for Home. Pure:
 * it only orders candidates the EXISTING selectors already produced
 * (Continue Reading, Learning Path progress, the mistake queue, the
 * glossary review queue, today's challenge). No AI, no randomness, no
 * region bias, no private text (no notes, Journal or highlight excerpts).
 */

export type ForYouReason = 'beginner' | 'continue_reading' | 'continue_learning_path' | 'study_queue' | 'review_mistakes' | 'review_glossary' | 'daily_challenge' | 'start_path' | 'discover';

export type HomeRecommendationCard = {
  reason: ForYouReason;
  /** Public content title (article / path) or null for count-based cards. */
  title: string | null;
  /** Numbers for the copy ("62% read", "3 terms"). */
  count: number | null;
  route: string;
  image: unknown | null;
};

export type ForYouInput = {
  /** True when the person has no learning activity at all yet. */
  isNewUser: boolean;
  unfinishedReading: { title: string; percent: number; route: string; image: unknown | null } | null;
  activePath: { title: string; completed: number; total: number; route: string; image: unknown | null } | null;
  mistakesWaiting: number;
  glossaryWaiting: number;
  dailyChallengeDone: boolean;
  firstUnstartedPath: { title: string; route: string; image: unknown | null } | null;
  beginnerPath: { title: string; route: string; image: unknown | null } | null;
  /** Routes other Home cards already show (the hero, the Learning Paths
   * card) - never shown twice. */
  excludedRoutes: readonly string[];
};

const DAILY_CHALLENGE_ROUTE = '/challenges/daily';
const MISTAKES_ROUTE = '/challenges/review';
const STUDY_QUEUE_ROUTE = '/study';
const GLOSSARY_REVIEW_ROUTE = '/culture/glossary/study?mode=review';
const DISCOVER_ROUTE = '/culture/gallery';

/**
 * Priority (first match wins):
 *  0. brand-new user        -> the beginner Learning Path (curated, not "personal")
 *  1. unfinished explicit activity: reading, then an active Learning Path
 *  2. review waiting: both kinds -> the Study Queue (one place for
 *     several reviews); otherwise challenge mistakes, then glossary terms
 *  3. daily: today's Knowledge Challenge, if not done
 *  4. meaningful new discovery: the first path not started yet
 *  5. fallback: Discover something new (the image gallery)
 */
export function pickForYou(input: ForYouInput): HomeRecommendationCard {
  const candidates: HomeRecommendationCard[] = [];
  if (input.isNewUser && input.beginnerPath) candidates.push({ reason: 'beginner', title: input.beginnerPath.title, count: null, route: input.beginnerPath.route, image: input.beginnerPath.image });
  if (input.unfinishedReading) candidates.push({ reason: 'continue_reading', title: input.unfinishedReading.title, count: input.unfinishedReading.percent, route: input.unfinishedReading.route, image: input.unfinishedReading.image });
  if (input.activePath) candidates.push({ reason: 'continue_learning_path', title: input.activePath.title, count: input.activePath.completed, route: input.activePath.route, image: input.activePath.image });
  if (input.mistakesWaiting > 0 && input.glossaryWaiting > 0) candidates.push({ reason: 'study_queue', title: null, count: input.mistakesWaiting + input.glossaryWaiting, route: STUDY_QUEUE_ROUTE, image: null });
  if (input.mistakesWaiting > 0) candidates.push({ reason: 'review_mistakes', title: null, count: input.mistakesWaiting, route: MISTAKES_ROUTE, image: null });
  if (input.glossaryWaiting > 0) candidates.push({ reason: 'review_glossary', title: null, count: input.glossaryWaiting, route: GLOSSARY_REVIEW_ROUTE, image: null });
  if (!input.dailyChallengeDone) candidates.push({ reason: 'daily_challenge', title: null, count: null, route: DAILY_CHALLENGE_ROUTE, image: null });
  if (input.firstUnstartedPath) candidates.push({ reason: 'start_path', title: input.firstUnstartedPath.title, count: null, route: input.firstUnstartedPath.route, image: input.firstUnstartedPath.image });
  candidates.push({ reason: 'discover', title: null, count: null, route: DISCOVER_ROUTE, image: null });
  const base = (route: string) => route.split('?')[0];
  const excluded = new Set(input.excludedRoutes.map(base));
  return candidates.find((candidate) => !excluded.has(base(candidate.route))) ?? candidates[candidates.length - 1];
}

/** "Not now" hides the card for the rest of the local day only. */
export function isDismissedToday(dismissedOn: string | null | undefined, today: string): boolean {
  return dismissedOn === today;
}
