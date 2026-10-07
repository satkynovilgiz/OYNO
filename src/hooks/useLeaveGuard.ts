import { useNavigation } from 'expo-router';
import { useEffect, useRef } from 'react';
import { BackHandler, Platform } from 'react-native';

type BeforeRemoveEvent = { preventDefault: () => void; data: { action: unknown } };
type GuardedNavigation = {
  addListener: (type: 'beforeRemove', listener: (event: BeforeRemoveEvent) => void) => () => void;
  dispatch: (action: never) => void;
  setOptions: (options: { gestureEnabled?: boolean }) => void;
};

/**
 * Stops the screen from being left while `active` (unsaved changes):
 *  - router navigation that would REMOVE this screen (router.back,
 *    router.replace, a pop from elsewhere) is held and `onBlocked` gets a
 *    `proceed` to run once the person has chosen;
 *  - Android back goes to `onHardwareBack` (return true = handled);
 *  - the iOS swipe-back gesture is off while active (a native gesture
 *    can't be held mid-swipe).
 * `allowLeave()` lets the next removal through (after Save / Discard).
 * Web: a held browser Back restores this screen's URL (see below).
 */
export function useLeaveGuard({ active, onBlocked, onHardwareBack }: { active: boolean; onBlocked: (proceed: () => void) => void; onHardwareBack: () => boolean }) {
  const navigation = useNavigation() as unknown as GuardedNavigation;
  const state = useRef({ active, onBlocked, onHardwareBack, allowed: false });
  state.current = { ...state.current, active, onBlocked, onHardwareBack };

  useEffect(() => {
    navigation.setOptions({ gestureEnabled: !active });
  }, [navigation, active]);

  // Web: the browser moves its address bar BEFORE the app can hold a Back.
  // Remember this screen's URL while guarding, and put it back when a Back
  // is held - so the URL matches the screen and the next Back works.
  const href = useRef<string | null>(null);
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    href.current = active ? window.location.href : null;
  }, [active]);

  useEffect(
    () =>
      navigation.addListener('beforeRemove', (event) => {
        if (!state.current.active || state.current.allowed) return;
        event.preventDefault();
        if (Platform.OS === 'web' && href.current && typeof window !== 'undefined' && window.location.href !== href.current) window.history.pushState(window.history.state, '', href.current);
        state.current.onBlocked(() => {
          state.current.allowed = true;
          navigation.dispatch(event.data.action as never);
        });
      }),
    [navigation],
  );

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => state.current.onHardwareBack());
    return () => subscription.remove();
  }, []);

  return {
    allowLeave: () => {
      state.current.allowed = true;
    },
  };
}
