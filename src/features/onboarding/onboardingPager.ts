/**
 * Onboarding pager state. The visible page comes from where the ScrollView
 * actually IS (a page boundary reached by a tap, a swipe, a trackpad or a
 * resize), never from a tap alone - so the progress label, the Next/Start
 * button and the guest link always describe the slide on screen.
 *
 * - While a Next transition is in flight, Next is unavailable: a second tap
 *   cannot skip a slide or turn into "Start" before the last slide is shown.
 * - After a Next transition lands, Next stays unavailable for a short
 *   cooldown: the rest of a burst of taps cannot chain into the next slide
 *   or into "Start" (with Reduce Motion the scroll is instant, so arrival
 *   alone is no guard).
 * - Leaving (Start, Skip, guest) happens at most once.
 */
export type PagerState = {
  /** The page the scroll position is settled on. */
  page: number;
  /** The page a Next tap is scrolling to, until it is reached. */
  target: number | null;
  /** Just landed after a Next transition - Next is briefly unavailable. */
  cooldown: boolean;
  /** Start / Skip / guest was chosen - every other action is off. */
  exiting: boolean;
};

export const initialPagerState: PagerState = { page: 0, target: null, cooldown: false, exiting: false };

/** Longer than the gap between taps of one burst, shorter than a deliberate next tap. */
export const ARRIVAL_COOLDOWN_MS = 350;

/** How long a Next transition may take before the pager settles where it is. */
export const TRANSITION_WATCHDOG_MS = 1200;

export type NextResult = { state: PagerState; effect: 'scroll' | 'finish' | 'none' };

export function requestNext(state: PagerState, pageCount: number): NextResult {
  if (state.exiting || state.target !== null || state.cooldown) return { state, effect: 'none' };
  if (state.page >= pageCount - 1) return { state: { ...state, exiting: true }, effect: 'finish' };
  return { state: { ...state, target: state.page + 1 }, effect: 'scroll' };
}

/** The scroll position rests on `page` (any cause). Ends a transition that reached its target (then cooldown). */
export function pageReached(state: PagerState, page: number): PagerState {
  const arrived = state.target !== null && state.target === page;
  if (arrived) return { ...state, page, target: null, cooldown: true };
  if (page === state.page) return state;
  return { ...state, page };
}

/** The arrival cooldown is over. */
export function cooledDown(state: PagerState): PagerState {
  return state.cooldown ? { ...state, cooldown: false } : state;
}

/** The transition did not arrive in time (or the user dragged elsewhere): settle on the page actually shown. */
export function settleAt(state: PagerState, page: number): PagerState {
  return { ...state, page, target: null };
}

/** Start / Skip / guest: true only for the first one. */
export function requestExit(state: PagerState): { state: PagerState; allowed: boolean } {
  if (state.exiting) return { state, allowed: false };
  return { state: { ...state, exiting: true }, allowed: true };
}

/** The page a scroll offset rests on, or null while between pages. */
export function restingPage(offset: number, pageWidth: number, pageCount: number): number | null {
  'worklet';
  if (pageWidth <= 0) return null;
  const page = Math.round(offset / pageWidth);
  if (Math.abs(offset - page * pageWidth) > 1) return null;
  return Math.min(Math.max(page, 0), pageCount - 1);
}

/** Nearest page for an arbitrary offset (used when settling mid-way). */
export function nearestPage(offset: number, pageWidth: number, pageCount: number): number {
  if (pageWidth <= 0) return 0;
  return Math.min(Math.max(Math.round(offset / pageWidth), 0), pageCount - 1);
}

/** What the controls show for a state. */
export function pagerControls(state: PagerState, pageCount: number) {
  const settled = state.target === null;
  const isLastSlide = settled && state.page === pageCount - 1;
  return {
    isLastSlide,
    /** Next/Start is available only when nothing is moving, the arrival cooldown is over and nobody is leaving. */
    continueEnabled: settled && !state.cooldown && !state.exiting,
    /** Guest stays one tap away on the (settled) last slide. */
    showGuest: isLastSlide,
    guestEnabled: isLastSlide && !state.exiting,
    skipEnabled: !state.exiting,
  };
}
