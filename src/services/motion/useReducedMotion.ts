import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * OYNO's motion system (spec "Create a restrained OYNO motion system...
 * Respect Reduce Motion") - the one place every animated primitive checks
 * the OS-level "Reduce Motion" accessibility setting. Defaults to `false`
 * until the async check resolves, so the very first frame never blocks on
 * it; the live subscription then catches the setting changing mid-session
 * without needing an app restart.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

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

  return reduced;
}
