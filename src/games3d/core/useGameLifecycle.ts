import * as ScreenOrientation from 'expo-screen-orientation';
import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import type { Game3DOrientation } from './gameTypes';

/** Locks screen orientation for the duration a 3D game screen is mounted and
 * restores portrait on exit (Section 18), and reports whether the app is
 * currently backgrounded (Section 17). This hook does NOT own a "paused"
 * boolean itself - each game's own phase machine has a real `PAUSED` phase
 * (Section "COMMON GAME STATES": no ad hoc isPaused booleans), and the game
 * screen is expected to call its controller's `pause()` when
 * `isBackgrounded` becomes true. */
export function useGameLifecycle(orientation: Game3DOrientation) {
  const [isBackgrounded, setIsBackgrounded] = useState(false);
  const orientationRef = useRef(orientation);
  orientationRef.current = orientation;

  useEffect(() => {
    let cancelled = false;

    async function lock() {
      try {
        if (orientationRef.current === 'landscape') {
          await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
        } else {
          await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
        }
      } catch {
        // Some environments (web, certain tablets) reject a lock request -
        // gameplay should still work unlocked rather than crash the screen.
      }
    }

    if (!cancelled) lock();

    return () => {
      cancelled = true;
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
    };
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      setIsBackgrounded(nextState !== 'active');
    });
    return () => subscription.remove();
  }, []);

  return { isBackgrounded };
}
