import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';

import { colors, typography } from '@/theme';

import { gameHaptics } from '../haptics/gameHaptics';

type StartCountdownProps = {
  visible: boolean;
  onDone: () => void;
};

const STEP_MS = 650;

/** Shared "3, 2, 1, БАШТА!" pre-match beat (Section "3-second countdown
 * before normal matches") - every game shows this exactly once per match
 * (never in practice mode, never mid-match) between finishing its tutorial
 * and actually starting play; see each `<Name>Game.tsx` for how it gates
 * the underlying controller's start call behind `onDone` so movement/AI/
 * physics/the match timer are frozen for the countdown's duration for
 * free (nothing enables them until after it fires), with zero controller-
 * level changes. One shared component, reused as-is by all 5 games rather
 * than each re-implementing the beat or its haptics/sound.
 *
 * No new sound asset was added for this - none of the existing per-game
 * SFX (docs/GAME_ASSETS.md) reads as a generic countdown tick/go chime,
 * and inventing one would be a fresh licensing decision on its own,
 * outside a "reuse existing sound if suitable" ask - haptics-only here,
 * documented rather than silently skipped. */
export function StartCountdown({ visible, onDone }: StartCountdownProps) {
  const { t } = useTranslation();
  const [stepIndex, setStepIndex] = useState(0);
  const scale = useSharedValue(1);
  const steps = ['3', '2', '1', t('games3d.intro.start')];

  useEffect(() => {
    if (!visible) return;
    setStepIndex(0);
    const timers = steps.map((_, i) =>
      setTimeout(() => {
        setStepIndex(i);
        scale.value = 1.3;
        scale.value = withSequence(withTiming(1, { duration: STEP_MS * 0.6 }));
        // A small pulse for 3/2/1, a stronger one for GO (Section "haptic
        // pulse").
        void (i === steps.length - 1 ? gameHaptics.heavy() : gameHaptics.light());
        if (i === steps.length - 1) setTimeout(onDone, STEP_MS);
      }, i * STEP_MS),
    );
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  if (!visible) return null;

  return (
    <Animated.Text style={[styles.text, animatedStyle]} pointerEvents="none">
      {steps[stepIndex]}
    </Animated.Text>
  );
}

const styles = StyleSheet.create({
  text: {
    ...typography.h1,
    fontSize: 56,
    position: 'absolute',
    alignSelf: 'center',
    top: '40%',
    color: colors.textOnDark,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowRadius: 8,
  },
});
