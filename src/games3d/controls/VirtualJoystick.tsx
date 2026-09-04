import { useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';

const KNOB_RADIUS = 34;
const BASE_RADIUS = 58;

/** Shared left-thumb movement joystick (Section 52) for horse games - touch,
 * drag, dead zone, normalized direction, resets on release. Exposes
 * `moveX`/`moveZ` as Reanimated shared values (-1..1) read directly by the
 * scene's useFrame, never through React state (Section 86/87). */
export function useVirtualJoystick() {
  const moveX = useSharedValue(0);
  const moveZ = useSharedValue(0);
  const knobX = useSharedValue(0);
  const knobY = useSharedValue(0);

  const gesture = Gesture.Pan()
    .onUpdate((event) => {
      'worklet';
      const distance = Math.hypot(event.translationX, event.translationY);
      const clampedDistance = Math.min(BASE_RADIUS, distance);
      const angle = Math.atan2(event.translationY, event.translationX);
      const dead = distance < 8 ? 0 : (clampedDistance - 8) / (BASE_RADIUS - 8);

      knobX.value = Math.cos(angle) * clampedDistance;
      knobY.value = Math.sin(angle) * clampedDistance;
      moveX.value = Math.cos(angle) * dead;
      // moveZ negative = "forward" in this world's convention, and pushing
      // the stick UP (negative screen Y) should mean forward.
      moveZ.value = Math.sin(angle) * dead;
    })
    .onEnd(() => {
      'worklet';
      knobX.value = withSpring(0);
      knobY.value = withSpring(0);
      moveX.value = 0;
      moveZ.value = 0;
    });

  return { gesture, moveX, moveZ, knobX, knobY };
}

type VirtualJoystickViewProps = {
  knobX: SharedValue<number>;
  knobY: SharedValue<number>;
  gesture: ReturnType<typeof useVirtualJoystick>['gesture'];
};

/** Visual base + knob for the joystick above - kept visually simple (a
 * translucent ring), matches OYNO's warm palette. */
export function VirtualJoystickView({ knobX, knobY, gesture }: VirtualJoystickViewProps) {
  const knobStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: knobX.value }, { translateY: knobY.value }],
  }));

  const touchAreaRef = useRef(null);

  return (
    <GestureDetector gesture={gesture}>
      <View ref={touchAreaRef} style={styles.touchArea}>
        <View style={styles.base}>
          <Animated.View style={[styles.knob, knobStyle]} />
        </View>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  touchArea: {
    width: BASE_RADIUS * 2 + 40,
    height: BASE_RADIUS * 2 + 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  base: {
    width: BASE_RADIUS * 2,
    height: BASE_RADIUS * 2,
    borderRadius: BASE_RADIUS,
    backgroundColor: 'rgba(20,14,8,0.35)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  knob: {
    width: KNOB_RADIUS * 2,
    height: KNOB_RADIUS * 2,
    borderRadius: KNOB_RADIUS,
    backgroundColor: 'rgba(232,185,61,0.9)',
  },
});
