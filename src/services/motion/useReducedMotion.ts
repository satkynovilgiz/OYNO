import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

import { effectiveReducedMotion } from '@/services/comfort/comfort';
import { useComfortStore } from '@/services/comfort/useComfortStore';

/**
 * OYNO's motion system (spec "Create a restrained OYNO motion system...
 * Respect Reduce Motion") - the one place every animated primitive checks
 * the OS-level "Reduce Motion" accessibility setting. Defaults to `false`
 * until the async check resolves, so the very first frame never blocks on
 * it; the live subscription then catches the setting changing mid-session
 * without needing an app restart.
 *
 * Accessibility & Comfort: the system setting stays authoritative - OYNO's
 * own "Reduce motion" can only ADD calm (system OR OYNO).
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  const local = useComfortStore((state) => state.prefs.reduceMotion);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        if (mounted) setReduced(value);
      })
      .catch(() => {});

    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', (value) => {
      setReduced(value);
    });

    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  return effectiveReducedMotion(reduced, { reduceMotion: local });
}
