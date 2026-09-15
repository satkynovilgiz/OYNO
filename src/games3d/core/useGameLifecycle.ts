import * as ScreenOrientation from 'expo-screen-orientation';
import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import type { Game3DOrientation } from './gameTypes';

/** Locks screen orientation for the duration a 3D game screen is mounted and
 * restores portrait on exit (Section 18), and reports whether the app is
 * currently backgrounded (Section 17). This hook does NOT own a "paused"
 * boolean itself - each game's own phase machine has a real `PAUSED` phase
 * (Section "COMMON GAME STATES": no ad hoc isPaused booleans).
 *
 * Pass the controller's `pause` as `onBackground` (Section "app background
 * auto-pause") and this hook calls it the instant the app leaves the
 * foreground - every one of the 5 games previously duplicated this as its
 * own `useEffect(() => { if (isBackgrounded) game.pause(); }, [isBackgrounded])`;
 * centralizing it here means a game screen no longer has to write that
 * effect at all. Deliberately does NOT call anything on returning to the
 * foreground - resuming is always a manual button press
 * (`PauseMenu.onResume`), never automatic, so the existing Pause screen is
 * exactly what a returning player sees. Combined with `core/Game3DCanvas`'s
 * `frameloop={isPaused ? 'never' : 'always'}`, pausing this way also stops
 * the game timer and AI stepping outright (both live inside `useFrame`,
 * which simply never runs while backgrounded+paused) - not something this
 * hook needs to separately manage. */
export function useGameLifecycle(orientation: Game3DOrientation, onBackground?: () => void) {
  const [isBackgrounded, setIsBackgrounded] = useState(false);
  const orientationRef = useRef(orientation);
  orientationRef.current = orientation;
  const onBackgroundRef = useRef(onBackground);
  onBackgroundRef.current = onBackground;

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
      const backgrounded = nextState !== 'active';
      setIsBackgrounded(backgrounded);
      if (backgrounded) onBackgroundRef.current?.();
    });
    return () => subscription.remove();
  }, []);

  return { isBackgrounded };
}
