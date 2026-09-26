import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

import { gameHaptics } from '../haptics/gameHaptics';

/** Shared right-side hold-to-sprint button (Section 37/46) - exposes
 * `sprintHeld` as a Reanimated shared value the scene reads directly, and
 * fires haptics on press (Section 61). Large touch target (Section 92:
 * 44+pt). */
export function useSprintButton() {
  const sprintHeld = useSharedValue(false);
  /** 0..1 horse stamina and whether sprint can engage - written by the
   * scene only when they change noticeably, read on the UI thread here. */
  const stamina = useSharedValue(1);
  const sprintAvailable = useSharedValue(true);
  return { sprintHeld, stamina, sprintAvailable };
}

type SprintButtonViewProps = {
  sprintHeld: ReturnType<typeof useSprintButton>['sprintHeld'];
  stamina?: ReturnType<typeof useSprintButton>['stamina'];
  sprintAvailable?: ReturnType<typeof useSprintButton>['sprintAvailable'];
  onPressIn?: () => void;
};

export function SprintButtonView({ sprintHeld, stamina, sprintAvailable, onPressIn }: SprintButtonViewProps) {
  const { t } = useTranslation();
  const fillStyle = useAnimatedStyle(() => ({ width: `${Math.round((stamina?.value ?? 1) * 100)}%` }));
  // Dimmed while sprint is locked out (recovering after running out).
  const lockStyle = useAnimatedStyle(() => ({ opacity: sprintAvailable && !sprintAvailable.value ? 0.55 : 1 }));

  const handlePressIn = useCallback(() => {
    sprintHeld.value = true;
    void gameHaptics.light();
    onPressIn?.();
  }, [sprintHeld, onPressIn]);

  const handlePressOut = useCallback(() => {
    sprintHeld.value = false;
  }, [sprintHeld]);

  return (
    <Pressable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={t('games3d.controls.sprint')}
    >
      <Animated.View style={[styles.inner, lockStyle]}>
        <Text style={styles.label}>{t('games3d.controls.sprint')}</Text>
        {stamina ? (
          <View style={styles.staminaTrack}>
            <Animated.View style={[styles.staminaFill, fillStyle]} />
          </View>
        ) : null}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressed: {
    transform: [{ scale: 0.93 }],
    backgroundColor: 'rgba(232,185,61,1)',
  },
  button: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: 'rgba(232,185,61,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  inner: {
    alignItems: 'center',
    gap: 6,
  },
  staminaTrack: {
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(43,32,25,0.25)',
    overflow: 'hidden',
  },
  staminaFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: '#2B2019',
  },
  label: {
    fontSize: 13,
    fontWeight: '800',
    color: '#2B2019',
  },
});
