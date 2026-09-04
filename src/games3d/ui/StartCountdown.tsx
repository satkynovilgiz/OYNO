import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';

import { colors, typography } from '@/theme';

type StartCountdownProps = {
  visible: boolean;
  onDone: () => void;
};

const STEP_MS = 650;

/** Shared "3, 2, 1, БАШТА!" beat (Section "KYZ KUUMAI — INTRO") for
 * movement-start games (Kyz Kuumai, Kok Boru) - the READY phase shows this,
 * then the game hands off to PLAYING. */
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
