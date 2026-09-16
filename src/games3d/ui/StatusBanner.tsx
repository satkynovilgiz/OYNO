import { useEffect } from 'react';
import { type DimensionValue, StyleSheet, Text } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { colors, radii, spacing, typography } from '@/theme';

type StatusBannerTone = 'neutral' | 'accent';
type StatusBannerSize = 'sm' | 'lg';

type StatusBannerProps = {
  visible: boolean;
  text: string;
  /** `neutral` = warm dark card (turn indicators, coaching text) - `accent`
   * = gold card (a positive/celebratory result, e.g. a goal). */
  tone?: StatusBannerTone;
  /** `lg` matches the old goalBanner's bigger type/padding for a big
   * once-in-a-while announcement; `sm` (default) matches the old turn/
   * coaching/landing banners' compact pill. */
  size?: StatusBannerSize;
  /** Vertical position as a percentage-of-screen-height string (e.g.
   * `'12%'`) - callers stack more than one banner at different heights so,
   * e.g., a turn indicator and a brief per-throw result can both be
   * visible without overlapping. */
  top: DimensionValue;
  /** Caps the pill's width (e.g. `'80%'`) for longer, potentially-wrapping
   * text (Kyz Kuumai's localized coaching hints) - omit for a pill that
   * just hugs short text like a turn indicator or score. */
  maxWidth?: DimensionValue;
};

const TONE_STYLE: Record<StatusBannerTone, { background: string; border: string; text: string }> = {
  neutral: { background: 'rgba(43,32,25,0.72)', border: 'rgba(232,185,61,0.3)', text: colors.textOnDark },
  accent: { background: 'rgba(232,185,61,0.94)', border: 'rgba(43,32,25,0.16)', text: colors.textPrimary },
};

/** Shared "small gameplay notification" pill (Section "Small gameplay
 * notifications") - replaces the near-identical `turnBanner`/
 * `landingBanner`/`coachingBanner`/`goalBanner` each of Ordo/Chuko/Kyz
 * Kuumai/Kok Boru previously hand-rolled with its own `StyleSheet`, so a
 * warm-card look only has to be tuned once. Purely a transient status
 * readout - `pointerEvents="none"`, never blocks input, never touches game
 * state. */
export function StatusBanner({ visible, text, tone = 'neutral', size = 'sm', top, maxWidth }: StatusBannerProps) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(4);

  useEffect(() => {
    if (!visible) return;
    opacity.value = 0;
    translateY.value = 4;
    opacity.value = withTiming(1, { duration: 160 });
    translateY.value = withTiming(0, { duration: 160 });
  }, [visible, text, opacity, translateY]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  if (!visible) return null;
  const toneStyle = TONE_STYLE[tone];

  return (
    <Animated.View style={[styles.root, { top }, animatedStyle]} pointerEvents="none">
      <Animated.View
        style={[
          styles.pill,
          size === 'lg' && styles.pillLg,
          { backgroundColor: toneStyle.background, borderColor: toneStyle.border },
          maxWidth ? { maxWidth } : null,
        ]}
      >
        <Text style={[styles.text, size === 'lg' && styles.textLg, { color: toneStyle.text }]}>{text}</Text>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  pill: {
    borderRadius: radii.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  pillLg: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radii.xl,
  },
  text: {
    ...typography.bodyBold,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowRadius: 4,
  },
  textLg: {
    ...typography.h1,
    textShadowColor: 'transparent',
  },
});
