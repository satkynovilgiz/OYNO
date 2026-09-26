import { decideRouteGuardRedirect, type RouteGuardState } from './routeGuard';

const UNGATED_ROUTES = ['/', '/language', '/onboarding', '/age-group', '/sign-up', '/sign-in', '/verify-email'];

function baseState(overrides: Partial<RouteGuardState> = {}): RouteGuardState {
  return {
    authStatus: 'authenticated',
    hasChosenLanguage: true,
    hasCompletedOnboarding: true,
    hasChosenAgeGroup: true,
    pathname: '/home',
    ungatedRoutes: UNGATED_ROUTES,
    ...overrides,
  };
}

describe('decideRouteGuardRedirect', () => {
  it('does nothing while auth is still loading', () => {
    expect(decideRouteGuardRedirect(baseState({ authStatus: 'loading', hasChosenLanguage: false }))).toBeNull();
  });

  it('does nothing on the splash/decision route itself', () => {
    expect(decideRouteGuardRedirect(baseState({ pathname: '/', hasChosenLanguage: false }))).toBeNull();
  });

  it('sends a user who has never picked a language to /language', () => {
    expect(decideRouteGuardRedirect(baseState({ hasChosenLanguage: false, pathname: '/home' }))).toBe('/language');
  });

  it('does not loop /language back to itself', () => {
    expect(decideRouteGuardRedirect(baseState({ hasChosenLanguage: false, pathname: '/language' }))).toBeNull();
  });

  it('sends a user who chose a language but never finished onboarding to /onboarding', () => {
    expect(
      decideRouteGuardRedirect(baseState({ hasChosenLanguage: true, hasCompletedOnboarding: false, pathname: '/home' })),
    ).toBe('/onboarding');
  });

  it('does not loop /onboarding back to itself', () => {
    expect(
      decideRouteGuardRedirect(
        baseState({ hasChosenLanguage: true, hasCompletedOnboarding: false, pathname: '/onboarding' }),
      ),
    ).toBeNull();
  });

  it('sends a user who finished onboarding but never picked an age group to /age-group', () => {
    expect(
      decideRouteGuardRedirect(baseState({ hasChosenAgeGroup: false, pathname: '/home' })),
    ).toBe('/age-group');
  });

  it('does not loop /age-group back to itself', () => {
    expect(
      decideRouteGuardRedirect(baseState({ hasChosenAgeGroup: false, pathname: '/age-group' })),
    ).toBeNull();
  });

  it('sends an unauthenticated user who has not picked an age group to /age-group before /sign-in', () => {
    expect(
      decideRouteGuardRedirect(
        baseState({ authStatus: 'unauthenticated', hasChosenAgeGroup: false, pathname: '/explore' }),
      ),
    ).toBe('/age-group');
  });

  it('bounces a logged-out user hitting a gated route to /sign-in', () => {
    expect(decideRouteGuardRedirect(baseState({ authStatus: 'unauthenticated', pathname: '/explore' }))).toBe(
      '/sign-in',
    );
  });

  it('lets a logged-out user stay on an explicitly ungated route', () => {
    expect(decideRouteGuardRedirect(baseState({ authStatus: 'unauthenticated', pathname: '/sign-in' }))).toBeNull();
  });

  it('lets a guest session (not just authenticated) reach a gated route', () => {
    expect(decideRouteGuardRedirect(baseState({ authStatus: 'guest', pathname: '/explore' }))).toBeNull();
  });

  it('bounces an already-authenticated user away from /sign-in back to /home', () => {
    expect(decideRouteGuardRedirect(baseState({ authStatus: 'authenticated', pathname: '/sign-in' }))).toBe('/home');
  });

  it('bounces an already-authenticated user away from /sign-up back to /home', () => {
    expect(decideRouteGuardRedirect(baseState({ authStatus: 'authenticated', pathname: '/sign-up' }))).toBe('/home');
  });

  // A guest opens Sign in / Create account on purpose (Settings) to connect
  // their progress to an account - bouncing them to /home made those
  // Settings buttons do nothing.
  it('lets a guest open /sign-in and /sign-up to create or join an account', () => {
    expect(decideRouteGuardRedirect(baseState({ authStatus: 'guest', pathname: '/sign-up' }))).toBeNull();
    expect(decideRouteGuardRedirect(baseState({ authStatus: 'guest', pathname: '/sign-in' }))).toBeNull();
  });

  it('does nothing for a fully-onboarded, authenticated user on a normal gated route', () => {
    expect(decideRouteGuardRedirect(baseState({ pathname: '/profile' }))).toBeNull();
  });

  it('language/onboarding checks take priority over the auth check', () => {
    // A logged-out user who also hasn't chosen a language should be sent to
    // /language first, not /sign-in - regressing this would show the wrong
    // first-launch screen to a brand new user.
    expect(
      decideRouteGuardRedirect(
        baseState({ authStatus: 'unauthenticated', hasChosenLanguage: false, pathname: '/explore' }),
      ),
    ).toBe('/language');
  });
});
