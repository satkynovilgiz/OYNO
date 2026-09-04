import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withSequence, withTiming } from 'react-native-reanimated';

import { colors, typography } from '@/theme';

export type ShotFeedbackEvent = {
  /** Bump this on every shot so the animation retriggers even if the same
   * text/tone repeats back to back (e.g. two misses in a row). */
  key: number;
  text: string;
  tone: 'hit' | 'bullseye' | 'miss';
};

type ShotFeedbackProps = {
  event: ShotFeedbackEvent | null;
};

const TONE_COLOR: Record<ShotFeedbackEvent['tone'], string> = {
  hit: colors.accentGold,
  bullseye: colors.danger,
  miss: 'rgba(255,255,255,0.85)',
};

/** Transient per-shot score popup ("+100" / "MISS") (Section "JAA ATUU —
 * FEEL": score popup). Fades/rises briefly over the 3D scene, never blocks
 * input - purely cosmetic feedback keyed off the shot outcome, not a modal. */
export function ShotFeedback({ event }: ShotFeedbackProps) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(0);
  const scale = useSharedValue(0.8);

  useEffect(() => {
    if (!event) return;
    opacity.value = 0;
    translateY.value = 0;
    scale.value = event.tone === 'bullseye' ? 1.15 : 0.8;

    opacity.value = withSequence(withTiming(1, { duration: 120 }), withDelay(650, withTiming(0, { duration: 300 })));
    translateY.value = withTiming(-28, { duration: 950 });
    scale.value = withTiming(1, { duration: 180 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event?.key]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }, { scale: scale.value }],
  }));

  if (!event) return null;

  return (
    <Animated.Text style={[styles.text, { color: TONE_COLOR[event.tone] }, animatedStyle]} pointerEvents="none">
      {event.text}
    </Animated.Text>
  );
}

const styles = StyleSheet.create({
  text: {
    ...typography.h1,
    fontSize: 40,
    position: 'absolute',
    alignSelf: 'center',
    top: '38%',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowRadius: 6,
  },
});
