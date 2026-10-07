import { useNavigation } from 'expo-router';
import { useEffect, useRef } from 'react';
import { BackHandler } from 'react-native';

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
 */
export function useLeaveGuard({ active, onBlocked, onHardwareBack }: { active: boolean; onBlocked: (proceed: () => void) => void; onHardwareBack: () => boolean }) {
  const navigation = useNavigation() as unknown as GuardedNavigation;
  const state = useRef({ active, onBlocked, onHardwareBack, allowed: false });
  state.current = { ...state.current, active, onBlocked, onHardwareBack };

  useEffect(() => {
    navigation.setOptions({ gestureEnabled: !active });
  }, [navigation, active]);

  useEffect(
    () =>
      navigation.addListener('beforeRemove', (event) => {
        if (!state.current.active || state.current.allowed) return;
        event.preventDefault();
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
