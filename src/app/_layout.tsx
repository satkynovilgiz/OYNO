import '@/i18n';

import { QueryClientProvider } from '@tanstack/react-query';
import { router, Stack, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState, type ReactNode } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { colors } from '@/theme';
import { track } from '@/services/analytics/analytics';
import { queryClient } from '@/services/queryClient';
import { loadWithTimeout } from '@/services/storage/loadWithTimeout';
import { ErrorBoundary } from '@/components/system/ErrorBoundary';
import { OfflineBanner } from '@/components/system/OfflineBanner';
import { AchievementUnlockedModal } from '@/features/profile/components/AchievementUnlockedModal';
import { getAchievement } from '@/features/profile/data';
import { useAppStore } from '@/store/useAppStore';
import { useAuthStore } from '@/store/useAuthStore';
import { useNotificationsStore } from '@/store/useNotificationsStore';
import { useProgressStore } from '@/store/useProgressStore';
import { useSettingsStore } from '@/store/useSettingsStore';

// Routes reachable without a session (the auth flow itself, plus the splash
// gate which does its own one-time redirect).
const UNGATED_ROUTES = [
  '/',
  '/language',
  '/onboarding',
  '/sign-up',
  '/sign-in',
  '/verify-email',
  '/forgot-password',
  '/verify-reset-code',
  '/reset-password',
  '/auth-callback',
];

/**
 * Defends the routes above against direct navigation (deep link, restored
 * back-stack, etc.) bypassing the Splash gate's own redirect logic - e.g.
 * an unauthenticated user hitting /home directly gets bounced to /sign-in,
 * and a signed-in user hitting /sign-in gets bounced to /home.
 */
function RouteGuard({ children, flagsReady }: { children: ReactNode; flagsReady: boolean }) {
  const pathname = usePathname();
  const authStatus = useAuthStore((state) => state.status);
  const hasChosenLanguage = useAppStore((state) => state.hasChosenLanguage);
  const hasCompletedOnboarding = useAppStore((state) => state.hasCompletedOnboarding);

  useEffect(() => {
    if (!flagsReady || authStatus === 'loading' || pathname === '/') return;

    const isAuthenticatedOrGuest = authStatus === 'authenticated' || authStatus === 'guest';
    const isUngatedRoute = UNGATED_ROUTES.includes(pathname);

    if (!hasChosenLanguage && pathname !== '/language') {
      router.replace('/language');
    } else if (hasChosenLanguage && !hasCompletedOnboarding && pathname !== '/onboarding') {
      router.replace('/onboarding');
    } else if (hasCompletedOnboarding && !isAuthenticatedOrGuest && !isUngatedRoute) {
      router.replace('/sign-in');
    } else if (isAuthenticatedOrGuest && (pathname === '/sign-in' || pathname === '/sign-up')) {
      router.replace('/home');
    }
  }, [pathname, authStatus, hasChosenLanguage, hasCompletedOnboarding, flagsReady]);

  return children;
}

export default function RootLayout() {
  const [flagsReady, setFlagsReady] = useState(false);
  const authStatus = useAuthStore((state) => state.status);
  const lastUnlockedAchievementId = useProgressStore((state) => state.lastUnlockedAchievementId);

  // Reacts to every authStatus change, not just the one at boot - covers
  // signing in mid-session (progress didn't exist to load at boot time)
  // and signing out (clears progress from view rather than leaving a
  // previous user's numbers on screen). useProgressStore.load() itself
  // already no-ops to defaults for a non-'authenticated' status.
  useEffect(() => {
    if (authStatus === 'loading') return;
    void useProgressStore.getState().load();
  }, [authStatus]);

  // Same race as above: useSettingsStore.load() checks auth status to
  // decide whether to fetch user_settings from the server, so it can't
  // run inside the boot Promise.all either (see 2026-08-22 - shipped that
  // race once already, caught it live: the fetch never fired, silently
  // falling back to AsyncStorage/defaults with no error).
  useEffect(() => {
    if (authStatus === 'loading') return;
    void useSettingsStore.getState().load();
  }, [authStatus]);

  useEffect(() => {
    // The Splash/index route also calls these, but _layout mounts first and
    // every screen under RouteGuard needs the flags loaded to make a
    // correct decision, so load them here too (idempotent, cheap reads).
    // Every individual load() above already recovers from its own storage
    // errors (see safeJsonParse); loadWithTimeout is a defense-in-depth
    // backstop against a genuine hang (not just a throw) - flagsReady must
    // always eventually become true, or the app is stuck behind RouteGuard
    // forever with no way out.
    return loadWithTimeout(
      async () => {
        track('app_open');
        try {
          // useProgressStore/useSettingsStore aren't loaded here - both
          // depend on auth status, which this Promise.all itself is still
          // resolving, so loading them here would race (see the authStatus
          // effects below instead).
          await Promise.all([
            useAuthStore.getState().initialize(),
            useAppStore.getState().loadOnboardingFlags(),
            useNotificationsStore.getState().load(),
          ]);
        } catch (error) {
          if (__DEV__) console.warn('[boot] one or more stores failed to load, continuing with defaults', error);
        }
      },
      () => setFlagsReady(true),
    );
  }, []);

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <QueryClientProvider client={queryClient}>
            <StatusBar style="dark" />
            <RouteGuard flagsReady={flagsReady}>
              <Stack
                screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}
              />
            </RouteGuard>
            <AchievementUnlockedModal
              achievement={lastUnlockedAchievementId ? (getAchievement(lastUnlockedAchievementId) ?? null) : null}
              onDismiss={() => useProgressStore.getState().acknowledgeAchievement()}
            />
            <OfflineBanner />
          </QueryClientProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
