import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';

import { SplashScreen } from '@/features/splash/SplashScreen';
import { useAppStore } from '@/store/useAppStore';
import { useAuthStore } from '@/store/useAuthStore';

/**
 * App entry gate (spec Sections 11 + 99). Plays the branded splash while
 * loading auth/onboarding state in parallel, then routes once, to exactly
 * one of: /language -> /onboarding -> /sign-in -> /home, per the
 * first-time vs. returning vs. logged-out user journeys in the spec.
 */
export default function IndexRoute() {
  const [animationDone, setAnimationDone] = useState(false);
  const [stateLoaded, setStateLoaded] = useState(false);
  const hasNavigated = useRef(false);

  useEffect(() => {
    (async () => {
      await Promise.all([useAuthStore.getState().initialize(), useAppStore.getState().loadOnboardingFlags()]);
      setStateLoaded(true);
    })();
  }, []);

  useEffect(() => {
    if (!animationDone || !stateLoaded || hasNavigated.current) return;
    hasNavigated.current = true;

    const { hasChosenLanguage, hasCompletedOnboarding } = useAppStore.getState();
    const { status } = useAuthStore.getState();

    if (!hasChosenLanguage) {
      router.replace('/language');
    } else if (!hasCompletedOnboarding) {
      router.replace('/onboarding');
    } else if (status === 'authenticated' || status === 'guest') {
      router.replace('/home');
    } else {
      router.replace('/sign-in');
    }
  }, [animationDone, stateLoaded]);

  return <SplashScreen onAnimationComplete={() => setAnimationDone(true)} />;
}
