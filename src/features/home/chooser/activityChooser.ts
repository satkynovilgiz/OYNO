/**
 * "What can I do in N minutes?" - a pure, deterministic chooser over REAL
 * OYNO activities. It extends Home's recommendations: the same signals
 * (offline route availability, interactive-lab completion, Learning Path
 * progress, Daily OYNO, game play counts) feed it, and nothing is sent
 * anywhere - the time/interest choice stays on the device and is not even
 * stored.
 *
 * Minutes are ESTIMATES. Each activity names its basis (`basis`, shown in
 * docs/ACTIVITY_CHOOSER.md and as the card's small print): the activity's
 * own fixed size - questions, arrows, match length, steps, track lengths -
 * at a relaxed pace.
 *
 * Selection rules (in order):
 *  1. Only the chosen interest.
 *  2. Only activities whose estimate fits the time chosen.
 *  3. Offline: only activities whose screen can open with the data on the
 *     device (isRouteAvailableOffline - the Home recommendation's own check).
 *  4. Finished one-time learning (today's Daily once done, a completed
 *     komuz lesson, completed Learning Path steps) is never suggested;
 *     practice, play and creative activities stay, after untried ones.
 *  5. Order: the next step of a Learning Path you have started, then
 *     activities you have not tried, then the rest; within each, the
 *     estimate that uses more of the chosen time, then catalogue order.
 *  6. Three at a time; "Show others" pages through the rest, then wraps.
 */

export type Interest = 'discover' | 'play' | 'create' | 'listen';
export const INTERESTS: Interest[] = ['discover', 'play', 'create', 'listen'];
export type TimeBudget = 2 | 5 | 10;
export const TIME_BUDGETS: TimeBudget[] = [2, 5, 10];
export const PAGE_SIZE = 3;

/** How a finished activity is treated. */
export type Repeat =
  /** Practice / play / create: fine to do again (ranked after untried). */
  | 'repeatable'
  /** Done once per day (Daily OYNO). */
  | 'daily'
  /** A one-time lesson: once completed it is not suggested. */
  | 'once';

export type Activity = {
  id: string;
  interest: Interest;
  /** Estimated minutes (see `basis`). */
  minutes: number;
  /** i18n key under activityChooser.basis - why this estimate. */
  basis: string;
  route: string;
  repeat: Repeat;
  /** Needs 2-4 people on one phone. */
  together?: boolean;
  /** Title/description keys; dynamic activities carry a resolved title instead. */
  titleKey?: string;
  title?: string;
  descriptionKey: string;
};

export const ACTIVITY_CATALOG: Activity[] = [
  // Discover
  { id: 'daily', interest: 'discover', minutes: 3, basis: 'oneArticle', route: '/daily', repeat: 'daily', titleKey: 'activityChooser.items.daily.title', descriptionKey: 'activityChooser.items.daily.description' },
  { id: 'detective', interest: 'discover', minutes: 3, basis: 'detective', route: '/culture/detective', repeat: 'repeatable', titleKey: 'activityChooser.items.detective.title', descriptionKey: 'activityChooser.items.detective.description' },
  { id: 'mapChallenge', interest: 'discover', minutes: 3, basis: 'mapChallenge', route: '/explore/map-challenge', repeat: 'repeatable', titleKey: 'activityChooser.items.mapChallenge.title', descriptionKey: 'activityChooser.items.mapChallenge.description' },
  // Play
  { id: 'jaaAtuu', interest: 'play', minutes: 2, basis: 'jaaAtuu', route: '/games/jaa-atuu', repeat: 'repeatable', titleKey: 'activityChooser.items.jaaAtuu.title', descriptionKey: 'activityChooser.items.jaaAtuu.description' },
  { id: 'kyzKuumai', interest: 'play', minutes: 2, basis: 'kyzKuumai', route: '/games/kyz-kuumai', repeat: 'repeatable', titleKey: 'activityChooser.items.kyzKuumai.title', descriptionKey: 'activityChooser.items.kyzKuumai.description' },
  { id: 'kokBoru', interest: 'play', minutes: 3, basis: 'kokBoru', route: '/games/kok-boru', repeat: 'repeatable', titleKey: 'activityChooser.items.kokBoru.title', descriptionKey: 'activityChooser.items.kokBoru.description' },
  { id: 'duel', interest: 'play', minutes: 5, basis: 'duel', route: '/culture/duel', repeat: 'repeatable', together: true, titleKey: 'activityChooser.items.duel.title', descriptionKey: 'activityChooser.items.duel.description' },
  // Create
  { id: 'restore', interest: 'create', minutes: 2, basis: 'restore', route: '/culture/oymo/restore', repeat: 'repeatable', titleKey: 'activityChooser.items.restore.title', descriptionKey: 'activityChooser.items.restore.description' },
  { id: 'bozUy', interest: 'create', minutes: 5, basis: 'bozUy', route: '/culture/boz-uy/build', repeat: 'repeatable', titleKey: 'activityChooser.items.bozUy.title', descriptionKey: 'activityChooser.items.bozUy.description' },
  { id: 'shyrdak', interest: 'create', minutes: 5, basis: 'shyrdak', route: '/culture/shyrdak/create', repeat: 'repeatable', titleKey: 'activityChooser.items.shyrdak.title', descriptionKey: 'activityChooser.items.shyrdak.description' },
  { id: 'oymo', interest: 'create', minutes: 10, basis: 'openEnded', route: '/culture/oymo/create', repeat: 'repeatable', titleKey: 'activityChooser.items.oymo.title', descriptionKey: 'activityChooser.items.oymo.description' },
  // Listen
  { id: 'komuzListen', interest: 'listen', minutes: 3, basis: 'komuzTracks', route: '/culture/komuz/listen', repeat: 'repeatable', titleKey: 'activityChooser.items.komuzListen.title', descriptionKey: 'activityChooser.items.komuzListen.description' },
  { id: 'repeatRhythm', interest: 'listen', minutes: 4, basis: 'repeatRhythm', route: '/culture/komuz/repeat', repeat: 'repeatable', titleKey: 'activityChooser.items.repeatRhythm.title', descriptionKey: 'activityChooser.items.repeatRhythm.description' },
  { id: 'komuzLesson', interest: 'listen', minutes: 5, basis: 'komuzLesson', route: '/culture/komuz/learn', repeat: 'once', titleKey: 'activityChooser.items.komuzLesson.title', descriptionKey: 'activityChooser.items.komuzLesson.description' },
];

export type ChooserSignals = {
  isOffline: boolean;
  /** The screen can open with what is on the device (only consulted offline). */
  isAvailableOffline: (route: string) => boolean;
  dailyDoneToday: boolean;
  /** Activities finished at least once (labs created, lesson completed, games played, sessions recorded). */
  tried: ReadonlySet<string>;
  /** One-time learning activities that are complete. */
  completed: ReadonlySet<string>;
  /** The next step of a Learning Path already started (a culture item to read), if any. */
  pathStep: { pathTitle: string; itemTitle: string; route: string } | null;
};

export type SuggestionReason = 'continuePath' | 'new' | 'again';
export type Suggestion = { activity: Activity; reason: SuggestionReason; worksOffline: boolean };

export type ChooserResult =
  | { kind: 'suggestions'; suggestions: Suggestion[]; total: number; page: number; pages: number }
  /** Nothing fits: why, honestly - and the shortest real option if more time would help. */
  | { kind: 'empty'; why: 'needsMoreTime' | 'offline' | 'allDone'; shortest: Activity | null };

/** A Learning Path's next reading step, as an activity (one article). */
export function pathStepActivity(step: NonNullable<ChooserSignals['pathStep']>): Activity {
  return { id: `path:${step.route}`, interest: 'discover', minutes: 3, basis: 'oneArticle', route: step.route, repeat: 'once', title: step.itemTitle, descriptionKey: 'activityChooser.items.pathStep.description' };
}

function usable(activity: Activity, signals: ChooserSignals): boolean {
  if (activity.repeat === 'daily' && signals.dailyDoneToday) return false;
  if (activity.repeat === 'once' && signals.completed.has(activity.id)) return false;
  return true;
}

export function rankActivities(minutes: TimeBudget, interest: Interest, signals: ChooserSignals, catalog: readonly Activity[] = ACTIVITY_CATALOG): Suggestion[] {
  const pool = [...(interest === 'discover' && signals.pathStep ? [pathStepActivity(signals.pathStep)] : []), ...catalog].filter((activity) => activity.interest === interest);
  const candidates = pool.filter((activity) => activity.minutes <= minutes && usable(activity, signals) && (!signals.isOffline || signals.isAvailableOffline(activity.route)));
  const order = (activity: Activity) => (activity.id.startsWith('path:') ? 0 : signals.tried.has(activity.id) ? 2 : 1);
  return candidates
    .map((activity, index) => ({ activity, index }))
    .sort((a, b) => order(a.activity) - order(b.activity) || b.activity.minutes - a.activity.minutes || a.index - b.index)
    .map(({ activity }) => ({
      activity,
      reason: (activity.id.startsWith('path:') ? 'continuePath' : signals.tried.has(activity.id) ? 'again' : 'new') as SuggestionReason,
      worksOffline: signals.isAvailableOffline(activity.route),
    }));
}

export function chooseActivities(minutes: TimeBudget, interest: Interest, signals: ChooserSignals, page = 0, catalog: readonly Activity[] = ACTIVITY_CATALOG): ChooserResult {
  const ranked = rankActivities(minutes, interest, signals, catalog);
  if (ranked.length > 0) {
    const pages = Math.ceil(ranked.length / PAGE_SIZE);
    const current = ((page % pages) + pages) % pages;
    return { kind: 'suggestions', suggestions: ranked.slice(current * PAGE_SIZE, current * PAGE_SIZE + PAGE_SIZE), total: ranked.length, page: current, pages };
  }
  // Why nothing: would more time help (with what's usable now)? Or is it the connection, or all done?
  const reachable = catalog.filter((activity) => activity.interest === interest && usable(activity, signals));
  const reachableNow = reachable.filter((activity) => !signals.isOffline || signals.isAvailableOffline(activity.route));
  const longer = reachableNow.filter((activity) => activity.minutes > minutes).sort((a, b) => a.minutes - b.minutes);
  if (longer.length > 0) return { kind: 'empty', why: 'needsMoreTime', shortest: longer[0] };
  if (reachable.length > reachableNow.length) return { kind: 'empty', why: 'offline', shortest: null };
  return { kind: 'empty', why: 'allDone', shortest: null };
}

/** The plain-language reason line: "A short creative activity." */
export function explanationKey(activity: Activity): string {
  const length = activity.minutes <= 2 ? 'quick' : activity.minutes <= 5 ? 'short' : 'longer';
  return `activityChooser.explain.${activity.interest}.${length}`;
}
