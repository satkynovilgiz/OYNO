export type RouteGuardState = {
  authStatus: 'loading' | 'authenticated' | 'guest' | 'unauthenticated';
  hasChosenLanguage: boolean;
  hasCompletedOnboarding: boolean;
  pathname: string;
  ungatedRoutes: readonly string[];
};

/**
 * Pure extraction of _layout.tsx's RouteGuard redirect decision - was
 * inline in a useEffect with no test coverage despite branching on 4
 * independent booleans (language chosen, onboarding done, auth status,
 * current route), exactly the kind of logic where an untested edge case
 * (e.g. a guest hitting a gated route mid-onboarding) silently breaks.
 * Returns the path to redirect to, or null to redirect nowhere.
 */
export function decideRouteGuardRedirect(state: RouteGuardState): string | null {
  const { authStatus, hasChosenLanguage, hasCompletedOnboarding, pathname, ungatedRoutes } = state;

  if (authStatus === 'loading' || pathname === '/') return null;

  const isAuthenticatedOrGuest = authStatus === 'authenticated' || authStatus === 'guest';
  const isUngatedRoute = ungatedRoutes.includes(pathname);

  if (!hasChosenLanguage && pathname !== '/language') {
    return '/language';
  }
  if (hasChosenLanguage && !hasCompletedOnboarding && pathname !== '/onboarding') {
    return '/onboarding';
  }
  if (hasCompletedOnboarding && !isAuthenticatedOrGuest && !isUngatedRoute) {
    return '/sign-in';
  }
  if (isAuthenticatedOrGuest && (pathname === '/sign-in' || pathname === '/sign-up')) {
    return '/home';
  }
  return null;
}
