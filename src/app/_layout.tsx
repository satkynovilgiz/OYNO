import '@/i18n';

import { onlineManager, QueryClientProvider } from '@tanstack/react-query';
import { router, Stack, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState, type ReactNode } from 'react';
import { AppState, Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { colors } from '@/theme';
import { track } from '@/services/analytics/analytics';
import { initSentry } from '@/services/monitoring/sentry';
import { decideRouteGuardRedirect } from '@/services/navigation/routeGuard';
import { registerForPushNotifications } from '@/services/notifications/pushRegistration';
import { bindUserScopedCache } from '@/services/auth/userScopedCache';
import { queryClient } from '@/services/queryClient';
import { loadWithTimeout } from '@/services/storage/loadWithTimeout';
import { ErrorBoundary } from '@/components/system/ErrorBoundary';
import { OfflineBanner } from '@/components/system/OfflineBanner';
import { ReminderSync } from '@/components/system/ReminderSync';
import { SilentErrorBoundary } from '@/components/system/SilentErrorBoundary';
import { ToastHost } from '@/components/ui/Toast';
import { ActivityRecorder } from '@/components/system/ActivityRecorder';
import { WidgetSync } from '@/components/system/WidgetSync';
import { AchievementUnlockedModal } from '@/features/profile/components/AchievementUnlockedModal';
import { getAchievement } from '@/features/profile/data';
import { useAppStore } from '@/store/useAppStore';
import { useAuthStore } from '@/store/useAuthStore';
import { useAvatarStore } from '@/store/useAvatarStore';
import { useChallengeStore } from '@/store/useChallengeStore';
import { useDailyDiscoveryStore } from '@/store/useDailyDiscoveryStore';
import { onConnectionRestored } from '@/services/offline/networkStatus';
import { useOfflineStore } from '@/services/offline/useOfflineStore';
import { onAccountSignedIn, onGuestSession } from '@/services/sync/accountLifecycle';
import { recordDiagnostic } from '@/services/feedback/diagnosticTrail';
import { flushFeedbackQueue } from '@/services/feedback/feedbackQueue';
import { FeedbackSheet } from '@/features/feedback/FeedbackSheet';
import { scheduleAccountSync } from '@/services/sync/syncEngine';
import { useFavoritesStore } from '@/store/useFavoritesStore';
import { useNotificationsStore } from '@/store/useNotificationsStore';
import { useProgressStore } from '@/store/useProgressStore';
import { useSettingsStore } from '@/store/useSettingsStore';

// Must run before anything else in this module (route arrays, component
// bodies) so a crash during boot is still reported, not just crashes that
// happen after RootLayout mounts.
initSentry();

// One person's cached rows (admin role, their oymo/shyrdak creations) are
// never shown to the next account on this device.
bindUserScopedCache(queryClient);

// Routes reachable without a session (the auth flow itself, plus the splash
// gate which does its own one-time redirect).
const UNGATED_ROUTES = [
  '/',
  '/language',
  '/onboarding',
  '/age-group',
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
  const hasChosenAgeGroup = useAppStore((state) => state.hasChosenAgeGroup);

  // Beta feedback diagnostic trail: which screen is open (sanitized path only).
  useEffect(() => {
    recordDiagnostic('route', pathname);
  }, [pathname]);

  useEffect(() => {
    if (!flagsReady) return;
    const redirect = decideRouteGuardRedirect({
      authStatus,
      hasChosenLanguage,
      hasCompletedOnboarding,
      hasChosenAgeGroup,
      pathname,
      ungatedRoutes: UNGATED_ROUTES,
    });
    if (redirect) router.replace(redirect as never);
  }, [pathname, authStatus, hasChosenLanguage, hasCompletedOnboarding, hasChosenAgeGroup, flagsReady]);

  return children;
}

/** Game screens that start play immediately (fade in, no push slide). */
const GAMEPLAY_ROUTES = ['games/chuko', 'games/kok-boru', 'games/jaa-atuu', 'games/kyz-kuumai', 'games/ordo', 'games/besh-tash', 'games/3d-lab'];

/** Foreground sync at most this often (changes from another device). */
const FOREGROUND_SYNC_INTERVAL_MS = 5 * 60 * 1000;

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

  // Same race, same reason: characterId now persists (previously reset to
  // the default character on every reopen), and loadCharacterId() also
  // checks auth status to decide server vs local-cache.
  useEffect(() => {
    if (authStatus === 'loading') return;
    void useAppStore.getState().loadCharacterId();
  }, [authStatus]);

  // Same race, same reason: UserAvatar renders on Home/Explore/Culture/
  // Profile headers, which mount long before anyone opens the avatar
  // editor, so the config (and hasEverSaved, which decides whether those
  // headers show the story-character portrait or the custom-avatar
  // placeholder) must already be loaded by then.
  useEffect(() => {
    if (authStatus === 'loading') return;
    void useAvatarStore.getState().load();
  }, [authStatus]);

  // Same race, same reason: the Saved screen and every heart/save toggle
  // across Games/Culture/Explore read this on mount, and guests now get a
  // real local favorites list (see useFavoritesStore) instead of the old
  // Explore-only mechanism's silent no-op for signed-out users.
  useEffect(() => {
    if (authStatus === 'loading') return;
    void useFavoritesStore.getState().load();
  }, [authStatus]);

  // Guests have no server row for register_push_token to attach to (it
  // derives auth.uid(), which is null for a guest session) - only worth
  // asking for the permission/token once there's somewhere real to store
  // it, same "guests don't get server state" rule the rest of this file
  // already follows for progress/settings/character.
  useEffect(() => {
    if (authStatus === 'authenticated') void registerForPushNotifications();
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
            useAppStore.getState().loadAgeGroup(),
            useNotificationsStore.getState().load(),
            useDailyDiscoveryStore.getState().load(),
            // Re-seeds downloaded content into the query cache before any
            // screen asks for it, so an offline start shows real data.
            useOfflineStore.getState().load(),
            useChallengeStore.getState().load(),
          ]);
          // Online at start: upgrade downloads saved by an older cache version.
          void useOfflineStore.getState().refreshAll(true);
        } catch (error) {
          if (__DEV__) console.warn('[boot] one or more stores failed to load, continuing with defaults', error);
        }
      },
      () => setFlagsReady(true),
    );
  }, []);

  // Connection back: refresh offline copies in the background (a failed
  // refresh keeps the existing copy - downloads are never silently lost)
  // and send any account changes made while offline.
  useEffect(
    () =>
      onConnectionRestored(() => {
        void useOfflineStore.getState().refreshAll();
        scheduleAccountSync('reconnect');
        // Beta reports written offline go out now (deduplicated server-side).
        void flushFeedbackQueue(useAuthStore.getState().user?.id ?? null);
      }),
    [],
  );

  // Connection changes for the feedback diagnostic trail; plus one send
  // attempt at start for reports queued in an earlier session.
  useEffect(() => {
    void flushFeedbackQueue(useAuthStore.getState().user?.id ?? null);
    return onlineManager.subscribe((isOnline) => recordDiagnostic(isOnline ? 'online' : 'offline'));
  }, []);

  // Cross-device account sync (services/sync). Never awaited by the UI:
  // local state is already rendered; this reconciles in the background.
  const userId = useAuthStore((state) => state.user?.id);
  useEffect(() => {
    if (authStatus === 'authenticated' && userId) void onAccountSignedIn(userId);
    else if (authStatus === 'guest') void onGuestSession();
  }, [authStatus, userId]);

  // Back in the foreground: pick up changes made on another device.
  useEffect(() => {
    let lastRun = 0;
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active' || useAuthStore.getState().status !== 'authenticated') return;
      if (Date.now() - lastRun < FOREGROUND_SYNC_INTERVAL_MS) return;
      lastRun = Date.now();
      scheduleAccountSync('foreground');
    });
    return () => subscription.remove();
  }, []);

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <QueryClientProvider client={queryClient}>
            <StatusBar style="dark" />
            <RouteGuard flagsReady={flagsReady}>
              <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
                {/* Transition language: native push everywhere; a short fade
                    into gameplay (art card -> fade -> game) and into the
                    editorial Daily OYNO page. */}
                {GAMEPLAY_ROUTES.map((name) => (
                  <Stack.Screen key={name} name={name} options={{ animation: 'fade', animationDuration: 220 }} />
                ))}
                <Stack.Screen name="daily" options={{ animation: 'fade', animationDuration: 220 }} />
              </Stack>
            </RouteGuard>
            <AchievementUnlockedModal
              achievement={lastUnlockedAchievementId ? (getAchievement(lastUnlockedAchievementId) ?? null) : null}
              onDismiss={() => useProgressStore.getState().acknowledgeAchievement()}
            />
            <OfflineBanner />
            <ToastHost />
            <SilentErrorBoundary name="activity">
              <ActivityRecorder />
            </SilentErrorBoundary>
            {/* Native iOS widgets read a shared snapshot; only iOS has them. */}
            {Platform.OS === 'ios' && flagsReady ? (
              <SilentErrorBoundary name="widgets">
                <WidgetSync />
              </SilentErrorBoundary>
            ) : null}
            {/* Local reminders exist only on phones (no web scheduling). */}
            <SilentErrorBoundary name="feedback">
              <FeedbackSheet />
            </SilentErrorBoundary>
            {Platform.OS !== 'web' && flagsReady ? (
              <SilentErrorBoundary name="reminders">
                <ReminderSync />
              </SilentErrorBoundary>
            ) : null}
          </QueryClientProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
