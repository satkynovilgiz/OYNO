import {
  cooledDown,
  initialPagerState,
  nearestPage,
  pageReached,
  pagerControls,
  requestExit,
  requestNext,
  restingPage,
  settleAt,
  type PagerState,
} from './onboardingPager';

const PAGES = 3;
const at = (page: number, extra: Partial<PagerState> = {}): PagerState => ({ ...initialPagerState, page, ...extra });

describe('Next', () => {
  it('scrolls one page at a time and the page changes only when reached', () => {
    const { state, effect } = requestNext(at(0), PAGES);
    expect(effect).toBe('scroll');
    expect(state).toEqual({ page: 0, target: 1, cooldown: false, exiting: false });
    expect(pagerControls(state, PAGES).continueEnabled).toBe(false);
    expect(pageReached(state, 1)).toEqual({ page: 1, target: null, cooldown: true, exiting: false });
  });

  it('after landing, Next waits for the cooldown - a burst of taps cannot chain (instant scroll with Reduce Motion)', () => {
    const landed = pageReached(requestNext(at(0), PAGES).state, 1);
    expect(requestNext(landed, PAGES).effect).toBe('none');
    expect(pagerControls(landed, PAGES).continueEnabled).toBe(false);
    expect(requestNext(cooledDown(landed), PAGES).effect).toBe('scroll');
  });

  it('a second tap during the transition is ignored - no skipped slide', () => {
    const first = requestNext(at(0), PAGES).state;
    const second = requestNext(first, PAGES);
    expect(second.effect).toBe('none');
    expect(second.state.target).toBe(1);
  });

  it('a quick double tap on the second-last slide never finishes onboarding', () => {
    const toLast = requestNext(at(1), PAGES).state;
    expect(requestNext(toLast, PAGES).effect).toBe('none');
    // While moving, the button still says Next and the guest link is not offered yet.
    expect(pagerControls(toLast, PAGES)).toMatchObject({ isLastSlide: false, showGuest: false });
    const arrived = pageReached(toLast, 2);
    expect(requestNext(arrived, PAGES).effect).toBe('none');
    expect(pagerControls(arrived, PAGES)).toMatchObject({ isLastSlide: true, continueEnabled: false, showGuest: true, guestEnabled: true });
    expect(pagerControls(cooledDown(arrived), PAGES).continueEnabled).toBe(true);
  });

  it('on the settled last slide Next is Start (finish), exactly once', () => {
    const finish = requestNext(at(2), PAGES);
    expect(finish.effect).toBe('finish');
    expect(requestNext(finish.state, PAGES).effect).toBe('none');
    expect(pagerControls(finish.state, PAGES)).toMatchObject({ continueEnabled: false, guestEnabled: false, skipEnabled: false });
  });

  it('passing through the start page does not end a transition', () => {
    const moving = requestNext(at(0), PAGES).state;
    expect(pageReached(moving, 0)).toBe(moving);
  });
});

describe('swipes and settling', () => {
  it('a swipe (no tap) moves the page and the controls follow, with no cooldown', () => {
    const swiped = pageReached(at(0), 2);
    expect(swiped.cooldown).toBe(false);
    expect(pagerControls(swiped, PAGES)).toMatchObject({ isLastSlide: true, showGuest: true });
    // ...and back: Start and the guest link go away again.
    expect(pagerControls(pageReached(swiped, 1), PAGES)).toMatchObject({ isLastSlide: false, showGuest: false });
  });

  it('settling (watchdog or a drag) ends the transition on the page actually shown', () => {
    const moving = requestNext(at(0), PAGES).state;
    expect(settleAt(moving, 0)).toEqual({ page: 0, target: null, cooldown: false, exiting: false });
    expect(pagerControls(settleAt(moving, 0), PAGES).continueEnabled).toBe(true);
  });

  it('resting page: only on a boundary (±1 px), clamped', () => {
    expect(restingPage(0, 390, PAGES)).toBe(0);
    expect(restingPage(780.4, 390, PAGES)).toBe(2);
    expect(restingPage(500, 390, PAGES)).toBeNull();
    expect(restingPage(3900, 390, PAGES)).toBe(2);
    expect(restingPage(0, 0, PAGES)).toBeNull();
    expect(nearestPage(500, 390, PAGES)).toBe(1);
    expect(nearestPage(-50, 390, PAGES)).toBe(0);
  });
});

describe('leaving', () => {
  it('Skip / guest / Start: only the first one goes through', () => {
    const first = requestExit(at(2));
    expect(first.allowed).toBe(true);
    expect(requestExit(first.state).allowed).toBe(false);
  });
});
